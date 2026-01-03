# SƠ ĐỒ LUỒNG DỮ LIỆU HỆ THỐNG NHÀ KÍNH

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HỆ THỐNG NHÀ KÍNH IOT                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   ESP32 DEVICE   │         │   MQTT BROKER    │         │   MOBILE APP     │
│   (Firmware)     │         │  (Mosquitto)     │         │  (React Native)  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
         │                            │                            │
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  • DHT22 Sensor  │         │  Port 9001 (WS)  │         │  • Dashboard     │
│  • Soil Sensor   │         │  Port 9002 (WSS) │         │  • Charts        │
│  • 2x Relay      │         │  Port 1883 (TCP) │         │  • Settings      │
│  • LCD 16x2      │         │  Port 8883 (SSL) │         │  • Notifications │
│  • 4 Buttons     │         └──────────────────┘         └──────────────────┘
└──────────────────┘                  │                            │
                                      │                            │
                            ┌─────────┴─────────┐                  │
                            ▼                   ▼                  │
                   ┌──────────────────┐  ┌──────────────────┐     │
                   │   WEB SERVER     │  │   DATABASE       │     │
                   │   (PHP + HTTP)   │  │   (File/MySQL)   │     │
                   └──────────────────┘  └──────────────────┘     │
                            │                   │                  │
                            └───────────────────┴──────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                            LUỒNG DỮ LIỆU CHI TIẾT
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LUỒNG DỮ LIỆU CẢM BIẾN (Realtime - MQTT)                                │
└─────────────────────────────────────────────────────────────────────────────┘

ESP32                          MQTT Broker                    Mobile App
  │                                 │                              │
  │ ① Đọc cảm biến (5s/lần)        │                              │
  │    - Nhiệt độ (temp)            │                              │
  │    - Độ ẩm KK (hum)             │                              │
  │    - Độ ẩm đất (soil)           │                              │
  │                                 │                              │
  │ ② PUBLISH                       │                              │
  ├────────────────────────────────>│                              │
  │ Topic: greenhouse/{ID}/telemetry│                              │
  │ Payload: {temp, hum, soil,      │                              │
  │          r1, r2, timestamp}     │                              │
  │                                 │                              │
  │                                 │ ③ FORWARD                    │
  │                                 ├─────────────────────────────>│
  │                                 │                              │
  │                                 │                              │ ④ Hiển thị
  │                                 │                              │    - Dashboard
  │                                 │                              │    - Lưu local
  │                                 │                              │    - Vẽ chart


┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. LUỒNG ĐIỀU KHIỂN (Control - MQTT)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Mobile App                     MQTT Broker                    ESP32
  │                                 │                              │
  │ ① User bấm nút điều khiển       │                              │
  │    - Bật/tắt Relay 1 (Bơm)     │                              │
  │    - Bật/tắt Relay 2 (Quạt)    │                              │
  │    - Đặt ngưỡng                 │                              │
  │                                 │                              │
  │ ② PUBLISH                       │                              │
  ├────────────────────────────────>│                              │
  │ Topic: greenhouse/{ID}/control  │                              │
  │ Payload: {r1: 1, r2: 0}         │                              │
  │                                 │                              │
  │                                 │ ③ FORWARD                    │
  │                                 ├─────────────────────────────>│
  │                                 │                              │
  │                                 │                              │ ④ Thực thi
  │                                 │                              │    - Bật relay
  │                                 │                              │    - Hiển thị LCD
  │                                 │                              │
  │                                 │ ⑤ PUBLISH status             │
  │                                 │<─────────────────────────────┤
  │ ⑥ Nhận xác nhận                 │                              │
  │<────────────────────────────────┤                              │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. LUỒNG LƯU TRỮ DỮ LIỆU (HTTP POST)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

