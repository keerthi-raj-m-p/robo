const os = require('os');
const { Server } = require('socket.io');

class RemoteManager {
  constructor(server, bridge) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    this.bridge = bridge;
    this.rooms = new Map(); // RoomID -> { hostSocketId, clients: Set<socketId> }
    this.hostToRoom = new Map(); // hostSocketId -> RoomID

    this.setupSocketEvents();
    this.setupBridgeSync();
  }

  /**
   * Get the local IP address of the laptop
   */
  getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip non-ipv4 and internal (localhost) addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return 'localhost';
  }

  /**
   * Generate a unique 6-character Room ID
   */
  generateRoomID() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket.io] New connection: ${socket.id}`);

      // Host (Laptop) creates a room
      socket.on('create-room', () => {
        const roomId = this.generateRoomID();
        this.rooms.set(roomId, { hostSocketId: socket.id, clients: new Set() });
        this.hostToRoom.set(socket.id, roomId);
        socket.join(roomId);
        
        const localIp = this.getLocalIP();
        socket.emit('room-created', { roomId, localIp });
        console.log(`[Socket.io] Room created: ${roomId} by host ${socket.id}`);
      });

      // Phone joins a room
      socket.on('join-room', (roomId) => {
        roomId = roomId.toUpperCase();
        if (this.rooms.has(roomId)) {
          const room = this.rooms.get(roomId);
          room.clients.add(socket.id);
          socket.join(roomId);
          
          socket.emit('joined-room', { roomId, status: 'success' });
          this.io.to(room.hostSocketId).emit('remote-joined', { socketId: socket.id });
          console.log(`[Socket.io] Client ${socket.id} joined room ${roomId}`);
        } else {
          socket.emit('joined-room', { status: 'error', message: 'Room not found' });
        }
      });

      // Sync state from Host to Remotes
      socket.on('sync-state', (state) => {
        const roomId = this.hostToRoom.get(socket.id);
        if (roomId) {
          // Broadcast to everyone in room EXCEPT the host
          socket.to(roomId).emit('state-update', state);
        }
      });

      // Command from Remote to Host
      socket.on('robot-command', (command) => {
        console.log(`[Socket.io] Command from remote ${socket.id}:`, command);
        // Find which room this socket belongs to
        let roomId = null;
        for (const [rid, room] of this.rooms.entries()) {
          if (room.clients.has(socket.id)) {
            roomId = rid;
            break;
          }
        }

        if (roomId) {
          const room = this.rooms.get(roomId);
          // Forward command to host
          this.io.to(room.hostSocketId).emit('execute-command', command);
          // Also pass to bridge if we want direct execution (but laptop should probably filter/handle it)
          // this.bridge.handleClientMessage(null, JSON.stringify(command));
        }
      });

      socket.on('disconnect', () => {
        if (this.hostToRoom.has(socket.id)) {
          const roomId = this.hostToRoom.get(socket.id);
          this.io.to(roomId).emit('host-disconnected');
          this.rooms.delete(roomId);
          this.hostToRoom.delete(socket.id);
          console.log(`[Socket.io] Host disconnected, room ${roomId} closed`);
        } else {
          // Check if it was a client
          for (const [roomId, room] of this.rooms.entries()) {
            if (room.clients.has(socket.id)) {
              room.clients.delete(socket.id);
              this.io.to(room.hostSocketId).emit('remote-left', { socketId: socket.id });
              console.log(`[Socket.io] Remote ${socket.id} left room ${roomId}`);
              break;
            }
          }
        }
      });
    });
  }

  setupBridgeSync() {
    // Listen for telemetry from bridge and broadcast to all active rooms
    // This is a bit brute force, but simple for local Wi-Fi
    const originalBroadcast = this.bridge.broadcastToClients.bind(this.bridge);
    this.bridge.broadcastToClients = (data) => {
      originalBroadcast(data);
      // Also broadcast via Socket.IO to all rooms
      this.io.emit('telemetry', data);
    };
  }
}

module.exports = RemoteManager;
