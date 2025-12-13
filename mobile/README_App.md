# Ứng dụng di động Giám sát và Điều khiển Nhà kính

Đây là ứng dụng di động được phát triển bằng React Native và Expo, dùng để giám sát và điều khiển hệ thống nhà kính thông qua giao tiếp MQTT.

## Chức năng chính

*   **Giao diện người dùng:** Cung cấp giao diện trực quan để theo dõi các thông số môi trường và điều khiển thiết bị.
*   **Giao tiếp MQTT:** Kết nối đến MQTT broker để nhận dữ liệu từ cảm biến và gửi lệnh điều khiển đến thiết bị ESP32.
*   **Hiển thị dữ liệu:** Hiển thị dữ liệu nhiệt độ, độ ẩm dưới dạng số và biểu đồ.
*   **Điều khiển thiết bị:** Cho phép người dùng bật/tắt các thiết bị như máy bơm, quạt.
*   **Thông báo:** Gửi thông báo đẩy (push notification) đến người dùng khi có cảnh báo.
*   **Quản lý lịch sử:** Xem lại lịch sử dữ liệu cảm biến.

## Cấu trúc thư mục

```
mobile/
├── assets/               # Các tài nguyên tĩnh (hình ảnh, font chữ)
├── src/                  # Mã nguồn của ứng dụng
│   ├── components/       # Các component tái sử dụng
│   ├── config/           # Các file cấu hình (ví dụ: MQTT)
│   ├── contexts/         # React Contexts để quản lý state
│   ├── screens/          # Các màn hình chính của ứng dụng
│   ├── services/         # Các service để giao tiếp với API, MQTT
│   ├── types/            # Các định nghĩa kiểu dữ liệu (TypeScript)
│   └── utils/            # Các hàm tiện ích
├── App.tsx               # File component gốc của ứng dụng
├── package.json          # File quản lý các gói phụ thuộc và scripts
└── tsconfig.json         # File cấu hình TypeScript
```

## Các thư viện chính

*   **[Expo](https://expo.dev/):** Nền tảng phát triển ứng dụng React Native.
*   **[React Navigation](https://reactnavigation.org/):** Thư viện quản lý điều hướng giữa các màn hình.
*   **[React Native Paper](https://reactnativepaper.com/):** Bộ component UI theo Material Design.
*   **[Paho MQTT](https://www.eclipse.org/paho/index.php?page=clients/js/index.php):** Thư viện MQTT client cho JavaScript.
*   **[Expo Vector Icons](https://github.com/expo/vector-icons):** Bộ icon phổ biến cho React Native.
*   **[Async Storage](https://github.com/react-native-async-storage/async-storage):** Lưu trữ dữ liệu cục bộ trên thiết bị.
*   **[Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/):** Gửi và nhận thông báo đẩy.

## Các màn hình (Screens)

*   `DashboardScreen.tsx`: Màn hình chính hiển thị tổng quan dữ liệu và điều khiển.
*   `ChartsScreen.tsx`: Màn hình hiển thị biểu đồ lịch sử dữ liệu.
*   `SettingsScreen.tsx`: Màn hình cài đặt (ví dụ: thông tin MQTT broker).
*   `NotificationsScreen.tsx`: Màn hình hiển thị danh sách các thông báo đã nhận.
*   `ActivationScreen.tsx`: Màn hình kích hoạt hoặc đăng nhập.

## Các services

*   `mqtt.ts`: Xử lý kết nối, gửi và nhận tin nhắn MQTT.
*   `notifications.ts`: Quản lý việc gửi và nhận thông báo.
*   `history.ts`: Lấy dữ liệu lịch sử từ server.
*   `firmware.ts`: Tương tác với API liên quan đến firmware.

## Hướng dẫn sử dụng

1.  **Cài đặt Node.js và Yarn/npm:** Đảm bảo bạn đã cài đặt Node.js và trình quản lý gói.
2.  **Cài đặt Expo CLI:** Chạy lệnh `npm install -g expo-cli`.
3.  **Cài đặt các gói phụ thuộc:** Chạy lệnh `npm install` hoặc `yarn install` trong thư mục `mobile`.
4.  **Chạy ứng dụng:**
    *   Để chạy trên máy ảo Android/iOS: `npm run android` hoặc `npm run ios`.
    *   Để chạy trong trình duyệt web: `npm run web`.
    *   Để khởi động Metro Bundler và quét mã QR bằng ứng dụng Expo Go: `npm start`.

5.  **Cấu hình:** Chỉnh sửa file trong `src/config/` để cấu hình địa chỉ MQTT broker và các thông tin khác.
