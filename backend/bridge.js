/**
 * Bridge - Routes messages between Frontend (WebSocket) and ESP32 (Serial/WiFi).
 * Handles command translation, deduplication, and telemetry broadcast.
 */

const CommandQueue = require('./commandQueue');

class Bridge {
  constructor(serialManager) {
    this.serial = serialManager;
    this.wsClients = new Set();
    this.commandQueue = new CommandQueue();
    this.processInterval = null;
    this.connectionMode = 'disconnected'; // 'usb', 'wifi', 'disconnected'
    this.stats = {
      commandsSent: 0,
      commandsDropped: 0,
      telemetryReceived: 0,
      errors: 0,
      startTime: Date.now()
    };
    this.logs = [];
    this.maxLogs = 200;

    this.setupSerialListeners();
    this.startProcessing();
  }

  /**
   * Set up serial event listeners
   */
  setupSerialListeners() {
    this.serial.on('connected', (port) => {
      this.connectionMode = 'usb';
      this.addLog('system', `Serial connected: ${port}`);
      this.broadcastToClients({
        type: 'connection',
        mode: 'usb',
        port: port
      });
    });

    this.serial.on('disconnected', () => {
      this.connectionMode = 'disconnected';
      this.addLog('system', 'Serial disconnected');
      this.broadcastToClients({
        type: 'connection',
        mode: 'disconnected'
      });
    });

    this.serial.on('telemetry', (data) => {
      this.stats.telemetryReceived++;
      this.broadcastToClients(data);
    });

    this.serial.on('ack', (data) => {
      this.broadcastToClients(data);
    });

    this.serial.on('error', (data) => {
      this.stats.errors++;
      this.addLog('error', data.message);
      this.broadcastToClients(data);
    });

    this.serial.on('data', (rawData) => {
      this.addLog('rx', rawData);
    });
  }

  /**
   * Start processing command queue
   */
  startProcessing() {
    // Process queue every 10ms for low latency
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, 10);
  }

  /**
   * Process pending commands from the queue
   */
  processQueue() {
    if (!this.commandQueue.hasPending()) return;

    const command = this.commandQueue.dequeue();
    if (!command) return;

    if (this.connectionMode === 'usb') {
      const sent = this.serial.sendCommand(command);
      if (sent) {
        this.stats.commandsSent++;
        this.addLog('tx', this.commandToString(command));
      } else {
        this.stats.commandsDropped++;
      }
    } else {
      this.stats.commandsDropped++;
      if (this.stats.commandsDropped % 10 === 1) { // Avoid spamming
        this.addLog('system', '⚠ COMMAND DROPPED: No active hardware connection');
      }
    }
  }

  /**
   * Handle incoming WebSocket message from frontend
   */
  handleClientMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      // Enqueue the command
      this.commandQueue.enqueue(data);

      // Log significant commands
      if (data.type !== 'move') {
        this.addLog('cmd', this.commandToString(data));
      }

    } catch (err) {
      console.error('[Bridge] Invalid message:', message);
      this.addLog('error', `Invalid message: ${err.message}`);
    }
  }

  /**
   * Register a WebSocket client
   */
  addClient(ws) {
    this.wsClients.add(ws);
    console.log(`[Bridge] Client connected (total: ${this.wsClients.size})`);

    // Send current status to new client
    ws.send(JSON.stringify({
      type: 'connection',
      mode: this.connectionMode,
      port: this.serial.portPath
    }));

    // Send recent logs
    ws.send(JSON.stringify({
      type: 'logs',
      logs: this.logs.slice(-50)
    }));

    // Send stats
    ws.send(JSON.stringify({
      type: 'stats',
      stats: this.getStats()
    }));
  }

  /**
   * Remove a WebSocket client
   */
  removeClient(ws) {
    this.wsClients.delete(ws);
    console.log(`[Bridge] Client disconnected (total: ${this.wsClients.size})`);
  }

  /**
   * Broadcast data to all connected WebSocket clients
   */
  broadcastToClients(data) {
    const message = JSON.stringify(data);
    for (const client of this.wsClients) {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      } catch (err) {
        // Client likely disconnected
      }
    }
  }

  /**
   * Convert command object to human-readable string
   */
  commandToString(cmd) {
    switch (cmd.type) {
      case 'move':
        return `S:${(cmd.angles || []).join(',')}`;
      case 'jog':
        return `J:${cmd.servo},${cmd.diff}`;
      case 'gripper':
        return `G:${cmd.state === 'open' ? '1' : '0'}`;
      case 'home':
        return 'M:HOME';
      case 'zero':
        return 'M:ZERO';
      case 'speed':
        return `SPD:${cmd.value}`;
      case 'command':
        return cmd.raw || 'RAW';
      default:
        return cmd.type;
    }
  }

  /**
   * Add a log entry
   */
  addLog(source, message) {
    const entry = {
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source,
      message,
      timestamp: Date.now()
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Broadcast log to clients
    this.broadcastToClients({
      type: 'log',
      entry
    });
  }

  /**
   * Get system stats
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      connectedClients: this.wsClients.size,
      connectionMode: this.connectionMode,
      serialPort: this.serial.portPath
    };
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
    }
    this.commandQueue.clear();
    this.wsClients.clear();
  }
}

module.exports = Bridge;
