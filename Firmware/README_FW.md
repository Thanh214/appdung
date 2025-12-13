# Firmware cho Thiết bị Giám sát và Điều khiển Nhà kính

Đây là firmware cho thiết bị phần cứng (ESP32) của dự án giám sát và điều khiển nhà kính. Firmware được phát triển bằng PlatformIO và Arduino framework.

## Chức năng chính

*   **Kết nối Wi-Fi:** Tự động kết nối vào mạng Wi-Fi đã được cấu hình.
*   **Giao thức MQTT:** Giao tiếp với server qua giao thức MQTT để gửi dữ liệu cảm biến và nhận lệnh điều khiển.
*   **Đọc dữ liệu cảm biến:** Đọc dữ liệu nhiệt độ và độ ẩm từ cảm biến DHT.
*   **Điều khiển Relay:** Điều khiển các thiết bị ngoại vi (ví dụ: máy bơm, quạt) thông qua relay.
*   **Hiển thị LCD:** Hiển thị thông tin trạng thái, dữ liệu cảm biến lên màn hình LCD I2C.
*   **Nút bấm:** Xử lý sự kiện từ nút bấm để điều khiển trực tiếp trên thiết bị.
*   **Cập nhật qua OTA:** Hỗ trợ cập nhật firmware từ xa qua mạng (Over-the-Air).
*   **Giao tiếp HTTP:** Gửi dữ liệu lên server và kiểm tra phiên bản firmware mới.

## Cấu trúc thư mục

```
Firmware/
├── include/              # Các file header (.h)
│   ├── button_handler.h
│   ├── config.h
│   ├── http_client.h
│   ├── lcd_display.h
│   ├── mqtt_handler.h
│   ├── ota_update.h
│   ├── relay_control.h
│   ├── sensors.h
│   └── wifi_manager.h
├── lib/                  # Thư viện cục bộ (nếu có)
├── src/                  # Các file mã nguồn (.cpp)
│   ├── button_handler.cpp
│   ├── config.cpp
│   ├── http_client.cpp
│   ├── lcd_display.cpp
│   ├── main.cpp
│   ├── mqtt_handler.cpp
│   ├── ota_update.cpp
│   ├── relay_control.cpp
│   ├── sensors.cpp
│   └── wifi_manager.cpp
├── platformio.ini        # File cấu hình của PlatformIO
├── post_build.py         # Script chạy sau khi build
└── upload_firmware.py    # Script để upload firmware
```

## Các thư viện sử dụng

*   [PubSubClient](https://github.com/knolleary/pubsubclient): Thư viện MQTT client.
*   [LiquidCrystal\_I2C](https://github.com/marcoschwartz/LiquidCrystal_I2C): Thư viện giao tiếp với màn hình LCD qua I2C.
*   [DHT sensor library](https://github.com/adafruit/DHT-sensor-library): Thư viện đọc dữ liệu từ cảm biến DHT.
*   [Adafruit Unified Sensor](https://github.com/adafruit/Adafruit_Unified_Sensor): Thư viện cơ sở cho các cảm biến của Adafruit.
*   [ArduinoJson](https://github.com/bblanchon/ArduinoJson): Thư viện xử lý dữ liệu JSON.

## Các hàm quan trọng

### `main.cpp`

*   `setup()`: Khởi tạo Wi-Fi, MQTT, cảm biến, LCD, và các chân GPIO.
*   `loop()`: Vòng lặp chính của chương trình, xử lý các tác vụ lặp lại như đọc cảm biến, gửi dữ liệu, và kiểm tra kết nối.

### `wifi_manager.cpp`

*   `setupWiFi()`: Kết nối vào mạng Wi-Fi đã được cấu hình.

### `mqtt_handler.cpp`

*   `setupMqtt()`: Khởi tạo MQTT client và kết nối đến MQTT broker.
*   `mqttCallback()`: Xử lý các tin nhắn MQTT nhận được.
*   `publishData()`: Gửi dữ liệu cảm biến lên MQTT broker.
*   `reconnectMqtt()`: Tự động kết nối lại MQTT broker nếu mất kết nối.

### `sensors.cpp`

*   `setupSensors()`: Khởi tạo cảm biến.
*   `readSensors()`: Đọc giá trị từ cảm biến và lưu vào các biến.

### `relay_control.cpp`

*   `setupRelays()`: Khởi tạo các chân điều khiển relay.
*   `controlRelay()`: Bật/tắt relay theo yêu cầu.

### `lcd_display.cpp`

*   `setupLcd()`: Khởi tạo màn hình LCD.
*   `displayData()`: Hiển thị thông tin lên màn hình LCD.

### `button_handler.cpp`

*   `setupButtons()`: Khởi tạo các chân nút bấm.
*   `handleButtons()`: Xử lý sự kiện khi có nút bấm được nhấn.

### `ota_update.cpp`

*   `setupOta()`: Khởi tạo chức năng OTA.
*   `handleOtaUpdate()`: Xử lý quá trình cập nhật firmware qua OTA.

### `http_client.cpp`

*   `checkFirmwareVersion()`: Gửi yêu cầu HTTP đến server để kiểm tra phiên bản firmware mới.
*   `sendDataToServer()`: Gửi dữ liệu lên server thông qua HTTP POST.

## Hướng dẫn sử dụng

1.  **Cài đặt PlatformIO:** Cài đặt [PlatformIO IDE](https://platformio.org/platformio-ide) cho Visual Studio Code.
2.  **Mở dự án:** Mở thư mục `Firmware` bằng PlatformIO.
3.  **Cấu hình:** Chỉnh sửa file `config.h` với thông tin Wi-Fi, MQTT broker, và các thông số khác.
4.  **Build:** Build dự án bằng cách nhấn vào nút "Build" (dấu tick) trên thanh công cụ của PlatformIO.
5.  **Upload:** Kết nối ESP32 với máy tính và upload firmware bằng cách nhấn vào nút "Upload" (mũi tên sang phải).

## Scripts

*   `post_build.py`: Script này được chạy tự động sau khi build thành công. Nó có nhiệm vụ tạo file firmware `.bin` để chuẩn bị cho việc upload OTA.
*   `upload_firmware.py`: Script này dùng để upload file firmware `.bin` lên server, phục vụ cho việc cập nhật OTA.
