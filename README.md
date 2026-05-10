# 🦾 Real-Time Robotic Arm Control System

Industrial-grade robotic arm control system with ultra-low latency USB serial communication, real-time telemetry, and a dark futuristic dashboard.

## Architecture

```
Frontend (Next.js :3000)
    ↕ WebSocket
Backend (Node.js :3001)
    ↕ Serial (USB) or WebSocket (WiFi)
ESP32 Firmware
    ↕ I2C
PCA9685 → Servos (J1–J6)
```

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Upload Firmware

1. Open `firmware/firmware.ino` in Arduino IDE
2. Install libraries: WiFiManager, WebSocketsClient, ArduinoJson, Adafruit PWM Servo Driver
3. Select board: ESP32 Dev Module
4. Upload

### 3. Run the System

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 4. Open Dashboard

Navigate to `http://localhost:3000`

## Features

| Tab | Description |
|-----|-------------|
| **Control** | Joystick, joint sliders (J1-J6), speed selector, quick actions |
| **Gesture** | Webcam hand tracking with MediaPipe gesture mapping |
| **Program** | Step-based program editor with import/export JSON |
| **I/O** | Servo monitor, analog inputs, DIO ports, command tester, log console |
| **Monitor** | Real-time charts, telemetry cards, system health, events |

## Communication Protocol

### Serial (USB) — Compact Format
```
PC → ESP32:
  S:a1,a2,a3,a4,a5,a6    Set angles
  G:0 / G:1               Gripper close/open
  M:HOME / M:ZERO          Preset positions
  SPD:75                   Set speed %
  HELLO                    Handshake

ESP32 → PC:
  READY                    Handshake response
  ACK                      Command acknowledged
  T:a1,a2,a3,...,rssi      Telemetry (compact)
  ERR:message              Error
```

### WebSocket (Frontend ↔ Backend) — JSON
```json
{"type":"move","angles":[90,45,90,0,0,90],"speed":75}
{"type":"telemetry","angles":[...],"voltage":7.48,...}
```

## Hardware

- ESP32 DevKit
- PCA9685 16-channel PWM driver
- 6x SG90/MG996R servos
- 5-6V external power supply (mandatory for servos)
- Common ground between ESP32, PCA9685, and power supply

### Wiring

| ESP32 | PCA9685 |
|-------|---------|
| GPIO21 (SDA) | SDA |
| GPIO22 (SCL) | SCL |
| GND | GND |
| 3.3V | VCC |
| — | V+ → External 5-6V |

## Latency

- USB Serial: ~10-20ms end-to-end
- WiFi WebSocket: ~30-50ms end-to-end
- Command deduplication prevents servo flooding
- 20Hz max command rate to serial

## Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS, Zustand, Recharts, Framer Motion
- **Backend**: Node.js, Express, ws, serialport
- **Firmware**: Arduino (ESP32), Adafruit PWM Servo Driver, ArduinoJson
