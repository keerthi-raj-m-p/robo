/*
 * ============================================================
 *  ROBOTIC ARM CONTROLLER - ESP32 FIRMWARE v1.0.0
 * ============================================================
 *  Non-blocking firmware for 6-DOF robotic arm control
 *  Communication: USB Serial (primary) + WiFi WebSocket (fallback)
 *  Servo Driver: PCA9685 via I2C
 * 
 *  Libraries required:
 *    - WiFiManager (tzapu)
 *    - WebSocketsClient (Links2004)
 *    - ArduinoJson (bblanchon)
 *    - Adafruit PWM Servo Driver Library
 * ============================================================
 */

#include <Wire.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Adafruit_PWMServoDriver.h>

// ============================================================
//  CONFIGURATION
// ============================================================

// Servo Configuration
#define NUM_SERVOS        6
#define PCA9685_ADDR      0x40
#define SERVO_FREQ        50      // 50 Hz for standard servos
#define SERVO_MIN_US      500     // Minimum pulse width (µs)
#define SERVO_MAX_US      2500    // Maximum pulse width (µs)

// Servo channel mapping on PCA9685
const uint8_t SERVO_CHANNELS[NUM_SERVOS] = {0, 1, 2, 3, 4, 5};

// Servo angle limits (degrees)
const int SERVO_MIN_ANGLE[NUM_SERVOS] = {0,   0,   0,   0,   0,   0};
const int SERVO_MAX_ANGLE[NUM_SERVOS] = {180, 180, 180, 180, 180, 180};

// Default positions
const float HOME_ANGLES[NUM_SERVOS] = {90, 45, 90, 0, 0, 90};
const float ZERO_ANGLES[NUM_SERVOS] = {90, 90, 90, 90, 90, 90};

// Timing (all in milliseconds)
#define MOTION_UPDATE_MS    20    // Servo update interval (50Hz)
#define TELEMETRY_MS        100   // Telemetry send interval
#define WIFI_CHECK_MS       5000  // WiFi reconnect check interval
#define SERIAL_BAUD         115200

// WiFi WebSocket Server (backend)
#define WS_HOST             "192.168.1.100"
#define WS_PORT             3001
#define WS_PATH             "/ws"

// Analog input pins
#define ANALOG_PIN_0        36    // VP
#define ANALOG_PIN_1        39    // VN
#define ANALOG_PIN_2        34
#define ANALOG_PIN_3        35

// Voltage divider for battery monitoring
#define VOLTAGE_PIN         36
#define VOLTAGE_DIVIDER     2.0   // Divider ratio
#define VREF                3.3

// ============================================================
//  GLOBAL OBJECTS
// ============================================================

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(PCA9685_ADDR);
WebSocketsClient webSocket;
WiFiManager wifiManager;

// ============================================================
//  STATE VARIABLES
// ============================================================

// Servo state
float currentAngles[NUM_SERVOS];
float targetAngles[NUM_SERVOS];
float speedMultiplier = 1.0;       // 0.25 to 1.0
float maxDegreesPerUpdate = 3.0;   // Max degrees per motion update at 100% speed

// Timing
unsigned long lastMotionUpdate = 0;
unsigned long lastTelemetry = 0;
unsigned long lastWiFiCheck = 0;

// Communication state
bool serialConnected = false;
bool wsConnected = false;
bool wifiConnected = false;
unsigned long lastSerialData = 0;
#define SERIAL_TIMEOUT_MS   5000   // Consider serial disconnected after 5s silence

// Telemetry data
float voltage = 0;
float current = 0;
float temperature = 0;
int cpuLoad = 0;
int freeHeap = 0;

// Serial buffer
String serialBuffer = "";

