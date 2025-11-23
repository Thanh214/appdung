#include "http_client.h"
#include "config.h"
#include "wifi_manager.h"

// Global variables
TaskHandle_t hTaskHttpPost = NULL;
bool g_httpEnabled = true;

// External variables
extern SemaphoreHandle_t dataMutex;
extern volatile float g_tempC, g_hum, g_soilPct;
extern volatile bool g_r1, g_r2;
extern const char* DEVICE_ID;

void initHttpClient() {
  Serial.println("[HTTP] HTTP Client initialized");
}

bool postSensorData(float temp, float hum, float soil, bool r1, bool r2, const char* deviceId) {
  if (!isWiFiConnected()) {
    return false;
  }
  
  HTTPClient http;
  http.begin(HTTP_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT);
  
  // Create JSON payload
  JsonDocument doc;
  doc["id"] = deviceId;
  doc["temp"] = temp;
  doc["hum"] = hum;
  doc["soil"] = soil;
  doc["r1"] = r1 ? 1 : 0;
  doc["r2"] = r2 ? 1 : 0;
  doc["timestamp"] = millis();
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.printf("[HTTP] Posting data: %s\n", payload.c_str());
  
  int httpCode = http.POST(payload);
  bool success = false;
  
  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP] Response code: %d\n", httpCode);
    
    if (httpCode == 200) {
      Serial.println("[HTTP] Data posted successfully");
      success = true;
    } else {
      Serial.printf("[HTTP] Server error: %s\n", response.c_str());
    }
  } else {
    Serial.printf("[HTTP] Connection error: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
  return success;
}

void taskHttpPost(void* param) {
  const TickType_t period = pdMS_TO_TICKS(HTTP_POST_INTERVAL_MS);
  TickType_t next = xTaskGetTickCount();
  
  // Wait for WiFi to be ready
  Serial.println("[HTTP] Waiting for WiFi connection...");
  while (!isWiFiConnected()) {
    vTaskDelay(pdMS_TO_TICKS(5000)); // Check every 5 seconds
  }
  Serial.println("[HTTP] WiFi connected, starting HTTP posting...");
  
  for (;;) {
    if (g_httpEnabled && isWiFiConnected()) {
      // Get current sensor data
      float temp, hum, soil;
      bool r1, r2;
      
      xSemaphoreTake(dataMutex, portMAX_DELAY);
      temp = g_tempC;
      hum = g_hum;
      soil = g_soilPct;
      r1 = g_r1;
      r2 = g_r2;
      xSemaphoreGive(dataMutex);
      
      // Only post if we have valid data
      if (!isnan(temp) && !isnan(hum) && !isnan(soil)) {
        Serial.printf("[HTTP] Posting: T=%.1f°C, H=%.1f%%, S=%.1f%%, R1=%d, R2=%d\n", 
                     temp, hum, soil, r1 ? 1 : 0, r2 ? 1 : 0);
        postSensorData(temp, hum, soil, r1, r2, DEVICE_ID);
      } else {
        Serial.printf("[HTTP] Skipping post - invalid sensor data: T=%.1f, H=%.1f, S=%.1f\n", 
                     temp, hum, soil);
      }
    } else if (!g_httpEnabled) {
      Serial.println("[HTTP] HTTP posting disabled");
    } else {
      Serial.println("[HTTP] WiFi not connected, skipping post");
    }
    
    vTaskDelayUntil(&next, period);
  }
}
