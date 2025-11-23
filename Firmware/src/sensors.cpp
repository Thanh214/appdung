#include "sensors.h"
#include "config.h"

extern SemaphoreHandle_t dataMutex;
extern volatile float g_tempC, g_hum, g_soilPct;

static DHT dht(DHT_PIN, DHT_TYPE);

void initSensors() {
  dht.begin();
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
}

float mapSoilPct(int adc) {
  int x = constrain(adc, min(ADC_WET, ADC_DRY), max(ADC_WET, ADC_DRY));
  float pct = 100.0f * (float)(ADC_DRY - x) / (float)(ADC_DRY - ADC_WET);
  return constrain(pct, 0.0f, 100.0f);
}

int analogReadMedian(uint8_t pin, int nsamp) {
  int a[15];
  nsamp = constrain(nsamp, 3, 15);
  
  for (int i = 0; i < nsamp; i++) {
    a[i] = analogRead(pin);
    delayMicroseconds(500);
  }
  
  // Bubble sort
  for (int i = 0; i < nsamp - 1; i++) {
    for (int j = i + 1; j < nsamp; j++) {
      if (a[j] < a[i]) {
        int t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
    }
  }
  
  return a[nsamp / 2];
}

SensorData readSensors() {
  SensorData data;
  
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  data.tempC = g_tempC;
  data.humidity = g_hum;
  data.soilPct = g_soilPct;
  xSemaphoreGive(dataMutex);
  
  return data;
}

void taskSensors(void* param) {
  const TickType_t period = pdMS_TO_TICKS(SENSOR_READ_INTERVAL_MS);
  TickType_t next = xTaskGetTickCount();
  
  float filtT = NAN, filtH = NAN, filtSoil = NAN;
  
  for (;;) {
    // Read DHT sensor
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    bool ok = !(isnan(h) || isnan(t) || h < 0 || h > 100 || t < -40 || t > 85);
    
    // Read soil moisture
    int adc = analogReadMedian(SOIL_PIN, 7);
    float soil = mapSoilPct(adc);
    
    // Apply exponential moving average filter
    const float A = 0.3f;
    if (ok) {
      filtT = isnan(filtT) ? t : (A * t + (1 - A) * filtT);
      filtH = isnan(filtH) ? h : (A * h + (1 - A) * filtH);
    }
    filtSoil = isnan(filtSoil) ? soil : (0.2f * soil + 0.8f * filtSoil);
    
    // Update global state
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    if (ok) {
      g_tempC = filtT;
      g_hum = filtH;
    }
    g_soilPct = filtSoil;
    xSemaphoreGive(dataMutex);
    
    // Debug print every 10 readings
    static int debugCount = 0;
    if (++debugCount >= 10) {
      debugCount = 0;
      Serial.printf("[SENSORS] T=%.1f°C, H=%.1f%%, S=%.1f%% (DHT %s)\n", 
                   filtT, filtH, filtSoil, ok ? "OK" : "ERR");
    }
    
    vTaskDelayUntil(&next, period);
  }
}

