#include "lcd_display.h"
#include "config.h"
#include "ota_update.h"
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>

extern SemaphoreHandle_t dataMutex;

// Global state
extern volatile float g_tempC, g_hum, g_soilPct;
extern volatile bool g_r1, g_r2;
extern volatile Page g_page;
extern volatile float g_editThrTemp, g_editThrSoil;
extern volatile int g_otaUpdateAvailable;
extern volatile bool g_otaInProgress;
extern const char* DEVICE_ID;
extern const char* DEVICE_KEY;

static LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
static char lastRow0[17] = {0};
static char lastRow1[17] = {0};

void initLCD() {
  Wire.begin(21, 22);
  Wire.setClock(400000);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  memset(lastRow0, 0, sizeof(lastRow0));
  memset(lastRow1, 0, sizeof(lastRow1));
}

void lcdPrintRow(uint8_t row, const char* txt) {
  char buf[17];
  memset(buf, ' ', 16);
  buf[16] = '\0';
  strncpy(buf, txt, 16);
  
  char* last = (row == 0) ? lastRow0 : lastRow1;
  
  // Only update if content changed (reduce flicker)
  if (strncmp(buf, last, 16) != 0) {
    memcpy(last, buf, 16);
    lcd.setCursor(0, row);
    lcd.print(buf);
  }
}

void lcdClear() {
  lcd.clear();
  memset(lastRow0, 0, sizeof(lastRow0));
  memset(lastRow1, 0, sizeof(lastRow1));
}

Page getCurrentPage() {
  Page pg;
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  pg = g_page;
  xSemaphoreGive(dataMutex);
  return pg;
}

void setCurrentPage(Page page) {
  xSemaphoreTake(dataMutex, portMAX_DELAY);
  g_page = page;
  xSemaphoreGive(dataMutex);
}

void taskDisplay(void* param) {
  const TickType_t period = pdMS_TO_TICKS(DISPLAY_UPDATE_INTERVAL_MS);
  TickType_t next = xTaskGetTickCount();
  bool blink = false;
  const char deg = (char)223; // ° symbol on LCD HD44780
  
  for (;;) {
    blink = !blink;
    
    // Read current state
    xSemaphoreTake(dataMutex, portMAX_DELAY);
    float t = g_tempC;
    float h = g_hum;
    float s = g_soilPct;
    bool r1 = g_r1;
    bool r2 = g_r2;
    Page pg = g_page;
    float ett = g_editThrTemp;
    float ess = g_editThrSoil;
    int otaStatus = g_otaUpdateAvailable;
    bool otaInProg = g_otaInProgress;
    xSemaphoreGive(dataMutex);
    
    char line0[17], line1[17];
    
    if (pg == PAGE_HOME) {
      // Home screen: Temperature, Humidity, Soil, Relay status
      snprintf(line0, sizeof(line0), "T:%4.1f%cC  H:%3.0f%%", 
               isnan(t) ? -99.9 : t, deg, isnan(h) ? -1.0 : h);
      
      // Relay indicators: F=Fan, P=Pump (uppercase=ON, blinking lowercase=OFF)
      char f = r1 ? 'F' : (blink ? ' ' : 'f');
      char p = r2 ? 'P' : (blink ? ' ' : 'p');
      
      if (isnan(s)) {
        snprintf(line1, sizeof(line1), "Soil: -- %% %c%c", f, p);
      } else {
        snprintf(line1, sizeof(line1), "Soil:%3.0f%% %c%c", s, f, p);
      }
      
    } else if (pg == PAGE_SET_TEMP) {
      // Temperature threshold setting screen
      snprintf(line0, sizeof(line0), "Set Tthr (C)   ");
      snprintf(line1, sizeof(line1), "Now:%4.1f%s", ett, blink ? " *" : "  ");
      
    } else if (pg == PAGE_SET_SOIL) {
      // Soil threshold setting screen
      snprintf(line0, sizeof(line0), "Set Soil thr %c ", '%');
      snprintf(line1, sizeof(line1), "Now:%3.0f%s", ess, blink ? " *" : "  ");
      
    } else if (pg == PAGE_INFO) {
      // Device info screen - Hiển thị KEY để user kích hoạt app
      snprintf(line0, sizeof(line0), "KEY: %s", DEVICE_KEY);
      snprintf(line1, sizeof(line1), "ID:  %s", DEVICE_ID);
      
    } else if (pg == PAGE_OTA_CHECK) {
      // OTA update check screen
      if (otaInProg) {
        // OTA in progress (will be handled by performOTA)
        snprintf(line0, sizeof(line0), "OTA UPDATE");
        snprintf(line1, sizeof(line1), "Please wait...");
        
      } else if (otaStatus == -1) {
        // Not checked yet - trigger check
        snprintf(line0, sizeof(line0), "Checking...%s", blink ? "*" : " ");
        snprintf(line1, sizeof(line1), "FW: %s", FW_VERSION);
        
        // Trigger update check (non-blocking)
        xSemaphoreTake(dataMutex, portMAX_DELAY);
        g_otaUpdateAvailable = checkForUpdate();
        xSemaphoreGive(dataMutex);
        
      } else if (otaStatus == 1) {
        // Update available
        snprintf(line0, sizeof(line0), "Update Ready!%s", blink ? "*" : " ");
        snprintf(line1, sizeof(line1), "Press SET");
        
      } else if (otaStatus == 0) {
        // Already latest version
        snprintf(line0, sizeof(line0), "FW: %s", FW_VERSION);
        snprintf(line1, sizeof(line1), "Already latest!");
        
      } else {
        // Error checking (-1 returned from error)
        snprintf(line0, sizeof(line0), "Check Failed");
        snprintf(line1, sizeof(line1), "Server error");
      }
    }
    
    lcdPrintRow(0, line0);
    lcdPrintRow(1, line1);
    
    vTaskDelayUntil(&next, period);
  }
}

