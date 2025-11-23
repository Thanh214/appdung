#ifndef RELAY_CONTROL_H
#define RELAY_CONTROL_H

#include <Arduino.h>

// Relay state structure
struct RelayState {
  bool r1;  // Relay 1 (Fan)
  bool r2;  // Relay 2 (Pump)
};

// Control mode: -1 = auto, 0 = OFF, 1 = ON
struct RelayForceMode {
  int8_t r1;
  int8_t r2;
};

// Threshold values
struct Thresholds {
  float temp;
  float soil;
};

// Initialize relay pins
void initRelays();

// Get current relay state
RelayState getRelayState();

// Set relay state
void setRelayState(bool r1, bool r2);

// Set force mode for manual control
void setRelayForceMode(int8_t r1Mode, int8_t r2Mode);

// Get current thresholds
Thresholds getThresholds();

// Set thresholds and save to NVS
void setThresholds(float temp, float soil);

// Load thresholds from NVS
void loadThresholds();

// FreeRTOS task for automatic relay control
void taskControl(void* param);

#endif // RELAY_CONTROL_H

