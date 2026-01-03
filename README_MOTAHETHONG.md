# MÔ TẢ HỆ THỐNG NHÀ KÍNH THÔNG MINH

## 🎯 TỔNG QUAN

Hệ thống giám sát và điều khiển nhà kính tự động dựa trên IoT, cho phép người dùng theo dõi và quản lý môi trường nhà kính từ xa thông qua ứng dụng di động.

---

## 🔍 VẤN ĐỀ GIẢI QUYẾT

### 1. **Giám sát môi trường liên tục**
- Theo dõi nhiệt độ, độ ẩm không khí và độ ẩm đất 24/7
- Không cần phải có mặt tại nhà kính để kiểm tra

### 2. **Điều khiển từ xa**
- Bật/tắt máy bơm tưới và quạt thông gió từ bất kỳ đâu
- Tiết kiệm thời gian và công sức

### 3. **Tự động hóa**
- Hệ thống tự động bật máy bơm khi đất khô
- Tự động bật quạt khi nhiệt độ cao
- Giảm thiểu can thiệp thủ công

### 4. **Cảnh báo kịp thời**
- Nhận thông báo ngay khi môi trường bất thường
- Phòng tránh thiệt hại cho cây trồng

### 5. **Lưu trữ và phân tích**
- Xem lại lịch sử dữ liệu qua biểu đồ
- Phân tích xu hướng để tối ưu hóa canh tác

---

## 🏗️ KIẾN TRÚC HỆ THỐNG

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   ESP32     │ ◄─────► │    MQTT     │ ◄─────► │  Mobile App │
│  (Thiết bị) │         │   Broker    │         │ (Người dùng)│
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                        │
       │                       │                        │
       └───────────────────────┴────────────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │   Web Server    │
                      │   + Database    │
                      └─────────────────┘
