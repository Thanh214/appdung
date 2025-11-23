#ifndef LCD_DISPLAY_H
#define LCD_DISPLAY_H

#include <Arduino.h>

// Page/Screen enumeration
enum Page {
  PAGE_HOME = 0,
  PAGE_SET_TEMP,
  PAGE_SET_SOIL,
  PAGE_INFO,
  PAGE_OTA_CHECK
};

// Initialize LCD
void initLCD();

// Print to LCD row (with flicker reduction)
void lcdPrintRow(uint8_t row, const char* txt);

// Clear LCD
void lcdClear();

// Get current page
Page getCurrentPage();

// Set current page
void setCurrentPage(Page page);

// FreeRTOS task for display updates
void taskDisplay(void* param);

#endif // LCD_DISPLAY_H