// ============================================================
//  SETUP
// ============================================================

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(100);  // Brief startup delay - only one allowed

  Serial.println("ROBOTIC ARM CONTROLLER v1.0.0");
  Serial.println("Initializing...");

  // Initialize I2C and PCA9685
  Wire.begin();
  pwm.begin();
  pwm.setOscillatorFrequency(27000000);
  pwm.setPWMFreq(SERVO_FREQ);

  // Set initial servo positions (home)
  for (int i = 0; i < NUM_SERVOS; i++) {
    currentAngles[i] = HOME_ANGLES[i];
    targetAngles[i] = HOME_ANGLES[i];
    setServoAngle(i, currentAngles[i]);
  }

  // Initialize WiFi (non-blocking attempt)
  setupWiFi();

  Serial.println("READY");
}

// ============================================================
//  MAIN LOOP - NON-BLOCKING
// ============================================================

void loop() {
  unsigned long now = millis();

  // 1. Handle Serial input
  handleSerial();

  // 2. Handle WebSocket
  if (wifiConnected) {
    webSocket.loop();
  }

  // 3. Update motion (every 20ms)
  if (now - lastMotionUpdate >= MOTION_UPDATE_MS) {
    lastMotionUpdate = now;
    updateMotion();
  }

  // 4. Send telemetry (every 100ms)
  if (now - lastTelemetry >= TELEMETRY_MS) {
    lastTelemetry = now;
    readSensors();
    sendTelemetry();
  }

  // 5. Check WiFi (every 5s)
  if (now - lastWiFiCheck >= WIFI_CHECK_MS) {
    lastWiFiCheck = now;
    checkWiFi();
  }

  // 6. Check serial timeout
  if (serialConnected && (now - lastSerialData > SERIAL_TIMEOUT_MS)) {
    serialConnected = false;
  }
}

// ============================================================
//  WIFI SETUP
// ============================================================

void setupWiFi() {
  // Try connecting to saved WiFi for 5 seconds
  wifiManager.setConnectTimeout(5);
  wifiManager.setConfigPortalTimeout(1); // Don't block on portal

  WiFi.mode(WIFI_STA);
  WiFi.begin(); // Try saved credentials

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000) {
    // Non-blocking wait with serial check
    if (Serial.available()) {
      handleSerial();
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.print("WiFi connected: ");
    Serial.println(WiFi.localIP());

    // Connect WebSocket to backend
    webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(3000);
  } else {
    wifiConnected = false;
    Serial.println("WiFi not available - Serial only mode");
  }
}

void checkWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiConnected) {
      wifiConnected = true;
      Serial.println("WiFi reconnected");
      webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
      webSocket.onEvent(webSocketEvent);
    }
  } else {
    if (wifiConnected) {
      wifiConnected = false;
      wsConnected = false;
      Serial.println("WiFi lost");
    }
  }
}

// ============================================================
//  WEBSOCKET HANDLER
// ============================================================

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("[WS] Disconnected");
      break;

    case WStype_CONNECTED:
      wsConnected = true;
      Serial.println("[WS] Connected to backend");
      webSocket.sendTXT("{\"type\":\"hello\",\"device\":\"esp32\"}");
      break;

    case WStype_TEXT:
      handleWSMessage((char*)payload);
      break;
  }
}

void handleWSMessage(const char* payload) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload);

  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  const char* type = doc["type"];
  if (!type) return;

  if (strcmp(type, "move") == 0) {
    JsonArray angles = doc["angles"];
    if (angles) {
      for (int i = 0; i < NUM_SERVOS && i < (int)angles.size(); i++) {
        float angle = angles[i];
        angle = constrain(angle, SERVO_MIN_ANGLE[i], SERVO_MAX_ANGLE[i]);
        targetAngles[i] = angle;
      }
    }
    if (doc.containsKey("speed")) {
      speedMultiplier = doc["speed"].as<float>() / 100.0;
      speedMultiplier = constrain(speedMultiplier, 0.1, 1.0);
    }
  } else if (strcmp(type, "gripper") == 0) {
    const char* state = doc["state"];
    if (state) {
      targetAngles[5] = (strcmp(state, "open") == 0) ? 90 : 0;
    }
  } else if (strcmp(type, "home") == 0) {
    for (int i = 0; i < NUM_SERVOS; i++) {
      targetAngles[i] = HOME_ANGLES[i];
    }
  } else if (strcmp(type, "zero") == 0) {
    for (int i = 0; i < NUM_SERVOS; i++) {
      targetAngles[i] = ZERO_ANGLES[i];
    }
  } else if (strcmp(type, "speed") == 0) {
    speedMultiplier = doc["value"].as<float>() / 100.0;
    speedMultiplier = constrain(speedMultiplier, 0.1, 1.0);
  }
}

