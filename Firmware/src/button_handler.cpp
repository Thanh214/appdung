#include "button_handler.h"
#include "config.h"
#include "lcd_display.h"
#include "relay_control.h"
#include "ota_update.h"
#include <Preferences.h>

extern SemaphoreHandle_t dataMutex;
extern Preferences prefs;

// Global state
extern volatile Page g_page;
extern volatile float g_thrTemp, g_thrSoil;
extern volatile float g_editThrTemp, g_editThrSoil;
extern volatile int g_otaUpdateAvailable;
extern volatile bool g_otaInProgress;

struct Btn {
  uint8_t pin;
  bool last;
  uint32_t lastDebounce;
};

void initButtons() {
  pinMode(BTN_MENU, INPUT_PULLUP);
  pinMode(BTN_UP,   INPUT_PULLUP);
  pinMode(BTN_DOWN, INPUT_PULLUP);
  pinMode(BTN_SET,  INPUT_PULLUP);
}

void taskButtons(void* param) {
  Btn b[4] = {
    {BTN_MENU, true, 0},
    {BTN_UP,   true, 0},
    {BTN_DOWN, true, 0},
    {BTN_SET,  true, 0}
  };
  
  const TickType_t period = pdMS_TO_TICKS(BUTTON_SCAN_INTERVAL_MS);
  TickType_t next = xTaskGetTickCount();
  
  for (;;) {
    for (int i = 0; i < 4; i++) {
      bool rd = digitalRead(b[i].pin);
      
      if (rd != b[i].last) {
        b[i].lastDebounce = millis();
        b[i].last = rd;
      } else if ((millis() - b[i].lastDebounce) > BUTTON_DEBOUNCE_MS && rd == LOW) {
        // Button pressed (active LOW)
        
        xSemaphoreTake(dataMutex, portMAX_DELAY);
        
        if (i == 0) {
          // MENU button - cycle through 5 pages
          Page np = (Page)(((int)g_page + 1) % 5);
          g_page = np;
          
          // Clear LCD when switching pages to prevent leftover characters
          xSemaphoreGive(dataMutex);
          lcdClear();
          xSemaphoreTake(dataMutex, portMAX_DELAY);
          
          if (np == PAGE_SET_TEMP) {
            g_editThrTemp = g_thrTemp;
          }
          if (np == PAGE_SET_SOIL) {
            g_editThrSoil = g_thrSoil;
          }
          if (np == PAGE_OTA_CHECK) {
            // Reset OTA check status when entering OTA page
            g_otaUpdateAvailable = -1;
          }
          
        } else if (i == 1) {
          // UP button - increase threshold value (only for SET pages)
          if (g_page == PAGE_SET_TEMP) {
            g_editThrTemp = constrain(g_editThrTemp + 0.5f, 20.0f, 60.0f);
          } else if (g_page == PAGE_SET_SOIL) {
            g_editThrSoil = constrain(g_editThrSoil + 1.0f, 10.0f, 90.0f);
          }
          
        } else if (i == 2) {
          // DOWN button - decrease threshold value (only for SET pages)
          if (g_page == PAGE_SET_TEMP) {
            g_editThrTemp = constrain(g_editThrTemp - 0.5f, 20.0f, 60.0f);
          } else if (g_page == PAGE_SET_SOIL) {
            g_editThrSoil = constrain(g_editThrSoil - 1.0f, 10.0f, 90.0f);
          }
          
        } else if (i == 3) {
          // SET button
          if (g_page == PAGE_SET_TEMP || g_page == PAGE_SET_SOIL) {
            // Apply and save thresholds
            if (g_thrTemp != g_editThrTemp || g_thrSoil != g_editThrSoil) {
              g_thrTemp = g_editThrTemp;
              g_thrSoil = g_editThrSoil;
              
              // Save to NVS
              prefs.begin("cfg", false);
              prefs.putFloat("thrT", g_thrTemp);
              prefs.putFloat("thrS", g_thrSoil);
              prefs.end();
            }
            g_page = PAGE_HOME;
            
          } else if (g_page == PAGE_OTA_CHECK) {
            // Trigger OTA update if available
            Serial.printf("[BTN] SET pressed on OTA page. Status=%d, InProgress=%d\n", 
                          g_otaUpdateAvailable, g_otaInProgress);
            
            if (g_otaUpdateAvailable == 1 && !g_otaInProgress) {
              Serial.println("[BTN] Triggering OTA update...");
              xSemaphoreGive(dataMutex);
              triggerOTA(nullptr);  // Trigger OTA update with default URL
              // Note: g_otaInProgress will be set inside performOTA()
              xSemaphoreTake(dataMutex, portMAX_DELAY);
            } else {
              Serial.println("[BTN] OTA update NOT triggered (conditions not met)");
            }
            // If already latest version (g_otaUpdateAvailable == 0), do nothing
          }
        }
        
        xSemaphoreGive(dataMutex);
        
        // Anti-repeat delay
        vTaskDelay(pdMS_TO_TICKS(BUTTON_REPEAT_DELAY_MS));
      }
    }
    
    vTaskDelayUntil(&next, period);
  }
}

