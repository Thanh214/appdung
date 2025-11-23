#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <Arduino.h>
#include <PubSubClient.h>

// Initialize MQTT client
void initMqtt();

// Ensure MQTT connection (with auto-reconnect)
void ensureMQTT();

// MQTT message callback
void onMqttMsg(char* topic, byte* payload, unsigned int len);

// Publish telemetry data
void publishTelemetry(float temp, float hum, float soil, bool r1, bool r2, float tThr, float sThr);

// Publish firmware info
void publishFirmwareInfo();

// Publish relay alarm (when relay state changes)
void publishRelayAlarm(bool r1, bool r2, float temp, float soil);

// Publish ACK response
void publishAck(float tThr, float sThr, int8_t r1Mode, int8_t r2Mode);

// Publish current config (thresholds)
void publishConfig(float tThr, float sThr);

// Handle activation request from mobile app
void handleActivationRequest(const String& payload);

// FreeRTOS task for MQTT communication
void taskMqtt(void* param);

// Get MQTT client reference
PubSubClient& getMqttClient();

#endif // MQTT_HANDLER_H

