#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

/************** FIRMWARE VERSION **************/
#define FW_VERSION "1.4.3"
#define FW_BUILD_DATE __DATE__
#define FW_BUILD_TIME __TIME__

/************** DEVICE CONFIGURATION **************/
extern const char* DEVICE_ID;
extern const char* DEVICE_KEY;

/************** WiFi & MQTT **************/
extern const char* WIFI_SSID;
extern const char* WIFI_PASS;
extern const char* MQTT_HOST;
extern const uint16_t MQTT_PORT;

/************** MQTT Topics **************/
extern char TOPIC_TELE[64];
extern char TOPIC_CFG[64];
extern char TOPIC_ACK[64];
extern char TOPIC_STATUS[64];
extern char TOPIC_ALARM[64];
extern char TOPIC_CMD[64];
extern char TOPIC_INFO[64];
extern char TOPIC_OTA[64];

/************** OTA Configuration **************/
#define OTA_URL "http://serverdung.ddns.net:8080/greenhouse/firmware/greenhouse_latest.bin"
#define OTA_VERSION_URL "http://serverdung.ddns.net:8080/greenhouse/version.php"
#define OTA_BUFFER_SIZE 1024
#define OTA_STACK_SIZE 8192
#define OTA_TASK_PRIORITY 5

/************** Hardware Pinout **************/
#define DHT_PIN     15
#define DHT_TYPE    DHT22
#define SOIL_PIN    34
#define RELAY1_PIN  32   // Quạt
#define RELAY2_PIN  33   // Bơm
#define BTN_MENU    25
#define BTN_UP      26
#define BTN_DOWN    27
#define BTN_SET     14
#define LCD_ADDR    0x38
#define LCD_COLS    16
#define LCD_ROWS    2

/************** Relay Logic **************/
#define RELAY_ACTIVE_LOW true
#define RELAY_ON  (RELAY_ACTIVE_LOW ? LOW : HIGH)
#define RELAY_OFF (RELAY_ACTIVE_LOW ? HIGH : LOW)

/************** Sensor Calibration **************/
#define ADC_WET 1300  // ướt hoàn toàn
#define ADC_DRY 3300  // khô ngoài không khí

/************** Control Parameters **************/
#define HYS_TEMP 1.0f  // Hysteresis nhiệt độ
#define HYS_SOIL 3.0f  // Hysteresis độ ẩm đất

/************** Timing Configuration **************/
#define SENSOR_READ_INTERVAL_MS 3000
#define CONTROL_LOOP_INTERVAL_MS 200
#define DISPLAY_UPDATE_INTERVAL_MS 500
#define BUTTON_SCAN_INTERVAL_MS 10
#define MQTT_LOOP_INTERVAL_MS 50
#define MQTT_PUBLISH_INTERVAL_MS 3000
#define BUTTON_DEBOUNCE_MS 30
#define BUTTON_REPEAT_DELAY_MS 220
#define WIFI_TIMEOUT_MS 30000

/************** WiFi Portal **************/
#define AP_SSID "Greenhouse_AP"
#define AP_IP "192.168.4.1"

// Initialize MQTT topics với KEY + ID
void initMqttTopics();

#endif // CONFIG_H

