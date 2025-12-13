# Hướng dẫn Lắp đặt và Cấu hình Hệ thống Nhà kính Mini

Dự án này bao gồm 4 thành phần chính:
1.  **Mạch điều khiển:** Thiết bị điện tử trung tâm dựa trên ESP32, được thiết kế bằng Altium.
2.  **Firmware:** Chương trình chạy trên ESP32, được viết bằng C++ trên nền tảng Arduino và quản lý bằng PlatformIO.
3.  **Server:** Backend viết bằng PHP để xử lý dữ liệu, API và cập nhật Firmware qua mạng (OTA).
4.  **Mobile App:** Ứng dụng di động được viết bằng React Native (Expo) để người dùng giám sát và điều khiển.

---

## 1. Lắp đặt phần cứng mô hình
Phần cứng bao gồm một mạch điều khiển trung tâm được thiết kế riêng (file thiết kế trong thư mục `dinhdung`). Các linh kiện chính cần kết nối vào mạch bao gồm:
- **Vi điều khiển:** ESP32 DevKit.
- **Cảm biến:**
    - Cảm biến nhiệt độ và độ ẩm không khí: `DHT22`.
    - Cảm biến độ ẩm đất.
- **Thiết bị chấp hành:**
    - Module Relay 2 kênh để điều khiển `máy bơm` và `quạt`.
- **Giao diện người dùng:**
    - Màn hình `LCD 16x2 I2C` để hiển thị thông tin.
    - 4 nút nhấn (`MENU`, `UP`, `DOWN`, `SET`) để cấu hình trực tiếp trên thiết bị.

*Quy trình làm mạch thực tế:*
1.  Sử dụng file thiết kế trong thư mục `dinhdung` để đặt hoặc tự làm mạch in (PCB).
2.  Hàn các linh kiện lên PCB theo đúng sơ đồ.
3.  Kết nối các cảm biến và thiết bị chấp hành vào các chân đã được định nghĩa trong file `Firmware/include/config.h`.

---

## 2. Cấu hình kết nối mạng và server
Hệ thống sử dụng WiFi để kết nối và MQTT làm giao thức chính để trao đổi dữ liệu giữa thiết bị và ứng dụng di động.

#### Cấu hình WiFi cho thiết bị
- Lần đầu tiên khởi động, thiết bị ESP32 sẽ không tìm thấy mạng WiFi đã lưu. Nó sẽ tự động tạo một điểm truy cập (Access Point) có tên là **`Greenhouse_AP`**.
- Dùng điện thoại hoặc máy tính kết nối vào mạng WiFi này.
- Sau khi kết nối, một trang cấu hình (Captive Portal) sẽ tự động hiện lên.
- Nhập tên (SSID) và mật khẩu của mạng WiFi nhà bạn vào trang này và lưu lại.
- Thiết bị sẽ khởi động lại và tự động kết nối vào mạng WiFi bạn vừa cấu hình.

#### Cấu hình MQTT Broker và API server
- **MQTT Broker:** Đã được cấu hình sẵn trong code của Firmware và Mobile App để trỏ tới `serverdung.ddns.net` qua cổng `9001` (WebSocket) và `9002` (Secure WebSocket).
- **API Server:** Địa chỉ server cho việc cập nhật OTA và API cũng được trỏ tới `http://serverdung.ddns.net:8080/greenhouse/`.
- Các file backend PHP nằm trong thư mục `server/greenhouse` của dự án. Để hệ thống hoạt động, các file này cần được triển khai trên một web server có hỗ trợ PHP.

---

## 3. Cài đặt phần mềm giám sát

#### Cài đặt và cấu hình firmware trên ESP32
1.  **Môi trường:** Cài đặt [Visual Studio Code](https://code.visualstudio.com/) với extension [PlatformIO IDE](https://platformio.org/platformio-ide).
2.  **Mở dự án:** Mở thư mục `Firmware` bằng VS Code. PlatformIO sẽ tự động nhận diện và cài đặt các thư viện cần thiết đã được định nghĩa trong file `platformio.ini`.
3.  **Cấu hình (Tùy chọn):** Các thông số về chân phần cứng, địa chỉ server OTA, và các thông số mặc định khác có thể được xem và chỉnh sửa trong file `Firmware/include/config.h`. Tuy nhiên, các thông tin nhạy cảm như WiFi và MQTT được cấu hình qua portal.
4.  **Biên dịch & Nạp code:**
    - Kết nối ESP32 với máy tính qua cổng USB.
    - Trong giao diện PlatformIO, chọn đúng môi trường `esp32dev` và nhấn nút `Upload`.

#### Cài đặt và cấu hình App di động
1.  **Môi trường:** Cài đặt [Node.js](https://nodejs.org/en) và [Expo Go](https://expo.dev/go) trên điện thoại di động của bạn.
2.  **Cài đặt thư viện:** Mở terminal trong thư mục `mobile` và chạy lệnh `npm install` để cài đặt các gói phụ thuộc.
3.  **Chạy ứng dụng:**
    - Chạy lệnh `npm start` trong thư mục `mobile`.
    - Một mã QR sẽ hiện ra trên terminal.
    - Mở ứng dụng Expo Go trên điện thoại và quét mã QR để tải và chạy ứng dụng.
4.  **Cấu hình kết nối:**
    - Trên ứng dụng, bạn cần nhập `Device ID` và `Device Key`. Các giá trị này phải trùng khớp với những gì được cấu hình trong firmware của thiết bị ESP32 để có thể giao tiếp được.

---

## 4. Thiết lập ngưỡng và chế độ làm việc

#### Thiết lập ngưỡng nhiệt độ, độ ẩm đất
- Ngưỡng nhiệt độ và độ ẩm đất có thể được cài đặt trực tiếp trên ứng dụng di động.
- Các giá trị này được gửi tới thiết bị qua MQTT và được dùng trong chế độ điều khiển tự động.

#### Cấu hình chế độ Auto/Manual, cảnh báo
- **Chế độ hoạt động:**
    - **Auto:** Hệ thống tự động bật/tắt máy bơm và quạt dựa trên các ngưỡng đã thiết lập.
    - **Manual:** Người dùng có thể bật/tắt máy bơm và quạt trực tiếp từ ứng dụng di động.
- **Cảnh báo:** Ứng dụng sẽ gửi thông báo (notification) tới điện thoại người dùng khi các chỉ số môi trường vượt ra ngoài ngưỡng an toàn đã được cấu hình.