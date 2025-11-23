#include "ota_update.h"
#include "config.h"
#include "lcd_display.h"
#include <HTTPClient.h>
#include <Update.h>
#include <esp_ota_ops.h>
#include <esp_task_wdt.h>
#include <ArduinoJson.h>

extern TaskHandle_t hTaskSensors;
extern TaskHandle_t hTaskControl;
extern TaskHandle_t hTaskDisplay;
extern TaskHandle_t hTaskButtons;
extern TaskHandle_t hTaskMqtt;

extern volatile bool g_otaInProgress;
static QueueHandle_t qOtaCommand = NULL;

void initOTA() {
  // Create queue for OTA commands (size = 1, only 1 command at a time)
  qOtaCommand = xQueueCreate(1, sizeof(OtaCommand));
}

QueueHandle_t getOtaQueue() {
  return qOtaCommand;
}

void triggerOTA(const char* url) {
  Serial.println("[OTA] triggerOTA() called");
  
  if (qOtaCommand == NULL) {
    Serial.println("[OTA] ERROR: OTA queue not initialized!");
    return;
  }
  
  OtaCommand cmd;
  
  if (url == nullptr) {
    cmd.useDefaultUrl = true;
    Serial.println("[OTA] Using default URL");
  } else {
    cmd.useDefaultUrl = false;
    strncpy(cmd.url, url, sizeof(cmd.url) - 1);
    cmd.url[sizeof(cmd.url) - 1] = '\0';
    Serial.printf("[OTA] Using custom URL: %s\n", cmd.url);
  }
  
  // Send to queue (non-blocking)
  BaseType_t result = xQueueSend(qOtaCommand, &cmd, 0);
  
  if (result == pdTRUE) {
    Serial.println("[OTA] Command sent to queue successfully");
  } else {
    Serial.println("[OTA] ERROR: Failed to send command to queue (queue full?)");
  }
}

void performOTA(const char* url) {
  Serial.println("[OTA] performOTA() called");
  
  if (g_otaInProgress) {
    Serial.println("[OTA] WARNING: OTA already in progress, skipping");
    return;
  }
  
  // Use default URL if nullptr
  if (url == nullptr) {
    url = OTA_URL;
  }
  
  Serial.printf("[OTA] Starting OTA update from: %s\n", url);
  g_otaInProgress = true;
  
  // Check partition scheme
  const esp_partition_t* update_partition = esp_ota_get_next_update_partition(NULL);
  
  if (update_partition == NULL) {
    lcdPrintRow(0, "OTA FAILED");
    lcdPrintRow(1, "No OTA Partition");
    delay(3000);
    g_otaInProgress = false;
    ESP.restart();
    return;
  }
  
  // Suspend all other tasks
  if (hTaskSensors) vTaskSuspend(hTaskSensors);
  if (hTaskControl) vTaskSuspend(hTaskControl);
  if (hTaskDisplay) vTaskSuspend(hTaskDisplay);
  if (hTaskButtons) vTaskSuspend(hTaskButtons);
  if (hTaskMqtt)    vTaskSuspend(hTaskMqtt);
  vTaskDelay(pdMS_TO_TICKS(100));
  
  // Turn off all relays (safety)
  digitalWrite(RELAY1_PIN, RELAY_OFF);
  digitalWrite(RELAY2_PIN, RELAY_OFF);
  
  lcdClear();
  lcdPrintRow(0, "OTA UPDATE      ");
  lcdPrintRow(1, "Connecting...   ");
  
  HTTPClient http;
  http.begin(url);
  http.setTimeout(30000); // 30s timeout
  
  int httpCode = http.GET();
  
  if (httpCode != HTTP_CODE_OK) {
    lcdPrintRow(0, "OTA FAILED      ");
    lcdPrintRow(1, "Server Error    ");
    delay(3000);
    
    // Resume tasks
    if (hTaskSensors) vTaskResume(hTaskSensors);
    if (hTaskControl) vTaskResume(hTaskControl);
    if (hTaskDisplay) vTaskResume(hTaskDisplay);
    if (hTaskButtons) vTaskResume(hTaskButtons);
    if (hTaskMqtt)    vTaskResume(hTaskMqtt);
    
    g_otaInProgress = false;
    http.end();
    ESP.restart();
    return;
  }
  
  int contentLength = http.getSize();
  
  if (contentLength <= 0) {
    lcdPrintRow(0, "OTA FAILED      ");
    lcdPrintRow(1, "No Content      ");
    delay(3000);
    g_otaInProgress = false;
    http.end();
    ESP.restart();
    return;
  }
  
  bool canBegin = Update.begin(contentLength);
  
  if (!canBegin) {
    lcdPrintRow(0, "OTA FAILED      ");
    lcdPrintRow(1, "Not enough space");
    delay(3000);
    g_otaInProgress = false;
    http.end();
    ESP.restart();
    return;
  }
  
  // Download and flash
  WiFiClient* stream = http.getStreamPtr();
  size_t written = 0;
  uint8_t buff[OTA_BUFFER_SIZE];
  int lastPercent = -1;
  unsigned long lastUpdate = millis();
  unsigned long lastWatchdogFeed = millis();
  
  while (http.connected() && (written < contentLength)) {
    // Feed watchdog every 1 second
    unsigned long now = millis();
    if (now - lastWatchdogFeed > 1000) {
      esp_task_wdt_reset();
      lastWatchdogFeed = now;
    }
    
    size_t available = stream->available();
    
    if (available) {
      int c = stream->readBytes(buff, min(available, sizeof(buff)));
      
      if (c > 0) {
        Update.write(buff, c);
        written += c;
        
        // Update progress on LCD (throttle to 500ms)
        int percent = (written * 100) / contentLength;
        if (percent != lastPercent && (now - lastUpdate > 500)) {
          lastPercent = percent;
          lastUpdate = now;
          
          // Line 0: Updating XX%
          char line0[17];
          snprintf(line0, sizeof(line0), "Updating %3d%%", percent);
          lcdPrintRow(0, line0);
          
          // Line 1: Progress bar [========>   ]
          char line1[17];
          int barLength = 14;
          int filled = (percent * barLength) / 100;
          
          line1[0] = '[';
          for (int i = 0; i < barLength; i++) {
            if (i < filled - 1) {
              line1[i + 1] = '=';
            } else if (i == filled - 1 && filled > 0) {
              line1[i + 1] = '>';
            } else {
              line1[i + 1] = ' ';
            }
          }
          line1[15] = ']';
          line1[16] = '\0';
          
          lcdPrintRow(1, line1);
        }
      }
    }
    
    vTaskDelay(pdMS_TO_TICKS(10));
  }
  
  http.end();
  
  lcdClear();
  
  if (Update.end(true)) {
    // Validate firmware
    const esp_partition_t* update_partition = esp_ota_get_next_update_partition(NULL);
    if (update_partition != NULL) {
      esp_ota_set_boot_partition(update_partition);
    }
    
    lcdPrintRow(0, "OTA SUCCESS");
    lcdPrintRow(1, "Rebooting...");
    delay(2000);
    ESP.restart();
  } else {
    int err = Update.getError();
    lcdPrintRow(0, "OTA FAILED");
    char errLine[17];
    snprintf(errLine, sizeof(errLine), "Error: %d", err);
    lcdPrintRow(1, errLine);
    delay(3000);
    g_otaInProgress = false;
    ESP.restart();
  }
}