// ============================================================
//  SERIAL HANDLER
// ============================================================

void handleSerial() {
  while (Serial.available()) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (serialBuffer.length() > 0) {
        processSerialCommand(serialBuffer);
        serialBuffer = "";
      }
    } else {
      serialBuffer += c;
      if (serialBuffer.length() > 256) {
        serialBuffer = ""; // Prevent buffer overflow
      }
    }
  }
}

void processSerialCommand(String& cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;

  lastSerialData = millis();
  serialConnected = true;

  // HELLO - Handshake
  if (cmd == "HELLO") {
    Serial.println("READY");
    return;
  }

  // S:a1,a2,a3,a4,a5,a6 - Set angles
  if (cmd.startsWith("S:")) {
    String angleStr = cmd.substring(2);
    int idx = 0;
    int start = 0;

    for (int i = 0; i <= (int)angleStr.length() && idx < NUM_SERVOS; i++) {
      if (i == (int)angleStr.length() || angleStr.charAt(i) == ',') {
        if (i > start) {
          float angle = angleStr.substring(start, i).toFloat();
          angle = constrain(angle, SERVO_MIN_ANGLE[idx], SERVO_MAX_ANGLE[idx]);
          targetAngles[idx] = angle;
        }
        idx++;
        start = i + 1;
      }
    }

    Serial.println("ACK");
    return;
  }

  // G:0 or G:1 - Gripper
  if (cmd.startsWith("G:")) {
    int state = cmd.substring(2).toInt();
    targetAngles[5] = (state == 1) ? 90 : 0;
    Serial.println("ACK");
    return;
  }

  // J:servo,diff - Jog servo for relative movements
  if (cmd.startsWith("J:")) {
    int comma = cmd.indexOf(',');
    if (comma > 2) {
      int servo = cmd.substring(2, comma).toInt();
      float diff = cmd.substring(comma + 1).toFloat();
      if (servo >= 0 && servo < NUM_SERVOS) {
        targetAngles[servo] += diff;
        targetAngles[servo] = constrain(targetAngles[servo], SERVO_MIN_ANGLE[servo], SERVO_MAX_ANGLE[servo]);
      }
    }
    Serial.println("ACK");
    return;
  }

  // M:HOME or M:ZERO - Preset positions
  if (cmd.startsWith("M:")) {
    String mode = cmd.substring(2);
    if (mode == "HOME") {
      for (int i = 0; i < NUM_SERVOS; i++) {
        targetAngles[i] = HOME_ANGLES[i];
      }
    } else if (mode == "ZERO") {
      for (int i = 0; i < NUM_SERVOS; i++) {
        targetAngles[i] = ZERO_ANGLES[i];
      }
    }
    Serial.println("ACK");
    return;
  }

  // SPD:value - Set speed
  if (cmd.startsWith("SPD:")) {
    int speed = cmd.substring(4).toInt();
    speedMultiplier = constrain(speed / 100.0, 0.1, 1.0);
    Serial.println("ACK");
    return;
  }

  // Unknown command
  Serial.println("ERR:Unknown command");
}

// ============================================================
//  MOTION CONTROL - Smooth Interpolation
// ============================================================

