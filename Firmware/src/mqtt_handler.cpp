#include "mqtt_handler.h"
#include "config.h"
#include "wifi_manager.h"
#include "ota_update.h"
#include "relay_control.h"
#include <WiFi.h>
#include <Preferences.h>

extern Preferences prefs;
extern SemaphoreHandle_t dataMutex;
extern volatile float g_thrTemp, g_thrSoil;
extern volatile int8_t g_forceR1, g_forceR2;

static WiFiClient espClient;
static PubSubClient mqtt(espClient);

void initMqtt() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMsg);
  mqtt.setBufferSize(512);
}

PubSubClient& getMqttClient() {
  return mqtt;
}

void publishFirmwareInfo() {
  char buf[256];
  snprintf(buf, sizeof(buf), 
    "{\"ok\":true,\"id\":\"%s\",\"key\":\"%s\",\"version\":\"%s\",\"build_date\":\"%s\",\"build_time\":\"%s\",\"fw_ver\":\"%s\"}", 
    DEVICE_ID, DEVICE_KEY, FW_VERSION, FW_BUILD_DATE, FW_BUILD_TIME, FW_VERSION);
  mqtt.publish(TOPIC_INFO, buf, false);
}

void publishTelemetry(float temp, float hum, float soil, bool r1, bool r2, float tThr, float sThr) {
  char buf[256];
  snprintf(buf, sizeof(buf),
    "{\"id\":\"%s\",\"key\":\"%s\",\"temp\":%.1f,\"hum\":%.0f,\"soil\":%.0f,\"r1\":%d,\"r2\":%d,\"t_thr\":%.1f,\"s_thr\":%.0f}",
    DEVICE_ID, DEVICE_KEY, 
    isnan(temp) ? -99.9 : temp, 
    isnan(hum) ? -1.0 : hum, 
    isnan(soil) ? -1.0 : soil, 
    r1 ? 1 : 0, r2 ? 1 : 0, 
    tThr, sThr);
  mqtt.publish(TOPIC_TELE, buf, true);
}

void publishRelayAlarm(bool r1, bool r2, float temp, float soil) {
  char buf[192];
  snprintf(buf, sizeof(buf), 
    "{\"id\":\"%s\",\"key\":\"%s\",\"r1\":%d,\"r2\":%d,\"temp\":%.1f,\"soil\":%.0f}",
    DEVICE_ID, DEVICE_KEY, r1 ? 1 : 0, r2 ? 1 : 0, 
    isnan(temp) ? -99.9 : temp, 
    isnan(soil) ? -1.0 : soil);
  mqtt.publish(TOPIC_ALARM, buf, false);
}

void publishAck(float tThr, float sThr, int8_t r1Mode, int8_t r2Mode) {
  char buf[192];
  snprintf(buf, sizeof(buf), 
    "{\"ok\":true,\"id\":\"%s\",\"key\":\"%s\",\"t_thr\":%.1f,\"s_thr\":%.0f,\"r1\":%d,\"r2\":%d}", 
    DEVICE_ID, DEVICE_KEY, tThr, sThr, (int)r1Mode, (int)r2Mode);
  mqtt.publish(TOPIC_ACK, buf, false);
}

void publishConfig(float tThr, float sThr) {
  char buf[128];
  snprintf(buf, sizeof(buf), 
    "{\"t_thr\":%.1f,\"s_thr\":%.0f}", 
    tThr, sThr);
  mqtt.publish(TOPIC_CFG, buf, false);
}

void handleActivationRequest(const String& payload) {
  // Parse fingerprint from payload
  String fingerprint = "";
  int fpPos = payload.indexOf("\"fingerprint\":\"");
  if (fpPos >= 0) {
    int startPos = fpPos + 15; // length of "fingerprint":"
    int endPos = payload.indexOf("\"", startPos);
    if (endPos > startPos) {
      fingerprint = payload.substring(startPos, endPos);
    }
  }
  
  // Get WiFi MAC address
  String macAddr = WiFi.macAddress();
  macAddr.replace(":", "");
  macAddr.toUpperCase();
  
  // Get device uptime
  unsigned long uptime = millis() / 1000;
  
  // Publish activation response
  char buf[384];
  snprintf(buf, sizeof(buf), 
    "{\"cmd\":\"activation_response\",\"ok\":true,\"id\":\"%s\",\"key\":\"%s\",\"version\":\"%s\","
    "\"mac\":\"%s\",\"uptime\":%lu,\"fingerprint\":\"%s\",\"timestamp\":%lu}",
    DEVICE_ID, DEVICE_KEY, FW_VERSION, 
    macAddr.c_str(), uptime, fingerprint.c_str(), millis());
  
  mqtt.publish(TOPIC_ACK, buf, false);
  
  Serial.printf("[ACTIVATION] Request from fingerprint: %s\n", fingerprint.c_str());
  Serial.printf("[ACTIVATION] Response sent with MAC: %s\n", macAddr.c_str());
}

