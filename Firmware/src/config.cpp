#include "config.h"
#include <cstdio>

/************** DEVICE CONFIGURATION **************/
const char* DEVICE_ID  = "GH001";    // ID thiết bị (5 ký tự)
const char* DEVICE_KEY = "ABC123";   // KEY bảo mật (6 ký tự)

/************** WiFi & MQTT **************/
const char* WIFI_SSID = "PHONG 2";                 // fallback nếu chưa có cấu hình
const char* WIFI_PASS = "trandung03";              // fallback nếu chưa có cấu hình
const char* MQTT_HOST = "serverdung.ddns.net";     // IP PC chạy Mosquitto
const uint16_t MQTT_PORT = 1883;

/************** MQTT Topics **************/
char TOPIC_TELE[64];
char TOPIC_CFG[64];
char TOPIC_ACK[64];
char TOPIC_STATUS[64];
char TOPIC_ALARM[64];
char TOPIC_CMD[64];
char TOPIC_INFO[64];
char TOPIC_OTA[64];

void initMqttTopics() {
  snprintf(TOPIC_TELE,   sizeof(TOPIC_TELE),   "greenhouse/%s/telemetry", DEVICE_KEY);
  snprintf(TOPIC_CFG,    sizeof(TOPIC_CFG),    "greenhouse/%s/%s/config", DEVICE_KEY, DEVICE_ID);
  snprintf(TOPIC_ACK,    sizeof(TOPIC_ACK),    "greenhouse/%s/ack",       DEVICE_KEY);
  snprintf(TOPIC_STATUS, sizeof(TOPIC_STATUS), "greenhouse/%s/status",    DEVICE_KEY);
  snprintf(TOPIC_ALARM,  sizeof(TOPIC_ALARM),  "greenhouse/%s/alarm",     DEVICE_KEY);
  snprintf(TOPIC_CMD,    sizeof(TOPIC_CMD),    "greenhouse/%s/%s/cmd",    DEVICE_KEY, DEVICE_ID);
  snprintf(TOPIC_INFO,   sizeof(TOPIC_INFO),   "greenhouse/%s/%s/info",   DEVICE_KEY, DEVICE_ID);
  snprintf(TOPIC_OTA,    sizeof(TOPIC_OTA),    "greenhouse/%s/%s/ota",    DEVICE_KEY, DEVICE_ID);
}