```

---

## 🎛️ CÁC THÀNH PHẦN CHÍNH

### 1. **Thiết bị ESP32 (Firmware)**
**Vai trò:** Bộ não của hệ thống tại nhà kính

**Phần cứng:**
- Vi điều khiển: ESP32 DevKit
- Cảm biến DHT22 (nhiệt độ, độ ẩm không khí)
- Cảm biến độ ẩm đất
- Module Relay 2 kênh (điều khiển máy bơm, quạt)
- Màn hình LCD 16x2 I2C
- 4 nút nhấn (MENU, UP, DOWN, SET)

**Chức năng:**
- ✅ Đọc dữ liệu từ cảm biến mỗi 5 giây
- ✅ Gửi dữ liệu realtime qua MQTT
- ✅ Nhận lệnh điều khiển từ app
- ✅ Bật/tắt relay theo lệnh hoặc tự động
- ✅ Hiển thị thông tin lên LCD
- ✅ Cấu hình trực tiếp qua nút nhấn
- ✅ Lưu dữ liệu lên server mỗi 5 phút
- ✅ Tự động cập nhật firmware qua OTA

### 2. **MQTT Broker (Mosquitto)**
**Vai trò:** Trung tâm giao tiếp realtime

**Chức năng:**
- ✅ Nhận dữ liệu từ ESP32 và chuyển đến app
- ✅ Nhận lệnh từ app và chuyển đến ESP32
- ✅ Đảm bảo giao tiếp nhanh, độ trễ thấp
- ✅ Hỗ trợ nhiều thiết bị cùng lúc

**Cổng kết nối:**
- Port 9001: WebSocket (cho app)
- Port 9002: WebSocket Secure
- Port 1883: MQTT TCP
- Port 8883: MQTT SSL

### 3. **Web Server (PHP)**
**Vai trò:** Lưu trữ và quản lý dữ liệu lâu dài

**API Endpoints:**
- `data_api.php`: Nhận và trả về dữ liệu cảm biến
- `upload.php`: Upload firmware mới
- `version.php`: Kiểm tra phiên bản firmware

**Chức năng:**
- ✅ Lưu trữ dữ liệu cảm biến vào database
- ✅ Cung cấp dữ liệu lịch sử cho app
- ✅ Quản lý firmware cho OTA update
- ✅ Quản lý danh sách thiết bị

**Lưu trữ:**
- File JSON: `sensors_log.json`, `devices.json`
- MySQL: `sensor_data`, `devices`, `firmware_versions`

### 4. **Mobile App (React Native/Expo)**
**Vai trò:** Giao diện người dùng

**Màn hình chính:**

**📊 Dashboard (Trang chủ)**
- Hiển thị dữ liệu realtime: nhiệt độ, độ ẩm, độ ẩm đất
- Nút bật/tắt máy bơm và quạt
- Hiển thị trạng thái thiết bị (online/offline)
- Chế độ Auto/Manual

**📈 Charts (Biểu đồ)**
- Xem lịch sử dữ liệu theo ngày
- Biểu đồ nhiệt độ, độ ẩm, độ ẩm đất
- Trục X: thời gian, Trục Y: giá trị
- Hiển thị min/max

**⚙️ Settings (Cài đặt)**
- Cấu hình Device ID & Key
- Đặt ngưỡng cảnh báo
- Cấu hình chế độ Auto/Manual
- Kiểm tra phiên bản firmware
- Kích hoạt OTA update

**🔔 Notifications (Thông báo)**
- Danh sách cảnh báo
- Thông báo khi nhiệt độ/độ ẩm vượt ngưỡng
- Thông báo khi thiết bị offline

**Chức năng:**
- ✅ Kết nối MQTT để nhận dữ liệu realtime
- ✅ Gửi lệnh điều khiển đến ESP32
- ✅ Lưu lịch sử 7 ngày gần nhất
- ✅ Hiển thị biểu đồ trực quan
- ✅ Gửi push notification
- ✅ Lưu trữ bảo mật Device ID & Key

---

## ⚙️ CHỨC NĂNG CHI TIẾT

### 1. **Giám sát môi trường**
- **Tần suất:** Mỗi 5 giây
- **Dữ liệu:** Nhiệt độ (°C), độ ẩm không khí (%), độ ẩm đất (%)
- **Hiển thị:** 
  - Realtime trên app
  - Trên màn hình LCD của thiết bị
  - Biểu đồ lịch sử

### 2. **Điều khiển thiết bị**

**Chế độ Manual (Thủ công):**
- Người dùng bật/tắt máy bơm và quạt từ app
- Lệnh gửi qua MQTT, phản hồi ngay lập tức

**Chế độ Auto (Tự động):**
- Máy bơm tự động bật khi độ ẩm đất < ngưỡng
- Quạt tự động bật khi nhiệt độ > ngưỡng
- Tự động tắt khi đạt ngưỡng mong muốn

### 3. **Cảnh báo thông minh**
- Nhiệt độ quá cao/thấp
- Độ ẩm đất quá thấp (cây thiếu nước)
- Độ ẩm không khí bất thường
- Thiết bị mất kết nối

### 4. **Lưu trữ và phân tích**
- Lưu dữ liệu mỗi 5 phút vào server
- Lưu trữ lâu dài trong database
- Xem lại lịch sử theo ngày
- Biểu đồ trực quan với trục thời gian

### 5. **Cập nhật từ xa (OTA)**
- Kiểm tra firmware mới mỗi giờ
- Tự động tải và cài đặt
- Không cần kết nối USB
- Cập nhật tính năng mới dễ dàng

### 6. **Cấu hình linh hoạt**

**Trên thiết bị (LCD + Nút nhấn):**
- Xem dữ liệu cảm biến
- Bật/tắt relay thủ công
- Cấu hình WiFi qua Captive Portal

**Trên app:**
- Đặt ngưỡng cảnh báo
- Chuyển chế độ Auto/Manual
- Cấu hình Device ID & Key
- Kích hoạt OTA update

---

## 🔄 LUỒNG HOẠT ĐỘNG

### Luồng 1: Giám sát Realtime
```
1. ESP32 đọc cảm biến (5s/lần)
2. ESP32 gửi dữ liệu qua MQTT
3. MQTT Broker chuyển tiếp đến App
4. App hiển thị ngay lập tức
5. App lưu vào bộ nhớ local
```

### Luồng 2: Điều khiển
```
1. User bấm nút trên App
2. App gửi lệnh qua MQTT
3. MQTT Broker chuyển đến ESP32
4. ESP32 bật/tắt relay
5. ESP32 gửi trạng thái mới
6. App cập nhật giao diện
```

### Luồng 3: Lưu trữ dữ liệu
```
1. ESP32 gom dữ liệu (5 phút/lần)
2. ESP32 gửi HTTP POST đến Server
3. Server lưu vào Database
4. App có thể query dữ liệu lịch sử
```

### Luồng 4: Cảnh báo
```
1. ESP32 phát hiện vượt ngưỡng
2. Gửi cảnh báo qua MQTT
3. App nhận và hiển thị notification
4. Lưu vào danh sách thông báo
```

### Luồng 5: OTA Update
```
1. Developer upload firmware mới lên Server
2. ESP32 kiểm tra version (1h/lần)
3. Nếu có bản mới, tải về
4. Flash firmware và khởi động lại
5. Hoạt động với firmware mới
```

---

## 📊 TẦN SUẤT HOẠT ĐỘNG

| Hoạt động | Tần suất | Giao thức |
|-----------|----------|-----------|
| Đọc cảm biến | 5 giây | - |
| Gửi dữ liệu realtime | 5 giây | MQTT (QoS 0) |
| Lưu vào server | 5 phút | HTTP POST |
| Gửi trạng thái thiết bị | 30 giây | MQTT (QoS 0) |
| Kiểm tra firmware mới | 1 giờ | HTTP GET |
| Điều khiển | On-demand | MQTT (QoS 1) |
| Xem lịch sử | On-demand | HTTP GET |

---

## 🔐 BẢO MẬT

### 1. **Xác thực thiết bị**
- Mỗi thiết bị có Device ID và Device Key duy nhất
- App phải nhập đúng ID & Key mới kết nối được

### 2. **Mã hóa dữ liệu**
- MQTT hỗ trợ SSL/TLS (Port 8883, 9002)
- Device Key lưu trong SecureStore (encrypted)

### 3. **Quản lý truy cập**
- WiFi được cấu hình qua Captive Portal
- MQTT credentials được lưu an toàn

---

## 💾 LƯU TRỮ DỮ LIỆU

### ESP32 (EEPROM/NVS)
- WiFi SSID & Password
- Device ID & Key
- MQTT Broker config
- Ngưỡng cảnh báo
- Chế độ Auto/Manual

### Mobile App
**SecureStore (Encrypted):**
- Device ID & Key
- MQTT credentials

**AsyncStorage (Local):**
- Lịch sử dữ liệu 7 ngày
- Danh sách thông báo
- Cài đặt người dùng

### Web Server
**File System:**
- `/greenhouse/data/sensors_log.json`
- `/greenhouse/data/devices.json`
- `/greenhouse/firmware/firmware.bin`
- `/greenhouse/firmware/version.json`

**MySQL Database:**
- `sensor_data`: Dữ liệu cảm biến
- `devices`: Danh sách thiết bị
- `firmware_versions`: Lịch sử firmware

---

## 🎨 GIAO DIỆN NGƯỜI DÙNG

### Dashboard
- Card hiển thị nhiệt độ với icon nhiệt kế
- Card hiển thị độ ẩm không khí với icon giọt nước
- Card hiển thị độ ẩm đất với icon cây
- Switch bật/tắt máy bơm (màu xanh lá)
- Switch bật/tắt quạt (màu xanh dương)
- Badge hiển thị trạng thái Online/Offline
- Toggle chế độ Auto/Manual

### Charts
- Date picker chọn ngày xem
- 3 biểu đồ line chart:
  - Nhiệt độ (màu đỏ)
  - Độ ẩm không khí (màu xanh dương)
  - Độ ẩm đất (màu xanh lá)
- Trục X: Thời gian (00:00 - 24:00)
- Trục Y: Giá trị (°C, %)
- Hiển thị Min/Max

### Settings
- Input Device ID
- Input Device Key (password)
- Slider đặt ngưỡng nhiệt độ
- Slider đặt ngưỡng độ ẩm đất
- Switch chế độ Auto/Manual
- Button kiểm tra firmware
- Button kích hoạt OTA

### Notifications
- List các thông báo
- Icon theo loại cảnh báo
- Thời gian nhận thông báo
- Nội dung cảnh báo

---

## 🚀 LỢI ÍCH

### Cho người trồng trọt:
✅ Tiết kiệm thời gian: Không cần kiểm tra thủ công  
✅ Tiết kiệm nước: Tưới đúng lúc, đúng lượng  
✅ Tăng năng suất: Môi trường luôn tối ưu  
✅ Giảm rủi ro: Cảnh báo kịp thời  
✅ Dễ quản lý: Điều khiển từ xa mọi lúc mọi nơi  

### Cho hệ thống:
✅ Mở rộng dễ dàng: Thêm thiết bị mới đơn giản  
✅ Bảo trì thuận tiện: OTA update không cần USB  
✅ Chi phí thấp: Sử dụng ESP32 giá rẻ  
✅ Ổn định: MQTT đảm bảo giao tiếp realtime  
✅ Linh hoạt: Hỗ trợ cả Auto và Manual  

---

## 📱 YÊU CẦU HỆ THỐNG

### Phần cứng:
- ESP32 DevKit
- Cảm biến DHT22
- Cảm biến độ ẩm đất
- Module Relay 2 kênh
- LCD 16x2 I2C
- 4 nút nhấn
- Nguồn 5V

### Phần mềm:
- **Firmware:** PlatformIO, Arduino Framework
- **Server:** PHP 7.4+, MySQL 5.7+, Mosquitto MQTT
- **Mobile:** Node.js 16+, Expo CLI, React Native

### Kết nối:
- WiFi 2.4GHz
- Internet (để kết nối MQTT Broker)

---

## 🔧 CÔNG NGHỆ SỬ DỤNG

### Firmware (ESP32):
- **Ngôn ngữ:** C++ (Arduino Framework)
- **IDE:** PlatformIO
- **Thư viện:**
  - PubSubClient (MQTT)
  - DHT sensor library
  - LiquidCrystal_I2C
  - ArduinoJson
  - WiFiManager

### Mobile App:
- **Framework:** React Native + Expo
- **Ngôn ngữ:** TypeScript
- **Thư viện:**
  - React Navigation
  - React Native Paper
  - Paho MQTT
  - Expo Notifications
  - AsyncStorage
  - SecureStore

### Backend:
- **Ngôn ngữ:** PHP
- **Database:** MySQL / File JSON
- **MQTT Broker:** Mosquitto
- **Web Server:** Apache/Nginx

---

## 📈 KHẢ NĂNG MỞ RỘNG

### Phần cứng:
- Thêm cảm biến ánh sáng
- Thêm cảm biến pH đất
- Thêm camera giám sát
- Thêm van điện từ tự động

### Phần mềm:
- AI dự đoán thời tiết
- Lịch tưới tự động
- Báo cáo tuần/tháng
- Tích hợp voice control
- Multi-language support

### Tích hợp:
- Google Assistant
- Alexa
- Home Assistant
- Telegram Bot

---

## 📞 HỖ TRỢ

Để biết thêm chi tiết về:
- **Cài đặt:** Xem file `README.md`
- **Luồng dữ liệu:** Xem file `DATA_FLOW_DIAGRAM.md` hoặc `DATA_FLOW_DIAGRAM.drawio`
- **Firmware:** Xem file `Firmware/README_FW.md`
- **Mobile App:** Xem file `mobile/README_App.md`
- **Server:** Xem file `server/README_Server.md`

---

## 📝 TÓM TẮT

Hệ thống nhà kính thông minh là giải pháp IoT hoàn chỉnh giúp người trồng trọt:
- 🌡️ **Giám sát** môi trường 24/7
- 🎮 **Điều khiển** thiết bị từ xa
- 🤖 **Tự động hóa** quy trình chăm sóc
- 📊 **Phân tích** dữ liệu lịch sử
- 🔔 **Cảnh báo** kịp thời

Với kiến trúc phân tán, giao tiếp realtime qua MQTT, và giao diện thân thiện, hệ thống mang lại hiệu quả cao với chi phí thấp.