ESP32                          Web Server                    Database
  │                                 │                              │
  │ ① Gom dữ liệu (5 phút/lần)     │                              │
  │                                 │                              │
  │ ② HTTP POST                     │                              │
  ├────────────────────────────────>│                              │
  │ URL: /greenhouse/data_api.php   │                              │
  │ Body: {device_id, temp, hum,    │                              │
  │       soil, r1, r2, timestamp}  │                              │
  │                                 │                              │
  │                                 │ ③ Validate & Save            │
  │                                 ├─────────────────────────────>│
  │                                 │                              │ ④ Lưu vào
  │                                 │                              │    - File JSON
  │                                 │                              │    - MySQL
  │                                 │ ⑤ Response                   │
  │ ⑥ Nhận kết quả                  │<─────────────────────────────┤
  │<────────────────────────────────┤                              │
  │ {success: true}                 │                              │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. LUỒNG XEM LỊCH SỬ (HTTP GET)                                            │
└─────────────────────────────────────────────────────────────────────────────┘

Mobile App                     Web Server                    Database
  │                                 │                              │
  │ ① User chọn ngày xem chart      │                              │
  │                                 │                              │
  │ ② HTTP GET                      │                              │
  ├────────────────────────────────>│                              │
  │ URL: /greenhouse/data_api.php   │                              │
  │ Params: ?hours=24&limit=100     │                              │
  │                                 │                              │
  │                                 │ ③ Query data                 │
  │                                 ├─────────────────────────────>│
  │                                 │                              │
  │                                 │ ④ Return records             │
  │                                 │<─────────────────────────────┤
  │ ⑤ Nhận dữ liệu                  │                              │
  │<────────────────────────────────┤                              │
  │ [{timestamp, temp, hum, ...}]   │                              │
  │                                 │                              │
  │ ⑥ Vẽ biểu đồ                    │                              │
  │    - Filter theo ngày           │                              │
  │    - Hiển thị trục X (time)     │                              │
  │    - Hiển thị trục Y (value)    │                              │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. LUỒNG CẬP NHẬT FIRMWARE (OTA)                                           │
└─────────────────────────────────────────────────────────────────────────────┘

Developer                      Web Server                    ESP32
  │                                 │                              │
  │ ① Build firmware mới            │                              │
  │    - Tạo file .bin              │                              │
  │    - Tạo version.json           │                              │
  │                                 │                              │
  │ ② Upload firmware               │                              │
  ├────────────────────────────────>│                              │
  │ POST /greenhouse/upload.php     │                              │
  │ Files: firmware.bin, version.json│                             │
  │                                 │                              │
  │                                 │ ③ Lưu vào /firmware/         │
  │                                 │                              │
  │                                 │                              │
  │                                 │ ④ Kiểm tra version (1h/lần)  │
  │                                 │<─────────────────────────────┤
  │                                 │ GET /greenhouse/version.php  │
  │                                 │                              │
  │                                 │ ⑤ Response version info      │
  │                                 ├─────────────────────────────>│
  │                                 │ {version, url, size}         │
  │                                 │                              │
  │                                 │                              │ ⑥ So sánh
  │                                 │                              │    version
  │                                 │                              │
  │                                 │ ⑦ Download .bin (nếu mới)    │
  │                                 │<─────────────────────────────┤
  │                                 │ GET /firmware/firmware.bin   │
  │                                 │                              │
  │                                 │ ⑧ Send binary                │
  │                                 ├─────────────────────────────>│
  │                                 │                              │
  │                                 │                              │ ⑨ Flash & Reboot


┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. LUỒNG KÍCH HOẠT THIẾT BỊ (Activation)                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User                           Mobile App                    ESP32
  │                                 │                              │
  │ ① Mở app lần đầu                │                              │
  │                                 │                              │
  │ ② Nhập Device ID & Key          │                              │
  ├────────────────────────────────>│                              │
  │                                 │                              │
  │                                 │ ③ Lưu vào SecureStore        │
  │                                 │                              │
  │                                 │ ④ Connect MQTT               │
  │                                 │    Topic: greenhouse/{ID}/#  │
  │                                 │                              │
  │                                 │ ⑤ Subscribe topics           │
  │                                 │    - telemetry               │
  │                                 │    - status                  │
  │                                 │    - config                  │
  │                                 │                              │
  │ ⑥ Sẵn sàng sử dụng              │                              │


