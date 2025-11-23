#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <DHT.h>

// Sensor data structure
struct SensorData {
  float tempC;
  float humidity;
  float soilPct;
};

// Initialize sensors
void initSensors();

// Read sensor values (non-blocking, returns filtered values)
SensorData readSensors();

// FreeRTOS task for continuous sensor reading
void taskSensors(void* param);

// Utility functions
float mapSoilPct(int adc);
int analogReadMedian(uint8_t pin, int nsamp = 7);

#endif // SENSORS_H

