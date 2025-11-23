#include "relay_control.h"
#include "config.h"
#include "mqtt_handler.h"
#include <Preferences.h>

extern SemaphoreHandle_t dataMutex;
extern Preferences prefs;

// Global state (shared with other modules)
extern volatile float g_tempC, g_hum, g_soilPct;
extern volatile bool g_r1, g_r2;
extern volatile float g_thrTemp, g_thrSoil;
extern volatile int8_t g_forceR1, g_forceR2;

void initRelays() {
  pinMode(RELAY1_PIN, OUTPUT);
  pinMode(RELAY2_PIN, OUTPUT);
  digitalWrite(RELAY1_PIN, RELAY_OFF);
  digitalWrite(RELAY2_PIN, RELAY_OFF);
}

RelayState getRelayState() {
  RelayState state;
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  state.r1 = g_r1;
  state.r2 = g_r2;
  xSemaphoreGive(dataMutex);
  return state;
}

void setRelayState(bool r1, bool r2) {
  digitalWrite(RELAY1_PIN, r1 ? RELAY_ON : RELAY_OFF);
  digitalWrite(RELAY2_PIN, r2 ? RELAY_ON : RELAY_OFF);
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  g_r1 = r1;
  g_r2 = r2;
  xSemaphoreGive(dataMutex);
}

void setRelayForceMode(int8_t r1Mode, int8_t r2Mode) {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  g_forceR1 = r1Mode;
  g_forceR2 = r2Mode;
  xSemaphoreGive(dataMutex);
}

Thresholds getThresholds() {
  Thresholds thr;
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  thr.temp = g_thrTemp;
  thr.soil = g_thrSoil;
  xSemaphoreGive(dataMutex);
  return thr;
}

void setThresholds(float temp, float soil) {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  g_thrTemp = constrain(temp, 20.0f, 60.0f);
  g_thrSoil = constrain(soil, 10.0f, 90.0f);
  xSemaphoreGive(dataMutex);
  
  // Save to NVS
  prefs.begin("cfg", false);
  prefs.putFloat("thrT", g_thrTemp);
  prefs.putFloat("thrS", g_thrSoil);
  prefs.end();
}

void loadThresholds() {
  prefs.begin("cfg", true);
  float t = prefs.getFloat("thrT", NAN);
  float s = prefs.getFloat("thrS", NAN);
  prefs.end();
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  g_thrTemp = isnan(t) ? 38.0f : t;
  g_thrSoil = isnan(s) ? 60.0f : s;
  xSemaphoreGive(dataMutex);
}

void taskControl(void* param) {
  const TickType_t period = pdMS_TO_TICKS(CONTROL_LOOP_INTERVAL_MS);
  TickType_t next = xTaskGetTickCount();
  
  for (;;) {
    // Read current state
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    float t = g_tempC;
    float soil = g_soilPct;
    float tthr = g_thrTemp;
    float sthr = g_thrSoil;
    bool r1 = g_r1;
    bool r2 = g_r2;
    int8_t fr1 = g_forceR1;
    int8_t fr2 = g_forceR2;
    xSemaphoreGive(dataMutex);
    
    bool prevR1 = r1;
    bool prevR2 = r2;
    
    // Control Relay 1 (Fan) - Temperature control
    if (fr1 >= 0) {
      r1 = (fr1 == 1);  // Manual mode
    } else if (!isnan(t)) {
      // Auto mode with hysteresis
      if (!r1 && t > tthr) {
        r1 = true;  // Turn ON if temp exceeds threshold
      } else if (r1 && t < tthr - HYS_TEMP) {
        r1 = false;  // Turn OFF if temp drops below (threshold - hysteresis)
      }
    }
    
    // Control Relay 2 (Pump) - Soil moisture control
    if (fr2 >= 0) {
      r2 = (fr2 == 1);  // Manual mode
    } else if (!isnan(soil)) {
      // Auto mode with hysteresis
      if (!r2 && soil < sthr) {
        r2 = true;  // Turn ON if soil is dry
      } else if (r2 && soil > sthr + HYS_SOIL) {
        r2 = false;  // Turn OFF if soil is wet enough
      }
    }
    
    // Update relay outputs
    digitalWrite(RELAY1_PIN, r1 ? RELAY_ON : RELAY_OFF);
    digitalWrite(RELAY2_PIN, r2 ? RELAY_ON : RELAY_OFF);
    
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    g_r1 = r1;
    g_r2 = r2;
    xSemaphoreGive(dataMutex);
    
    // Publish alarm if state changed
    if ((r1 != prevR1) || (r2 != prevR2)) {
      publishRelayAlarm(r1, r2, t, soil);
    }
    
    vTaskDelayUntil(&next, period);
  }
}