void validateOTAFirmware() {
  const esp_partition_t* running = esp_ota_get_running_partition();
  esp_ota_img_states_t ota_state;
  
  if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
    if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
      lcdPrintRow(0, "New FW Detected");
      lcdPrintRow(1, "Validating...   ");
      delay(1000);
      
      if (esp_ota_mark_app_valid_cancel_rollback() == ESP_OK) {
        lcdPrintRow(1, "FW Valid!       ");
      } else {
        lcdPrintRow(1, "Validation Fail ");
      }
      delay(1000);
    }
  }
}

String getLatestVersion() {
  HTTPClient http;
  http.begin(OTA_VERSION_URL);
  http.setTimeout(10000);
  
  int httpCode = http.GET();
  
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    http.end();
    
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload);
    
    if (error) {
      // JSON parse error
      return "";
    }
    
    // Parse JSON response from PHP API: {"success": true, "data": {"version": "1.2.1", ...}}
    // Hoặc từ file JSON trực tiếp: {"version": "1.2.1", ...}
    const char* version = nullptr;
    
    // Thử parse từ PHP API format trước (có "data" wrapper)
    if (!doc["success"].isNull() && doc["data"].is<JsonObject>()) {
      JsonObject data = doc["data"];
      version = data["version"];
    } else {
      // Fallback: parse từ file JSON trực tiếp
      version = doc["version"];
    }
    
    if (version != nullptr) {
      return String(version);
    }
    
    return "";
  }
  
  http.end();
  return "";
}

int checkForUpdate() {
  String latestVersion = getLatestVersion();
  
  if (latestVersion.length() == 0) {
    return -1;  // Error checking version
  }
  
  String currentVersion = FW_VERSION;
  
  if (latestVersion != currentVersion) {
    return 1;  // Update available
  }
  
  return 0;  // Already latest version
}

void taskOTA(void* param) {
  Serial.println("[OTA Task] Started and ready to receive commands");
  
  OtaCommand cmd;
  
  for (;;) {
    // Wait for OTA command from queue (blocking - will wait indefinitely)
    // xQueueReceive with portMAX_DELAY will block until data arrives, so no CPU waste
    if (xQueueReceive(qOtaCommand, &cmd, portMAX_DELAY) == pdTRUE) {
      Serial.println("[OTA Task] Received OTA command from queue!");
      
      // Perform OTA
      if (cmd.useDefaultUrl) {
        Serial.printf("[OTA Task] Starting OTA with default URL: %s\n", OTA_URL);
        performOTA(OTA_URL);
      } else {
        Serial.printf("[OTA Task] Starting OTA with custom URL: %s\n", cmd.url);
        performOTA(cmd.url);
      }
      
      // After OTA completes, ESP will restart
      Serial.println("[OTA Task] OTA completed, waiting before restart...");
      vTaskDelay(pdMS_TO_TICKS(5000));
    }
  }
}

