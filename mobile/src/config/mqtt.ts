/**
 * MQTT Configuration
 * Centralized MQTT broker settings
 */

// Determine environment
const __DEV__ = process.env.NODE_ENV === 'development';

export const MQTT_CONFIG = {
  // Development: Use WS (no SSL) for faster testing
  // Works with: Expo Go, Android Emulator, local network testing
  DEVELOPMENT: {
    BROKER_URL: 'ws://serverdung.ddns.net:9001/mqtt',
    // Alternative for local network (replace with your server IP):
    // BROKER_URL: 'ws://192.168.1.100:9001/mqtt',
    // Alternative for Android Emulator:
    // BROKER_URL: 'ws://10.0.2.2:9001/mqtt',
  },

  // Production: Use WSS (with SSL) for security
  // Required for: APK builds, Play Store, production apps
  PRODUCTION: {
    BROKER_URL: 'wss://serverdung.ddns.net:9002/mqtt',
  },
};

// Auto-select based on environment
export const MQTT_BROKER_URL = __DEV__
  ? MQTT_CONFIG.DEVELOPMENT.BROKER_URL
  : MQTT_CONFIG.PRODUCTION.BROKER_URL;

// Export for manual override if needed
export const MQTT_BROKER_URL_DEV = MQTT_CONFIG.DEVELOPMENT.BROKER_URL;
export const MQTT_BROKER_URL_PROD = MQTT_CONFIG.PRODUCTION.BROKER_URL;

export default MQTT_CONFIG;
