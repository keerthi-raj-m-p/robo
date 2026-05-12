'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRobotStore } from '@/store/useRobotStore';

/**
 * useRemoteSync — Manages Socket.IO connection for room-based remote control.
 *
 * On LAPTOP (host):
 *   - Creates a room on connect
 *   - Syncs state to remotes when jointAngles/speed/etc change
 *   - Listens for execute-command from remotes and passes to onSend
 *   - Receives device-list, remote-log, room-stats
 *
 * On MOBILE (remote):
 *   - Joins room using URL params (?room=XXX&host=IP)
 *   - Receives state-update and applies to local store
 *   - Sends robot-command via sendRemoteCommand
 *   - Heartbeat ping every 10s to track latency
 */
export function useRemoteSync(onSend: (data: Record<string, any>) => void) {
  const socketRef = useRef<Socket | null>(null);
  const reconnectDelayRef = useRef(1000);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    roomId, isRemote, localIp, setRoomInfo, setRemoteState,
    jointAngles, targetAngles, telemetry, programRunning,
    activeTab, speed, controlMode, setSyncStats,
    setConnectedDevices, setRemoteLatency, setEmergencyStop, addRemoteLog
  } = useRobotStore();

  const onSendRef = useRef(onSend);
  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  useEffect(() => {
    // Check for room/host in URL params for automatic joining
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      const host = params.get('host');
      if (room && host && !roomId) {
        socketRef.current?.emit('join-room', { roomId: room.toUpperCase(), hostIp: host });
      }
    }

    // Determine backend URL
    let backendUrl = 'http://localhost:3001';

    // Check if we are in "Join" mode (passed via URL query)
    const params = new URLSearchParams(window.location.search);
    const joinRoomId = params.get('room');
    const hostIp = params.get('host');

    if (joinRoomId && hostIp) {
      backendUrl = `http://${hostIp}:3001`;
      if (!isRemote) {
        setRoomInfo({ roomId: joinRoomId, localIp: hostIp, isRemote: true });
      }
    }

    const socket = io(backendUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 15000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[RemoteSync] Connected to backend');
      reconnectDelayRef.current = 1000;
      useRobotStore.getState().setSyncStats({ connectedRemotes: 0, syncStatus: 'stable' });

      if (joinRoomId) {
        // Mobile side — join the room
        socket.emit('join-room', joinRoomId, {
          userAgent: navigator.userAgent,
          label: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'Tablet'
        });
      } else {
        // Laptop side — create a room
        socket.emit('create-room');
      }
    });

    socket.on('room-created', ({ roomId, localIp, hostName }) => {
      setRoomInfo({ roomId, localIp, hostName, isRemote: false });
    });

    socket.on('joined-room', ({ status, message, roomId: joinedRoom }) => {
      if (status === 'success') {
        console.log(`[RemoteSync] Successfully joined room ${joinedRoom}`);
      } else {
        console.error('[RemoteSync] Join failed:', message);
        addRemoteLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          message: `Join failed: ${message}`,
          level: 'critical',
          timestamp: Date.now()
        });
      }
    });

    // ─── State sync (mobile receives from host) ──────────
    socket.on('state-update', (state) => {
      if (useRobotStore.getState().isRemote) {
        setRemoteState(state);
      }
    });

    // ─── Telemetry (both host and mobile) ────────────────
    socket.on('telemetry', (data) => {
      if (useRobotStore.getState().isRemote) {
        useRobotStore.getState().updateTelemetry(data);
      }
    });

    // ─── Execute command (host receives from remote) ─────
    socket.on('execute-command', (command) => {
      onSendRef.current(command);
    });

    // ─── Request state sync (host sends full state) ──────
    socket.on('request-state-sync', () => {
      const s = useRobotStore.getState();
      if (!s.isRemote && socketRef.current?.connected) {
        socketRef.current.emit('sync-state', {
          jointAngles: s.jointAngles,
          targetAngles: s.targetAngles,
          programRunning: s.programRunning,
          activeTab: s.activeTab,
          speed: s.speed,
          controlMode: s.controlMode,
          emergencyStopActive: s.emergencyStopActive
        });
      }
    });

    // ─── Room stats (host) ───────────────────────────────
    socket.on('room-stats', ({ connectedClients }) => {
      useRobotStore.getState().setSyncStats({
        connectedRemotes: connectedClients,
        syncStatus: 'stable'
      });
    });

    // ─── Device list (host) ──────────────────────────────
    socket.on('device-list', (devices) => {
      setConnectedDevices(devices);
    });

    // ─── Remote log (host) ───────────────────────────────
    socket.on('remote-log', (entry) => {
      addRemoteLog(entry);
    });

    // ─── Remote joined / left (host) ─────────────────────
    socket.on('remote-joined', ({ totalRemotes }) => {
      useRobotStore.getState().setSyncStats({
        connectedRemotes: totalRemotes,
        syncStatus: 'stable'
      });
    });

    socket.on('remote-left', ({ totalRemotes }) => {
      useRobotStore.getState().setSyncStats({
        connectedRemotes: totalRemotes,
        syncStatus: 'stable'
      });
    });

    // ─── Emergency stop ──────────────────────────────────
    socket.on('emergency-stop-activated', ({ by, timestamp }) => {
      setEmergencyStop(true);
      // Auto-clear after 3 seconds
      setTimeout(() => setEmergencyStop(false), 3000);
      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    });

    // ─── Host disconnected (mobile) ──────────────────────
    socket.on('host-disconnected', () => {
      if (useRobotStore.getState().isRemote) {
        console.warn('[RemoteSync] Host disconnected');
        useRobotStore.getState().setSyncStats({
          connectedRemotes: 0,
          syncStatus: 'offline'
        });
        addRemoteLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          message: 'Host disconnected — connection lost',
          level: 'critical',
          timestamp: Date.now()
        });
      }
    });

    // ─── Room destroyed ──────────────────────────────────
    socket.on('room-destroyed', ({ reason }) => {
      console.warn('[RemoteSync] Room destroyed:', reason);
      useRobotStore.getState().setSyncStats({
        connectedRemotes: 0,
        syncStatus: 'offline'
      });
    });

    // ─── Disconnect / reconnect ──────────────────────────
    socket.on('disconnect', (reason) => {
      console.warn('[RemoteSync] Disconnected:', reason);
      useRobotStore.getState().setSyncStats({
        connectedRemotes: useRobotStore.getState().connectedRemotes,
        syncStatus: 'offline'
      });
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[RemoteSync] Reconnected after ${attemptNumber} attempts`);
      useRobotStore.getState().setSyncStats({
        connectedRemotes: useRobotStore.getState().connectedRemotes,
        syncStatus: 'syncing'
      });
      // Re-join room if mobile
      if (joinRoomId) {
        socket.emit('join-room', joinRoomId, {
          userAgent: navigator.userAgent,
          label: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'Phone' : 'Tablet'
        });
      }
    });

    // ─── Heartbeat (mobile only) ─────────────────────────
    if (joinRoomId) {
      heartbeatRef.current = setInterval(() => {
        if (socket.connected) {
          const start = Date.now();
          socket.emit('heartbeat', (response: { ts: number }) => {
            const latency = Date.now() - start;
            setRemoteLatency(latency);
          });
        }
      }, 10000);
    }

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Back to empty array for stability

  // Sync state from Host to Remotes whenever relevant state changes
  useEffect(() => {
    if (!isRemote && socketRef.current && socketRef.current.connected) {
      const stateToSync = {
        jointAngles,
        targetAngles,
        programRunning,
        activeTab,
        speed,
        controlMode
      };
      socketRef.current.emit('sync-state', stateToSync);
    }
  }, [isRemote, jointAngles, targetAngles, programRunning, activeTab, speed, controlMode]);

  const sendRemoteCommand = useCallback((command: any) => {
    if (isRemote && socketRef.current) {
      socketRef.current.emit('robot-command', command);
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
  }, [isRemote]);

  const sendEmergencyStop = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('emergency-stop');
      // Strong haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
    }
  }, []);

  return { sendRemoteCommand, sendEmergencyStop };
}
