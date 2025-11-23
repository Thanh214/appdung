#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// HTTP API configuration
#define HTTP_API_URL "http://serverdung.ddns.net:8080/greenhouse/data_api.php"
#define HTTP_TIMEOUT 10000
#define HTTP_POST_INTERVAL_MS 60000  // Gửi lên server mỗi 1 phút (60000ms)

// Function declarations
void initHttpClient();
bool postSensorData(float temp, float hum, float soil, bool r1, bool r2, const char* deviceId);
void taskHttpPost(void* param);

// Global variables
extern TaskHandle_t hTaskHttpPost;
extern bool g_httpEnabled;

#endif // HTTP_CLIENT_H
