#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

// Initialize WiFi manager
void initWiFiManager();

// Load WiFi credentials from NVS
void loadWifiCreds();

// Save WiFi credentials to NVS
void saveWifiCreds(const String& ssid, const String& pass);

// Connect to WiFi
void wifiConnect();

// Ensure WiFi connection (with auto-retry)
void ensureWiFi();

// Start Access Point portal for WiFi configuration
void startApPortal();

// Handle web portal requests (call in loop)
void maybeRunPortal();

// Check if portal is active
bool isPortalActive();

// Get WiFi status
bool isWiFiConnected();

#endif // WIFI_MANAGER_H

