#ifndef OTA_UPDATE_H
#define OTA_UPDATE_H

#include <Arduino.h>

// OTA Command structure
struct OtaCommand {
  char url[256];
  bool useDefaultUrl;
};

// Initialize OTA system
void initOTA();

// Perform OTA update (blocking operation)
void performOTA(const char* url = nullptr);

// Trigger OTA update (sends command to OTA task queue)
void triggerOTA(const char* url = nullptr);

// Validate firmware after OTA boot
void validateOTAFirmware();

// FreeRTOS task for OTA updates
void taskOTA(void* param);

// Get OTA queue handle
QueueHandle_t getOtaQueue();

// Check for firmware update availability
// Returns: 1 if update available, 0 if current version is latest, -1 on error
int checkForUpdate();

// Get latest version string from server
String getLatestVersion();

#endif // OTA_UPDATE_H

