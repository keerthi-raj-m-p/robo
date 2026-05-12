/**
 * Robotic Arm Control Backend
 * Express HTTP + WebSocket server with Serial bridge to ESP32
 * 
 * Features:
 * - Auto-detect ESP32 on USB serial ports
 * - WebSocket server for real-time frontend communication
 * - Command deduplication and rate limiting
 * - Telemetry broadcast to all connected clients
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const SerialManager = require('./serial');
const Bridge = require('./bridge');
const RemoteManager = require('./remote');

// Configuration
const PORT = process.env.PORT || 3001;
const WS_PATH = '/ws';

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Serial Manager
const serialManager = new SerialManager();

// Initialize Bridge
const bridge = new Bridge(serialManager);

// Initialize Remote Manager (Socket.IO)
const remoteManager = new RemoteManager(server, bridge);

// Create WebSocket Server
const wss = new WebSocketServer({ server, path: WS_PATH });

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] New client from ${clientIp}`);

  // Register client with bridge
  bridge.addClient(ws);

  // Handle messages from frontend
  ws.on('message', (message) => {
    try {
      const data = message.toString();
      bridge.handleClientMessage(ws, data);
    } catch (err) {
      console.error('[WS] Message error:', err.message);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    bridge.removeClient(ws);
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error('[WS] Client error:', err.message);
    bridge.removeClient(ws);
  });

  // Ping/pong for keepalive
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// WebSocket keepalive
const keepaliveInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 15000);

wss.on('close', () => {
  clearInterval(keepaliveInterval);
});

// REST API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    serial: serialManager.getStatus(),
    bridge: bridge.getStats(),
    timestamp: Date.now()
  });
});

app.get('/api/ports', async (req, res) => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'No command provided' });
  }

  bridge.handleClientMessage(null, JSON.stringify(command));
  res.json({ status: 'queued' });
});

// Room validation endpoint (for mobile join page)
app.get('/api/room/:id', (req, res) => {
  const info = remoteManager.getRoomInfo(req.params.id);
  if (info) {
    res.json({ valid: true, ...info });
  } else {
    res.status(404).json({ valid: false, message: 'Room not found' });
  }
});

// Local IP endpoint
app.get('/api/local-ip', (req, res) => {
  res.json({ ip: remoteManager.getLocalIP().address });
});

// All active rooms
app.get('/api/rooms', (req, res) => {
  res.json(remoteManager.getAllRooms());
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Start server — listen on 0.0.0.0 so mobile devices on LAN can reach it
server.listen(PORT, '0.0.0.0', () => {
  const { address: localIp } = remoteManager.getLocalIP();
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     ROBOTIC ARM CONTROL BACKEND v2.0.0          ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  HTTP Server:  http://localhost:${PORT}              ║`);
  console.log(`║  LAN Access:   http://${localIp}:${PORT}       ║`);
  console.log(`║  WebSocket:    ws://localhost:${PORT}${WS_PATH}              ║`);
  console.log('║  Socket.IO:    Enabled (rooms + remote control) ║');
  console.log('║  Serial:       Auto-scanning...                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Start serial port scanning
  serialManager.startScanning();
});

// Broadcast stats every 2 seconds
setInterval(() => {
  bridge.broadcastToClients({
    type: 'stats',
    stats: bridge.getStats()
  });
}, 2000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  bridge.destroy();
  serialManager.destroy();
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bridge.destroy();
  serialManager.destroy();
  wss.close();
  server.close();
  process.exit(0);
});

// Global Error Handling to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('[Server] CRITICAL: Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});
