# Backend Server - Hệ thống Giám sát Nhà kính

Đây là backend server cho dự án nhà kính, đóng vai trò trung tâm trong việc thu thập, xử lý, và phân phối dữ liệu giữa thiết bị IoT (ESP32) và ứng dụng người dùng.

## Kiến trúc Tổng quan

Backend bao gồm hai thành phần chính hoạt động song song:

1.  **Web Server (Nền tảng PHP):** Cung cấp các RESTful API để xử lý các tác vụ bất đồng bộ như lưu trữ dữ liệu, cập nhật firmware, và cung cấp dữ liệu lịch sử.
2.  **MQTT Broker (Mosquitto):** Đảm nhiệm giao tiếp thời gian thực, cho phép gửi lệnh điều khiển và nhận dữ liệu cảm biến tức thì với độ trễ thấp.

---

## 1. Web Server (Thư mục `greenhouse`)

Thành phần này được xây dựng bằng PHP, không yêu cầu framework phức tạp, phù hợp cho các tác vụ API đơn giản.

### Các API Endpoints

#### `data_api.php`
*   **Mục đích:** Là cổng giao tiếp chính để lưu trữ và truy xuất dữ liệu.
*   **Phương thức `POST`:**
    *   **Chức năng:** Nhận dữ liệu từ thiết bị ESP32 và lưu vào file hoặc cơ sở dữ liệu. Dữ liệu thường ở định dạng JSON.
    *   **Luồng hoạt động:** ESP32 gửi một HTTP POST request chứa dữ liệu cảm biến (nhiệt độ, độ ẩm) đến endpoint này theo định kỳ.
*   **Phương thức `GET`:**
    *   **Chức năng:** Cung cấp dữ liệu lịch sử cho ứng dụng di động. Ứng dụng có thể truy vấn dữ liệu theo khoảng thời gian để vẽ biểu đồ.
    *   **Luồng hoạt động:** Ứng dụng di động gửi một HTTP GET request để lấy dữ liệu đã được lưu trữ.

#### `upload.php`
*   **Mục đích:** Xử lý việc tải lên các phiên bản firmware mới.
*   **Phương thức `POST`:**
    *   **Chức năng:** Nhận file firmware (`.bin`) và file phiên bản (`version.json`) từ script phía client (ví dụ: `upload_firmware.py`).
    *   **Luồng hoạt động:** Sau khi nhà phát triển build xong một phiên bản firmware mới, một script sẽ tự động hóa việc gửi file đến endpoint này. File `.bin` sẽ được lưu vào thư mục `firmware/`.
    *   **Bảo mật:** Cần có cơ chế xác thực (ví dụ: API key) để ngăn chặn việc upload trái phép.

#### `version.php`
*   **Mục đích:** Cung cấp thông tin phiên bản firmware mới nhất cho thiết bị.
*   **Phương thức `GET`:**
    *   **Chức năng:** Đọc file `version.json` (hoặc thông tin từ database) và trả về phiên bản firmware hiện tại và đường dẫn tải về.
    *   **Luồng hoạt động:** ESP32 định kỳ gọi đến API này để so sánh phiên bản firmware của nó với phiên bản trên server. Nếu có bản mới, nó sẽ bắt đầu quá trình cập nhật OTA.

### Cấu trúc Thư mục con

*   `data/`: Nơi lưu trữ các file dữ liệu (ví dụ: `log.txt`, `sensors.json`). Cần được cấp quyền ghi cho web server.
*   `firmware/`: Nơi chứa các file firmware `.bin` dùng cho OTA. Cần được cấp quyền ghi cho web server.
*   `.htaccess`: File cấu hình cho web server Apache/LiteSpeed, có thể dùng để rewrite URL cho đẹp hơn hoặc thiết lập các quy tắc bảo mật.

---

## 2. MQTT Broker (Thư mục `mosquitto`)

Sử dụng [Mosquitto](https://mosquitto.org/), một MQTT broker mã nguồn mở, nhẹ và hiệu quả.

### Chức năng

*   **Truyền dữ liệu thời gian thực:** Là cầu nối giao tiếp chính giữa ESP32 và ứng dụng di động. Dữ liệu cảm biến được `publish` từ ESP32 và ứng dụng `subscribe` để nhận ngay lập tức.
*   **Gửi lệnh điều khiển:** Ứng dụng di động `publish` các lệnh (ví dụ: bật/tắt relay) và ESP32 `subscribe` để nhận và thực thi các lệnh này.

### Chủ đề (Topics) MQTT (Ví dụ)

*   `greenhouse/sensor/data`: ESP32 publish dữ liệu cảm biến lên topic này.
*   `greenhouse/device/control`: Ứng dụng publish lệnh điều khiển đến topic này.
*   `greenhouse/device/status`: ESP32 publish trạng thái hoạt động (online/offline, trạng thái relay) lên topic này.

### Bảo mật (SSL/TLS)

Việc giao tiếp qua MQTT cần được mã hóa để đảm bảo an toàn.

*   **SSL/TLS:** Mosquitto được cấu hình để sử dụng chứng chỉ SSL/TLS, mã hóa toàn bộ dữ liệu truyền đi.
*   **Quản lý Chứng chỉ:**
    *   `SSL_CERTIFICATE_RENEWAL.md`: Tài liệu hướng dẫn các bước để tạo và gia hạn chứng chỉ SSL (ví dụ: sử dụng Let's Encrypt).
    *   `check-cert.ps1` & `renew-cert.ps1`: Các script PowerShell để tự động hóa việc kiểm tra và gia hạn chứng chỉ trên môi trường Windows Server. Trên Linux, có thể dùng cron job và certbot.

---

## Hướng dẫn Cài đặt và Triển khai

### Yêu cầu

*   Một server (VPS hoặc server vật lý) chạy Linux (khuyến nghị) hoặc Windows.
*   Web server có hỗ trợ PHP (Apache, Nginx).
*   Mosquitto MQTT Broker.
*   Tên miền (để sử dụng chứng chỉ SSL).

### Các bước triển khai

1.  **Cài đặt Web Server:**
    *   Cài đặt Apache/Nginx và PHP.
    *   Sao chép toàn bộ nội dung của thư mục `greenhouse` vào thư mục gốc của web server (ví dụ: `/var/www/html` trên Linux).
    *   Chạy lệnh `chmod -R 775 data/ firmware/` và `chown -R www-data:www-data data/ firmware/` (trên Linux) để cấp quyền ghi cho web server.

2.  **Cài đặt MQTT Broker:**
    *   Cài đặt Mosquitto từ package manager (`sudo apt install mosquitto mosquitto-clients`).
    *   Cấu hình Mosquitto để bật listener cho cả MQTT (port 1883) và WebSocket (port 9001, cho trình duyệt/app).
    *   Thực hiện cấu hình SSL/TLS theo hướng dẫn trong `SSL_CERTIFICATE_RENEWAL.md`.

3.  **Cấu hình Firewall:**
    *   Mở các port cần thiết: `80` (HTTP), `443` (HTTPS), `1883` (MQTT), `8883` (MQTTS), `9001` (WebSocket).

4.  **Cấu hình DNS:**
    *   Trỏ tên miền (và các subdomain nếu cần, ví dụ `mqtt.yourdomain.com`) về địa chỉ IP của server.