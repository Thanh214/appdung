#ifndef BUTTON_HANDLER_H
#define BUTTON_HANDLER_H

#include <Arduino.h>

// Initialize button pins
void initButtons();

// FreeRTOS task for button handling
void taskButtons(void* param);

#endif // BUTTON_HANDLER_H