void updateMotion() {
  bool moved = false;
  float maxStep = maxDegreesPerUpdate * speedMultiplier;

  for (int i = 0; i < NUM_SERVOS; i++) {
    if (abs(currentAngles[i] - targetAngles[i]) > 0.1) {
      float diff = targetAngles[i] - currentAngles[i];

      // Limit step size for smooth motion
      if (abs(diff) > maxStep) {
        diff = (diff > 0) ? maxStep : -maxStep;
      }

      currentAngles[i] += diff;
      currentAngles[i] = constrain(currentAngles[i], SERVO_MIN_ANGLE[i], SERVO_MAX_ANGLE[i]);
      setServoAngle(i, currentAngles[i]);
      moved = true;
    }
  }
}

// ============================================================
//  SERVO CONTROL
// ============================================================

void setServoAngle(int servo, float angle) {
  if (servo < 0 || servo >= NUM_SERVOS) return;

  angle = constrain(angle, SERVO_MIN_ANGLE[servo], SERVO_MAX_ANGLE[servo]);

  // Convert angle to pulse width (µs)
  float pulseUs = map_float(angle,
    SERVO_MIN_ANGLE[servo], SERVO_MAX_ANGLE[servo],
    SERVO_MIN_US, SERVO_MAX_US);

  // Convert µs to PCA9685 tick count (4096 ticks per 20ms period)
  uint16_t tick = (uint16_t)(pulseUs / 20000.0 * 4096.0);

  pwm.setPWM(SERVO_CHANNELS[servo], 0, tick);
}

float map_float(float x, float in_min, float in_max, float out_min, float out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

// ============================================================
//  SENSOR READING
// ============================================================

void readSensors() {
  // Battery voltage (via voltage divider)
  int rawVoltage = analogRead(VOLTAGE_PIN);
  voltage = (rawVoltage / 4095.0) * VREF * VOLTAGE_DIVIDER;

  // Current sense (placeholder - depends on hardware)
  int rawCurrent = analogRead(ANALOG_PIN_1);
  current = (rawCurrent / 4095.0) * VREF; // Scale based on sensor

  // Internal temperature sensor
  temperature = temperatureRead();

  // CPU load estimate (based on loop timing)
  static unsigned long lastLoopTime = 0;
  unsigned long now = millis();
  if (lastLoopTime > 0) {
    unsigned long loopTime = now - lastLoopTime;
    cpuLoad = constrain((int)(loopTime * 100 / MOTION_UPDATE_MS), 0, 100);
  }
  lastLoopTime = now;

  // Free heap
  freeHeap = ESP.getFreeHeap();
}

// ============================================================
//  TELEMETRY
// ============================================================

void sendTelemetry() {
  // Compact format for serial: T:a1,a2,a3,a4,a5,a6,v,c,t,cpu,heap,rssi
  String telemetry = "T:";
  for (int i = 0; i < NUM_SERVOS; i++) {
    telemetry += String(currentAngles[i], 1);
    if (i < NUM_SERVOS - 1) telemetry += ",";
  }
  telemetry += "," + String(voltage, 2);
  telemetry += "," + String(current, 2);
  telemetry += "," + String(temperature, 1);
  telemetry += "," + String(cpuLoad);
  telemetry += "," + String(freeHeap);
  telemetry += "," + String(wifiConnected ? WiFi.RSSI() : 0);

  // Send via Serial (always)
  Serial.println(telemetry);

  // Send via WebSocket (if connected)
  if (wsConnected) {
    StaticJsonDocument<512> doc;
    doc["type"] = "telemetry";
    JsonArray angles = doc.createNestedArray("angles");
    for (int i = 0; i < NUM_SERVOS; i++) {
      angles.add(round(currentAngles[i] * 10) / 10.0);
    }
    doc["voltage"] = round(voltage * 100) / 100.0;
    doc["current"] = round(current * 100) / 100.0;
    doc["temp"] = round(temperature * 10) / 10.0;
    doc["cpu"] = cpuLoad;
    doc["heap"] = freeHeap;
    doc["rssi"] = wifiConnected ? WiFi.RSSI() : 0;

    String json;
    serializeJson(doc, json);
    webSocket.sendTXT(json);
  }
}
