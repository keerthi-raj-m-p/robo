'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRobotStore } from '@/store/useRobotStore';

export function useRemoteSync(onSend: (data: Record<string, any>) => void) {
  const socketRef = useRef<Socket | null>(null);
  const { 
    roomId, isRemote, localIp, setRoomInfo, setRemoteState, 
    jointAngles, targetAngles, telemetry, programRunning, 
    activeTab, speed, controlMode 
  } = useRobotStore();

  useEffect(() => {
    // Determine backend URL
    // If we're on mobile, we need the laptop's IP.
    // If we're on laptop, we can use localhost.
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

    const socket = io(backendUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[RemoteSync] Connected to backend');
      if (joinRoomId) {
        socket.emit('join-room', joinRoomId);
      } else {
        // Laptop side - create a room
        socket.emit('create-room');
      }
    });

    socket.on('room-created', ({ roomId, localIp }) => {
      setRoomInfo({ roomId, localIp, isRemote: false });
    });

    socket.on('joined-room', ({ status, message }) => {
      if (status === 'success') {
        console.log('[RemoteSync] Successfully joined room');
      } else {
        console.error('[RemoteSync] Join failed:', message);
      }
    });

    socket.on('state-update', (state) => {
      if (isRemote) {
        setRemoteState(state);
      }
    });

    socket.on('telemetry', (data) => {
      if (isRemote) {
        useRobotStore.getState().updateTelemetry(data);
      }
    });

    socket.on('execute-command', (command) => {
      // Host executes command from remote
      onSend(command);
    });

    socket.on('host-disconnected', () => {
      if (isRemote) {
        console.warn('[RemoteSync] Host disconnected');
        // Handle UI feedback
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isRemote, setRemoteState, setRoomInfo, onSend]);

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

  return { sendRemoteCommand };
}
