/**
 * Serial Port Manager - Auto-detect ESP32, connect, reconnect, handshake.
 * Scans COM ports on Windows, /dev/ttyUSB* and /dev/ttyACM* on Linux/Mac.
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('serialport');
const EventEmitter = require('events');

class SerialManager extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this.parser = null;
    this.connected = false;
    this.portPath = null;
    this.scanning = false;
    this.scanInterval = null;
    this.handshakeTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 100;
    this.buffer = '';
  }

  /**
   * Start scanning for ESP32 ports
   */
  startScanning() {
    if (this.scanInterval) return;
    console.log('[Serial] Starting port scan...');
    this.scan(); // Immediate first scan
    this.scanInterval = setInterval(() => {
      if (!this.connected) {
        this.scan();
      }
    }, 3000);
  }

  /**
   * Stop scanning
   */
  stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  /**
   * Scan available serial ports for ESP32
   */
  async scan() {
    if (this.scanning || this.connected) return;
    this.scanning = true;

    try {
      const ports = await SerialPort.list();
      const esp32Ports = ports.filter(p => {
        const desc = (p.manufacturer || '').toLowerCase() + (p.pnpId || '').toLowerCase() + (p.friendlyName || '').toLowerCase();
        // Filter for common ESP32 USB-Serial chips
        return (
          desc.includes('cp210') ||
          desc.includes('ch340') ||
          desc.includes('ch9102') ||
          desc.includes('ftdi') ||
          desc.includes('silicon labs') ||
          desc.includes('espressif') ||
          desc.includes('usb-serial') ||
          desc.includes('usb serial') ||
          // Fallback: any COM port or ttyUSB/ttyACM
          /^COM\d+$/i.test(p.path) ||
          /tty(USB|ACM)\d+/.test(p.path)
        );
      });

      if (esp32Ports.length > 0) {
        console.log(`[Serial] Found ${esp32Ports.length} potential port(s):`, esp32Ports.map(p => p.path).join(', '));
        // Try each port until we get a handshake
        for (const portInfo of esp32Ports) {
          if (this.connected) break;
          await this.tryConnect(portInfo.path);
        }
      }
    } catch (err) {
      console.error('[Serial] Scan error:', err.message);
    }

    this.scanning = false;
  }

  /**
   * Try connecting to a specific port
   */
  async tryConnect(portPath) {
    return new Promise((resolve) => {
      try {
        console.log(`[Serial] Trying ${portPath}...`);

        const port = new SerialPort({
          path: portPath,
          baudRate: 115200,
          autoOpen: false
        });

        port.open((err) => {
          if (err) {
            console.log(`[Serial] Failed to open ${portPath}: ${err.message}`);
            resolve(false);
            return;
          }

          const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

          // Set handshake timeout
          const timeout = setTimeout(() => {
            console.log(`[Serial] Handshake timeout on ${portPath}`);
            try { port.close(); } catch (e) {}
            resolve(false);
          }, 3000);

          parser.on('data', (data) => {
            const line = data.toString().trim();

            if (line === 'READY' && !this.connected) {
              clearTimeout(timeout);
              this.port = port;
              this.parser = parser;
              this.portPath = portPath;
              this.connected = true;
              this.reconnectAttempts = 0;

              console.log(`[Serial] ✓ Connected to ESP32 on ${portPath}`);
              this.emit('connected', portPath);

              // Set up ongoing data handler
              this.setupDataHandler();

              // Set up disconnect handler
              port.on('close', () => this.handleDisconnect());
              port.on('error', (err) => {
                console.error('[Serial] Port error:', err.message);
                this.handleDisconnect();
              });

              resolve(true);
              return;
            }

            // If we get other data during handshake, still try
            if (!this.connected) {
              // Might be telemetry from a previously connected ESP32
              // Try sending HELLO again
            }
          });

          // Send handshake
          setTimeout(() => {
            try {
              port.write('HELLO\n');
            } catch (e) {}
          }, 500);
        });
      } catch (err) {
        console.error(`[Serial] Error connecting to ${portPath}:`, err.message);
        resolve(false);
      }
    });
  }

  /**
   * Set up the main data handler after successful handshake
   */
  setupDataHandler() {
    if (!this.parser) return;

    // Remove old listeners and set up new one
    this.parser.removeAllListeners('data');
    this.parser.on('data', (data) => {
      const line = data.toString().trim();
      if (!line) return;

      // Parse telemetry: T:a1,a2,a3,a4,a5,a6,v,c,t,cpu,heap,rssi
      if (line.startsWith('T:')) {
        const values = line.substring(2).split(',').map(Number);
        if (values.length >= 6) {
          const telemetry = {
            type: 'telemetry',
            angles: values.slice(0, 6),
            voltage: values[6] || 0,
            current: values[7] || 0,
            temp: values[8] || 0,
            cpu: values[9] || 0,
            heap: values[10] || 0,
            rssi: values[11] || 0,
            timestamp: Date.now()
          };
          this.emit('telemetry', telemetry);
        }
        return;
      }

      // Parse ACK
      if (line === 'ACK') {
        this.emit('ack', { type: 'ack', status: 'ok' });
        return;
      }

      // Parse errors
      if (line.startsWith('ERR:')) {
        this.emit('error', { type: 'error', message: line.substring(4) });
        return;
      }

      // Parse READY (re-handshake)
      if (line === 'READY') {
        this.emit('ready');
        return;
      }

      // Unknown data - forward as raw
      this.emit('data', line);
    });
  }

  /**
   * Handle disconnection
   */
  handleDisconnect() {
    if (!this.connected) return;

    console.log('[Serial] ✗ Disconnected from ESP32');
    this.connected = false;
    this.portPath = null;

    try {
      if (this.port && this.port.isOpen) {
        this.port.close();
      }
    } catch (e) {}

    this.port = null;
    this.parser = null;
    this.emit('disconnected');

    // Auto-reconnect
    this.reconnectAttempts++;
    if (this.reconnectAttempts <= this.maxReconnectAttempts) {
      console.log(`[Serial] Will rescan in 3s (attempt ${this.reconnectAttempts})`);
    }
  }

  /**
   * Send a raw string command to ESP32
   */
  send(data) {
    if (!this.connected || !this.port || !this.port.isOpen) {
      return false;
    }

    try {
      this.port.write(data + '\n');
      return true;
    } catch (err) {
      console.error('[Serial] Send error:', err.message);
      return false;
    }
  }

  /**
   * Send a structured command (converts to compact serial format)
   */
  sendCommand(command) {
    if (!command || !command.type) return false;

    let serialCmd = '';

    switch (command.type) {
      case 'move':
        if (command.angles && Array.isArray(command.angles)) {
          serialCmd = `S:${command.angles.join(',')}`;
        }
        break;
      case 'gripper':
        serialCmd = `G:${command.state === 'open' ? '1' : '0'}`;
        break;
      case 'home':
        serialCmd = 'M:HOME';
        break;
      case 'zero':
        serialCmd = 'M:ZERO';
        break;
      case 'speed':
        serialCmd = `SPD:${command.value || 100}`;
        break;
      case 'command':
        serialCmd = command.raw || '';
        break;
      case 'hello':
        serialCmd = 'HELLO';
        break;
      case 'jog':
        if (typeof command.servo === 'number' && typeof command.diff === 'number') {
          serialCmd = `J:${command.servo},${command.diff}`;
        }
        break;
      default:
        return false;
    }

    if (serialCmd) {
      return this.send(serialCmd);
    }
    return false;
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.connected,
      port: this.portPath,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Disconnect and clean up
   */
  destroy() {
    this.stopScanning();
    if (this.handshakeTimeout) clearTimeout(this.handshakeTimeout);

    try {
      if (this.port && this.port.isOpen) {
        this.port.close();
      }
    } catch (e) {}

    this.connected = false;
    this.port = null;
    this.parser = null;
    this.removeAllListeners();
  }
}

module.exports = SerialManager;
