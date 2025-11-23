#include <Arduino.h>
#include <Preferences.h>

// Include all module headers
#include "config.h"
#include "sensors.h"
#include "relay_control.h"
#include "lcd_display.h"
#include "wifi_manager.h"
#include "mqtt_handler.h"
#include "ota_update.h"
#include "button_handler.h"
#include "http_client.h"

/************** Global Variables **************/
// NVS Storage
Preferences prefs;

// FreeRTOS synchronization
SemaphoreHandle_t dataMutex;

// Task handles
TaskHandle_t hTaskSensors = NULL;
TaskHandle_t hTaskControl = NULL;
TaskHandle_t hTaskDisplay = NULL;
TaskHandle_t hTaskButtons = NULL;
TaskHandle_t hTaskMqtt = NULL;
TaskHandle_t hTaskOTA = NULL;

// Runtime state (shared across modules)
volatile float g_tempC = NAN;
volatile float g_hum = NAN;
volatile float g_soilPct = NAN;
volatile bool g_r1 = false;
volatile bool g_r2 = false;

// Thresholds (active)
volatile float g_thrTemp = NAN;
volatile float g_thrSoil = NAN;

// Thresholds (editing draft)
volatile float g_editThrTemp = 38.0f;
volatile float g_editThrSoil = 60.0f;

// Manual override: -1 = auto, 0 = OFF, 1 = ON
volatile int8_t g_forceR1 = -1;
volatile int8_t g_forceR2 = -1;

// UI state
volatile Page g_page = PAGE_HOME;

// OTA update check status
volatile int g_otaUpdateAvailable = -1;  // -1 = not checked, 0 = no update, 1 = update available
volatile bool g_otaInProgress = false;

/************** Setup Function **************/
void setup() {
  // Initialize Serial
  Serial.begin(115200);
  Serial.println("\n\n========================================");
  Serial.println("    Greenhouse IoT System v" FW_VERSION);
  Serial.println("    Build: " FW_BUILD_DATE " " FW_BUILD_TIME);
  Serial.println("========================================\n");
  
  // Hardware Test
  Serial.println("[TEST] Hardware Configuration:");
  Serial.printf("  DHT Pin: %d (Type: DHT%d)\n", DHT_PIN, DHT_TYPE);
  Serial.printf("  Soil Pin: %d\n", SOIL_PIN);
  Serial.printf("  Relay 1 (Fan): %d\n", RELAY1_PIN);
  Serial.printf("  Relay 2 (Pump): %d\n", RELAY2_PIN);
  Serial.printf("  LCD Address: 0x%02X (%dx%d)\n", LCD_ADDR, LCD_COLS, LCD_ROWS);
  Serial.printf("  Buttons: MENU=%d, UP=%d, DOWN=%d, SET=%d\n", 
                BTN_MENU, BTN_UP, BTN_DOWN, BTN_SET);
  
  Serial.println("\n[TEST] System Configuration:");
  Serial.printf("  Relay Active: %s\n", RELAY_ACTIVE_LOW ? "LOW" : "HIGH");
  Serial.printf("  Soil Calibration: WET=%d, DRY=%d\n", ADC_WET, ADC_DRY);
  Serial.printf("  Hysteresis: TEMP=%.1f°C, SOIL=%.1f%%\n", HYS_TEMP, HYS_SOIL);
  
  Serial.println("\n[TEST] Task Intervals:");
  Serial.printf("  Sensor Read: %dms\n", SENSOR_READ_INTERVAL_MS);
  Serial.printf("  Control Loop: %dms\n", CONTROL_LOOP_INTERVAL_MS);
  Serial.printf("  Display Update: %dms\n", DISPLAY_UPDATE_INTERVAL_MS);
  Serial.printf("  MQTT Publish: %dms\n", MQTT_PUBLISH_INTERVAL_MS);
  
  Serial.println("\n[TEST] OTA Configuration:");
  Serial.printf("  URL: %s\n", OTA_URL);
  Serial.printf("  Version URL: %s\n", OTA_VERSION_URL);
  Serial.printf("  Buffer Size: %d bytes\n", OTA_BUFFER_SIZE);
  Serial.printf("  Stack Size: %d bytes\n", OTA_STACK_SIZE);
  
  Serial.println("\n[TEST] Memory:");
  Serial.printf("  Free Heap: %d bytes\n", ESP.getFreeHeap());
  Serial.printf("  Heap Size: %d bytes\n", ESP.getHeapSize());
  Serial.printf("  PSRAM: %s\n", ESP.getPsramSize() > 0 ? "Available" : "Not Available");
  
  Serial.println("\n[INIT] Starting initialization...\n");
  
  // Initialize LCD first (for status messages)
  initLCD();
  lcdPrintRow(0, "Greenhouse IoT ");
  lcdPrintRow(1, "Booting...      ");
  
  // Validate OTA firmware (if just updated)
  validateOTAFirmware();
  
  // Initialize hardware
  initRelays();
  initSensors();
  initButtons();
  
  // Initialize MQTT topics
  initMqttTopics();
  
  // Initialize communication
  initWiFiManager();
  loadWifiCreds();
  initMqtt();
  
  // Initialize OTA system
  initOTA();
  
  // Initialize HTTP client
  initHttpClient();
  
  // Create mutex for shared data BEFORE loading config
  dataMutex = xSemaphoreCreateMutex();
  
  // Load configuration from NVS
  loadThresholds();
  
  // Initialize edit thresholds
  Thresholds thr = getThresholds();
  g_editThrTemp = thr.temp;
  g_editThrSoil = thr.soil;
  
  // Start core tasks first
  xTaskCreatePinnedToCore(taskSensors, "sensors", 4096, NULL, 2, &hTaskSensors, 1);
  xTaskCreatePinnedToCore(taskControl, "control", 3072, NULL, 3, &hTaskControl, 1);
  xTaskCreatePinnedToCore(taskDisplay, "display", 4096, NULL, 1, &hTaskDisplay, 1);
  xTaskCreatePinnedToCore(taskButtons, "buttons", 3072, NULL, 2, &hTaskButtons, 1);
  
  // Start communication tasks
  xTaskCreatePinnedToCore(taskMqtt, "mqtt", 6144, NULL, 2, &hTaskMqtt, 0);
  xTaskCreatePinnedToCore(taskOTA, "ota", OTA_STACK_SIZE, NULL, OTA_TASK_PRIORITY, &hTaskOTA, 0);
  
  // Start HTTP post task with delay to let sensors initialize
  vTaskDelay(pdMS_TO_TICKS(5000)); // Wait 5 seconds
  xTaskCreatePinnedToCore(taskHttpPost, "http_post", 6144, NULL, 1, &hTaskHttpPost, 0);
}

/************** Loop Function **************/
void loop() {
  // All work is done in FreeRTOS tasks
  // Main loop just yields to avoid watchdog issues
  vTaskDelay(pdMS_TO_TICKS(1000));
}