void onMqttMsg(char* topic, byte* payload, unsigned int len) {
  String s;
  s.reserve(len);
  for (unsigned int i = 0; i < len; i++) {
    s += (char)payload[i];
  }
  s.replace(" ", "");
  s.replace("\n", "");
  
  // Command: get_info
  if (s.indexOf("\"cmd\":\"get_info\"") >= 0) {
    publishFirmwareInfo();
    return;
  }
  
  // Command: activate (for app activation)
  if (s.indexOf("\"cmd\":\"activate\"") >= 0) {
    handleActivationRequest(s);
    return;
  }
  
  // Command: get_config
  if (s.indexOf("\"cmd\":\"get_config\"") >= 0) {
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    float tThr = g_thrTemp;
    float sThr = g_thrSoil;
    xSemaphoreGive(dataMutex);
    publishConfig(tThr, sThr);
    return;
  }
  
  // Command: OTA update
  if (s.indexOf("\"cmd\":\"ota\"") >= 0 || strcmp(topic, TOPIC_OTA) == 0) {
    triggerOTA();
    return;
  }
  
  // Parse threshold and relay commands
  float t = -1, m = -1;
  int tpos = s.indexOf("\"t_thr\":");
  if (tpos >= 0) {
    int p = tpos + 8;
    t = s.substring(p).toFloat();
  }
  
  int mpos = s.indexOf("\"s_thr\":");
  if (mpos >= 0) {
    int p = mpos + 8;
    m = s.substring(p).toFloat();
  }
  
  // Manual relay commands: {"r1":0/1}, {"r2":0/1}, or {"r1":"auto"}
  int r1pos = s.indexOf("\"r1\":");
  int r2pos = s.indexOf("\"r2\":");
  int8_t cmdR1 = -2; // -2=no cmd, -1=auto, 0=off, 1=on
  int8_t cmdR2 = -2;
  
  if (r1pos >= 0) {
    String tail = s.substring(r1pos + 5);
    if (tail.startsWith("\"auto\"")) {
      cmdR1 = -1;
    } else if (tail.length() > 0) {
      char c = tail.charAt(0);
      if (c == '0' || c == '1') {
        cmdR1 = (c == '1') ? 1 : 0;
      }
    }
  }
  
  if (r2pos >= 0) {
    String tail = s.substring(r2pos + 5);
    if (tail.startsWith("\"auto\"")) {
      cmdR2 = -1;
    } else if (tail.length() > 0) {
      char c = tail.charAt(0);
      if (c == '0' || c == '1') {
        cmdR2 = (c == '1') ? 1 : 0;
      }
    }
  }
  
  // Apply changes
  bool changed = false;
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  
  if (t >= 0.0f) {
    g_thrTemp = constrain(t, 20.0f, 60.0f);
    changed = true;
  }
  
  if (m >= 0.0f) {
    g_thrSoil = constrain(m, 10.0f, 90.0f);
    changed = true;
  }
  
  if (cmdR1 != -2) {
    g_forceR1 = cmdR1;
    changed = true;
  }
  
  if (cmdR2 != -2) {
    g_forceR2 = cmdR2;
    changed = true;
  }
  
  float tThr = g_thrTemp;
  float sThr = g_thrSoil;
  int8_t r1Mode = g_forceR1;
  int8_t r2Mode = g_forceR2;
  
  xSemaphoreGive(dataMutex);
  
  // Save to NVS if thresholds changed
  if (changed && (t >= 0.0f || m >= 0.0f)) {
    prefs.begin("cfg", false);
    if (t >= 0.0f) prefs.putFloat("thrT", tThr);
    if (m >= 0.0f) prefs.putFloat("thrS", sThr);
    prefs.end();
  }
  
  // Send ACK
  if (changed) {
    publishAck(tThr, sThr, r1Mode, r2Mode);
  }
}

void ensureMQTT() {
  if (!mqtt.connected()) {
    String cid = String("esp32-") + String(DEVICE_ID);
    static uint32_t backoff = 1000;
    
    // Last Will Testament
    char lw[128];
    snprintf(lw, sizeof(lw), "{\"online\":false,\"id\":\"%s\",\"key\":\"%s\"}", DEVICE_ID, DEVICE_KEY);
    
    if (mqtt.connect(cid.c_str(), TOPIC_STATUS, 0 /*qos*/, true /*retain*/, lw)) {
      // Subscribe to topics
      mqtt.subscribe(TOPIC_CFG);
      mqtt.subscribe(TOPIC_CMD);
      mqtt.subscribe(TOPIC_OTA);
      
      // Publish online status
      char st[128];
      snprintf(st, sizeof(st), "{\"online\":true,\"id\":\"%s\",\"key\":\"%s\"}", DEVICE_ID, DEVICE_KEY);
      mqtt.publish(TOPIC_STATUS, st, true);
      
      backoff = 1000;
    } else {
      delay(backoff);
      backoff = backoff * 2;
      if (backoff > 10000) backoff = 10000;
    }
  }
}

void taskMqtt(void* param) {
  const TickType_t loopPeriod = pdMS_TO_TICKS(MQTT_LOOP_INTERVAL_MS);
  const TickType_t pubPeriod = pdMS_TO_TICKS(MQTT_PUBLISH_INTERVAL_MS);
  TickType_t nextLoop = xTaskGetTickCount();
  TickType_t nextPub = xTaskGetTickCount();
  
  for (;;) {
    // Check WiFi timeout and maybe start portal
    extern void checkWiFiTimeout();
    checkWiFiTimeout();
    
    // Ensure WiFi and MQTT connection
    if (!isPortalActive()) {
      ensureWiFi();
    } else {
      maybeRunPortal();
    }
    
    if (isWiFiConnected()) {
      ensureMQTT();
    }
    
    mqtt.loop();
    
    // Publish telemetry periodically
    if (xTaskGetTickCount() - nextPub >= pubPeriod && mqtt.connected()) {
      nextPub = xTaskGetTickCount();
      
      extern volatile float g_tempC, g_hum, g_soilPct;
      extern volatile bool g_r1, g_r2;
      
      xSemaphoreTake(dataMutex, portMAX_DELAY);
      float t = g_tempC;
      float h = g_hum;
      float s = g_soilPct;
      float tt = g_thrTemp;
      float ss = g_thrSoil;
      bool r1 = g_r1;
      bool r2 = g_r2;
      xSemaphoreGive(dataMutex);
      
      publishTelemetry(t, h, s, r1, r2, tt, ss);
    }
    
    vTaskDelayUntil(&nextLoop, loopPeriod);
  }
}