═══════════════════════════════════════════════════════════════════════════════
                            NƠI LƯU TRỮ DỮ LIỆU
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ ESP32 (Firmware)                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • EEPROM/NVS:                                                               │
│   - WiFi SSID & Password                                                    │
│   - Device ID & Key                                                         │
│   - MQTT Broker config                                                      │
│   - Ngưỡng cảnh báo (temp, hum, soil)                                       │
│   - Chế độ Auto/Manual                                                      │
│                                                                             │
│ • RAM (Runtime):                                                            │
│   - Giá trị cảm biến hiện tại                                               │
│   - Trạng thái relay                                                        │
│   - Trạng thái kết nối                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Mobile App (React Native)                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ • SecureStore (Encrypted):                                                  │
│   - Device ID & Key                                                         │
│   - MQTT credentials                                                        │
│                                                                             │
│ • AsyncStorage (Local):                                                     │
│   - Lịch sử dữ liệu cảm biến (7 ngày gần nhất)                             │
│   - Danh sách thông báo                                                     │
│   - Cài đặt người dùng                                                      │
│                                                                             │
│ • RAM (Runtime):                                                            │
│   - Dữ liệu realtime từ MQTT                                                │
│   - State của UI                                                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Web Server (PHP)                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ • File System:                                                              │
│   - /greenhouse/data/                                                       │
│     └── sensors_log.json (Dữ liệu cảm biến)                                │
│     └── devices.json (Danh sách thiết bị)                                  │
│                                                                             │
│   - /greenhouse/firmware/                                                   │
│     └── firmware.bin (File firmware mới nhất)                              │
│     └── version.json (Thông tin phiên bản)                                 │
│                                                                             │
│ • MySQL Database (Optional):                                                │
│   - Table: sensor_data                                                      │
│     Columns: id, device_id, timestamp, temp, hum, soil, r1, r2             │
│                                                                             │
│   - Table: devices                                                          │
│     Columns: id, device_id, device_key, name, created_at                   │
│                                                                             │
│   - Table: firmware_versions                                                │
│     Columns: id, version, file_path, release_date, notes                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ MQTT Broker (Mosquitto)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ • RAM (Volatile):                                                           │
│   - Tin nhắn đang chờ gửi (QoS 1, 2)                                        │
│   - Danh sách client đang kết nối                                           │
│   - Retained messages                                                       │
│                                                                             │
│ • Disk (Persistent):                                                        │
│   - mosquitto.db (Lưu trạng thái khi restart)                              │
│   - Logs                                                                    │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                            TẦN SUẤT TRUYỀN DỮ LIỆU
═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────┬──────────────┬─────────────────────────────┐
│ Loại dữ liệu                 │ Tần suất     │ Giao thức                   │
├──────────────────────────────┼──────────────┼─────────────────────────────┤
│ Dữ liệu cảm biến (realtime)  │ 5 giây       │ MQTT (QoS 0)                │
│ Lưu vào server               │ 5 phút       │ HTTP POST                   │
│ Kiểm tra firmware mới        │ 1 giờ        │ HTTP GET                    │
│ Lệnh điều khiển              │ On-demand    │ MQTT (QoS 1)                │
│ Trạng thái thiết bị          │ 30 giây      │ MQTT (QoS 0)                │
│ Xem lịch sử                  │ On-demand    │ HTTP GET                    │
└──────────────────────────────┴──────────────┴─────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                            CHÚ THÍCH
═══════════════════════════════════════════════════════════════════════════════

• MQTT Topics:
  - greenhouse/{device_id}/telemetry  : Dữ liệu cảm biến
  - greenhouse/{device_id}/control    : Lệnh điều khiển
  - greenhouse/{device_id}/status     : Trạng thái thiết bị
  - greenhouse/{device_id}/config     : Cấu hình thiết bị

• QoS Levels:
  - QoS 0: At most once (Dữ liệu realtime, có thể mất)
  - QoS 1: At least once (Lệnh điều khiển, đảm bảo nhận)
  - QoS 2: Exactly once (Không dùng - overhead cao)

• Bảo mật:
  - MQTT: SSL/TLS (Port 8883, 9002)
  - HTTP: Có thể dùng HTTPS
  - Authentication: Device ID + Key
```
