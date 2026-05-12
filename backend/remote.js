/**
 * RemoteManager — Room-based mobile controller synchronization via Socket.IO
 *
 * Features:
 * - Room generation with 6-char alphanumeric IDs
 * - Heartbeat / keepalive monitoring (10s interval, 15s timeout)
 * - Emergency stop on last remote disconnect
 * - Direct bridge execution for remote commands
 * - Room validation & auto-expiry (1 hour inactivity)
 * - Connected device metadata tracking
 * - Connection event logging broadcast to host
 */

const os = require('os');
const { Server } = require('socket.io');

class RemoteManager {
  constructor(server, bridge) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      pingInterval: 10000,
      pingTimeout: 15000
    });
    this.bridge = bridge;

    // RoomID -> { hostSocketId, clients: Map<socketId, DeviceInfo>, createdAt, lastActivity }
    this.rooms = new Map();
    // hostSocketId -> RoomID
    this.hostToRoom = new Map();
    // clientSocketId -> RoomID (reverse lookup)
    this.clientToRoom = new Map();

    this.ROOM_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

    this.setupSocketEvents();
    this.setupBridgeSync();
    this.startExpiryCheck();
  }

  /**
   * Get the local IP address and hostname of the laptop
   */
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    const names = Object.keys(interfaces).sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const isWifi = (s) => s.includes('wi-fi') || s.includes('wireless');
      const isEth = (s) => s.includes('ethernet') || s.includes('lan');
      
      if (isWifi(aLower) && !isWifi(bLower)) return -1;
      if (!isWifi(aLower) && isWifi(bLower)) return 1;
      if (isEth(aLower) && !isEth(bLower)) return -1;
      if (!isEth(aLower) && isEth(bLower)) return 1;
      return 0;
    });

    let address = 'localhost';

    for (const name of names) {
      // Skip virtual adapters
      if (name.toLowerCase().includes('vmware') || 
          name.toLowerCase().includes('virtualbox') || 
          name.toLowerCase().includes('vbox') ||
          name.toLowerCase().includes('vethernet')) continue;

      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          address = iface.address;
          break;
        }
      }
      if (address !== 'localhost') break;
    }

    return {
      address,
      hostname: os.hostname()
    };
  }

  /**
   * Generate a unique 6-character Room ID
   */
  generateRoomID() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id;
    do {
      id = '';
      for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(id)); // Ensure uniqueness
    return id;
  }

  /**
   * Check if a room exists and is valid
   */
  validateRoom(roomId) {
    if (!roomId) return { valid: false, reason: 'No room ID provided' };
    roomId = roomId.toUpperCase();
    if (!this.rooms.has(roomId)) return { valid: false, reason: 'Room not found' };
    const room = this.rooms.get(roomId);
    if (Date.now() - room.lastActivity > this.ROOM_EXPIRY_MS) {
      this.destroyRoom(roomId);
      return { valid: false, reason: 'Room expired' };
    }
    return { valid: true, roomId };
  }

  /**
   * Destroy a room and notify all participants
   */
  destroyRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    this.io.to(roomId).emit('room-destroyed', { reason: 'Room expired or host disconnected' });

    // Clean up client mappings
    for (const clientId of room.clients.keys()) {
      this.clientToRoom.delete(clientId);
    }
    if (room.hostSocketId) {
      this.hostToRoom.delete(room.hostSocketId);
    }

    this.rooms.delete(roomId);
    console.log(`[Socket.io] Room ${roomId} destroyed`);
  }

  /**
   * Build device list for a room and broadcast to host
   */
  broadcastDeviceList(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const devices = [];
    for (const [socketId, info] of room.clients.entries()) {
      devices.push({
        id: socketId,
        joinedAt: info.joinedAt,
        lastSeen: info.lastSeen,
        userAgent: info.userAgent || 'Unknown',
        label: info.label || `Phone ${devices.length + 1}`
      });
    }

    this.io.to(room.hostSocketId).emit('device-list', devices);
  }

  /**
   * Add a connection log entry and broadcast to host
   */
  logToHost(roomId, message, level = 'info') {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const entry = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message,
      level,
      timestamp: Date.now()
    };

    this.io.to(room.hostSocketId).emit('remote-log', entry);
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket.io] New connection: ${socket.id}`);

      // ─── HOST: Create a room ───────────────────────────
      socket.on('create-room', () => {
        // If this host already has a room, reuse it
        if (this.hostToRoom.has(socket.id)) {
          const existingRoomId = this.hostToRoom.get(socket.id);
          const room = this.rooms.get(existingRoomId);
          if (room) {
            room.lastActivity = Date.now();
            const { address: localIp, hostname: hostName } = this.getLocalIP();
            socket.emit('room-created', { roomId: existingRoomId, localIp, hostName });
            this.broadcastDeviceList(existingRoomId);
            return;
          }
        }

        const roomId = this.generateRoomID();
        this.rooms.set(roomId, {
          hostSocketId: socket.id,
          clients: new Map(),
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
        this.hostToRoom.set(socket.id, roomId);
        socket.join(roomId);
        
        const { address: localIp, hostname: hostName } = this.getLocalIP();
        socket.emit('room-created', { roomId, localIp, hostName });
        console.log(`[Socket.io] Room created: ${roomId} by host ${socket.id} | LAN: ${localIp} (${hostName})`);
      });

      // ─── MOBILE: Validate room exists ──────────────────
      socket.on('validate-room', (roomId, callback) => {
        const result = this.validateRoom(roomId);
        if (typeof callback === 'function') {
          callback(result);
        } else {
          socket.emit('room-validated', result);
        }
      });

      // ─── MOBILE: Join a room ───────────────────────────
      socket.on('join-room', (roomId, meta) => {
        roomId = (roomId || '').toUpperCase();
        const validation = this.validateRoom(roomId);

        if (!validation.valid) {
          socket.emit('joined-room', { status: 'error', message: validation.reason });
          return;
        }

        const room = this.rooms.get(roomId);
        const deviceInfo = {
          joinedAt: Date.now(),
          lastSeen: Date.now(),
          userAgent: meta?.userAgent || socket.handshake?.headers?.['user-agent'] || 'Unknown',
          label: meta?.label || `Phone ${room.clients.size + 1}`
        };

        room.clients.set(socket.id, deviceInfo);
        room.lastActivity = Date.now();
        this.clientToRoom.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit('joined-room', { roomId, status: 'success' });
        this.io.to(room.hostSocketId).emit('remote-joined', {
          socketId: socket.id,
          device: deviceInfo,
          totalRemotes: room.clients.size
        });

        this.broadcastDeviceList(roomId);
        this.logToHost(roomId, `Remote device joined (${deviceInfo.label})`);

        // Send current state to the newly joined client
        this.io.to(room.hostSocketId).emit('request-state-sync');

        console.log(`[Socket.io] Client ${socket.id} joined room ${roomId} (${room.clients.size} remotes)`);
      });

      // ─── HOST: Sync state to remotes ───────────────────
      socket.on('sync-state', (state) => {
        const roomId = this.hostToRoom.get(socket.id);
        if (roomId) {
          const room = this.rooms.get(roomId);
          if (room) room.lastActivity = Date.now();
          socket.to(roomId).emit('state-update', state);
        }
      });

      // ─── MOBILE: Send robot command ────────────────────
      socket.on('robot-command', (command) => {
        const roomId = this.clientToRoom.get(socket.id);
        if (!roomId) {
          console.warn(`[Socket.io] Command from ${socket.id} ignored: No room mapping`);
          return;
        }

        const room = this.rooms.get(roomId);
        if (!room) {
          console.warn(`[Socket.io] Command ignored: Room ${roomId} not found`);
          return;
        }

        room.lastActivity = Date.now();
        console.log(`[Socket.io] Command from ${roomId}:`, command.type);

        // Forward to host UI for visual sync
        if (room.hostSocketId) {
          this.io.to(room.hostSocketId).emit('execute-command', command);
        } else {
          console.warn(`[Socket.io] Room ${roomId} has no active host socket!`);
        }

        // Also execute directly through the bridge to the ESP32
        try {
          this.bridge.handleClientMessage(null, JSON.stringify(command));
        } catch (err) {
          console.error('[Socket.io] Bridge execution error:', err.message);
        }
      });

      // ─── EMERGENCY STOP (from any participant) ─────────
      socket.on('emergency-stop', () => {
        let roomId = this.hostToRoom.get(socket.id) || this.clientToRoom.get(socket.id);
        if (!roomId) return;

        console.log(`[Socket.io] ⚠ EMERGENCY STOP from ${socket.id} in room ${roomId}`);

        // Send stop through bridge immediately
        try {
          this.bridge.handleClientMessage(null, JSON.stringify({ type: 'stop' }));
        } catch (err) {
          console.error('[Socket.io] E-Stop bridge error:', err.message);
        }

        // Broadcast to all in room
        this.io.to(roomId).emit('emergency-stop-activated', {
          by: socket.id,
          timestamp: Date.now()
        });

        this.logToHost(roomId, '⚠ EMERGENCY STOP ACTIVATED', 'critical');
      });

      // ─── HEARTBEAT ─────────────────────────────────────
      socket.on('heartbeat', (callback) => {
        const roomId = this.clientToRoom.get(socket.id);
        if (roomId) {
          const room = this.rooms.get(roomId);
          if (room) {
            const deviceInfo = room.clients.get(socket.id);
            if (deviceInfo) deviceInfo.lastSeen = Date.now();
            room.lastActivity = Date.now();
          }
        }
        if (typeof callback === 'function') {
          callback({ ts: Date.now() });
        }
      });

      // ─── DISCONNECT ────────────────────────────────────
      socket.on('disconnect', (reason) => {
        // Host disconnected
        if (this.hostToRoom.has(socket.id)) {
          const roomId = this.hostToRoom.get(socket.id);
          this.io.to(roomId).emit('host-disconnected', { reason });
          this.logToHost(roomId, 'Host disconnected — room closing', 'critical');
          this.destroyRoom(roomId);
          console.log(`[Socket.io] Host disconnected, room ${roomId} closed`);
          return;
        }

        // Client disconnected
        const roomId = this.clientToRoom.get(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        const deviceInfo = room.clients.get(socket.id);
        const label = deviceInfo?.label || socket.id;
        room.clients.delete(socket.id);
        this.clientToRoom.delete(socket.id);

        this.io.to(room.hostSocketId).emit('remote-left', {
          socketId: socket.id,
          totalRemotes: room.clients.size
        });

        this.broadcastDeviceList(roomId);
        this.logToHost(roomId, `Remote disconnected: ${label} (${reason})`, 'warn');

        console.log(`[Socket.io] Remote ${socket.id} left room ${roomId} (${room.clients.size} remaining)`);

        // If no remotes left, send emergency stop for safety
        if (room.clients.size === 0) {
          console.log(`[Socket.io] All remotes disconnected — sending safety STOP`);
          try {
            this.bridge.handleClientMessage(null, JSON.stringify({ type: 'stop' }));
          } catch (err) {
            console.error('[Socket.io] Safety stop error:', err.message);
          }
          this.logToHost(roomId, 'All remotes disconnected — safety STOP sent', 'critical');
        }
      });
    });
  }

  setupBridgeSync() {
    // Listen for telemetry from bridge and broadcast to all active rooms
    const originalBroadcast = this.bridge.broadcastToClients.bind(this.bridge);
    this.bridge.broadcastToClients = (data) => {
      originalBroadcast(data);

      // Broadcast to all active rooms with clients
      if (this.rooms.size > 0) {
        this.io.emit('telemetry', data);
      }
    };

    // Periodically sync room stats to hosts
    setInterval(() => {
      for (const [roomId, room] of this.rooms.entries()) {
        this.io.to(room.hostSocketId).emit('room-stats', {
          connectedClients: room.clients.size,
          lastSync: Date.now()
        });
      }
    }, 2000);
  }

  /**
   * Periodically check for expired rooms
   */
  startExpiryCheck() {
    this.expiryInterval = setInterval(() => {
      const now = Date.now();
      for (const [roomId, room] of this.rooms.entries()) {
        if (now - room.lastActivity > this.ROOM_EXPIRY_MS) {
          console.log(`[Socket.io] Room ${roomId} expired (inactive for 1h)`);
          this.destroyRoom(roomId);
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Get room info for REST API
   */
  getRoomInfo(roomId) {
    roomId = (roomId || '').toUpperCase();
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return {
      roomId,
      clientCount: room.clients.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity
    };
  }

  /**
   * Get all rooms summary
   */
  getAllRooms() {
    const result = [];
    for (const [roomId, room] of this.rooms.entries()) {
      result.push({
        roomId,
        clientCount: room.clients.size,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity
      });
    }
    return result;
  }
}

module.exports = RemoteManager;
