import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Button, Text, TextInput, Card, Appbar, useTheme } from 'react-native-paper';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { GreenhouseMqttService } from '@/services/mqtt';

// Lưu trữ các thiết bị được phát hiện từ MQTT
type DiscoveredDevice = {
  key: string;
  deviceId: string;
  online: boolean;
  lastSeen: number;
};

const discoveredDevices = new Map<string, DiscoveredDevice>();

type Props = {
  onActivated: () => void;
};
function buildDeviceFingerprint() {
  const id = `${Device.manufacturer ?? 'unknown'}|${Device.modelName ?? 'unknown'}|${Application.applicationId ?? 'app'}`;
  return id;
}
export default function ActivationScreen({ onActivated }: Props) {
  const theme = useTheme();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [showKey, setShowKey] = useState(false);
  const mqttRef = useRef<GreenhouseMqttService | null>(null);
  useEffect(() => {
    const svc = new GreenhouseMqttService({ host: 'wss://serverdung.ddns.net:9002/mqtt' });
    
    // Lắng nghe tất cả message để phát hiện thiết bị
    svc.setListeners({
      onTelemetry: (data) => {
        if (data.id && data.key) {
          const key = (data.key as any).toUpperCase();
          const deviceId = (data.id as string).toUpperCase();
          
          discoveredDevices.set(key, {
            key,
            deviceId,
            online: true,
            lastSeen: Date.now(),
          });
          
          setDevices(Array.from(discoveredDevices.values()));
        }
      },
      onStatus: (status) => {
        const payload = status as any;
        if (payload.id && payload.key) {
          const key = payload.key.toUpperCase();
          const deviceId = payload.id.toUpperCase();
          const online = payload.online !== false;
          
          discoveredDevices.set(key, {
            key,
            deviceId,
            online,
            lastSeen: Date.now(),
          });
          
          setDevices(Array.from(discoveredDevices.values()));
        }
      },
      onConnected: () => setScanning(false),
      onDisconnected: () => setScanning(true),
    });
    
    svc.connect();
    mqttRef.current = svc;
    
    return () => {
      if (mqttRef.current) {
        mqttRef.current.disconnect();
      }
    };
  }, []);
  const handleActivate = async () => {
    setError(null);
    setLoading(true);
    try {
      const fp = buildDeviceFingerprint();
      const keyUpper = key.trim().toUpperCase();
      
      // Validate key: 6 characters alphanumeric (e.g., ABC123)
      if (keyUpper.length !== 6 || !/^[0-9A-Z]{6}$/.test(keyUpper)) {
        setError('Key phải gồm 6 ký tự (A-Z, 0-9)');
        setLoading(false);
        return;
      }
      
      // Lấy device từ KEY (KEY được set khi user click chọn thiết bị)
      const discoveredDevice = discoveredDevices.get(keyUpper);
      if (!discoveredDevice) {
        setError(`Không tìm thấy thiết bị. Vui lòng chọn lại.`);
        setLoading(false);
        return;
      }
      
      const expectedDeviceId = discoveredDevice.deviceId;
      
      // Wait for MQTT connection
      if (!mqttRef.current) {
        setError('Chưa kết nối MQTT. Vui lòng thử lại.');
        setLoading(false);
        return;
      }
      
      // Wait for connection to be established
      await new Promise((resolve) => {
        const checkConnection = setInterval(() => {
          if (mqttRef.current?.isConnected()) {
            clearInterval(checkConnection);
            resolve(true);
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkConnection);
          resolve(false);
        }, 5000);
      });
      
      // Subscribe to ack topic for this key
      const ackTopic = `greenhouse/${keyUpper}/ack`;
      mqttRef.current.subscribe(ackTopic);
      
      // Set up listener for activation response BEFORE publishing
      let activationResolve: ((value: { success: boolean; deviceId?: string; error?: string }) => void) | null = null;
      let activationTimeout: NodeJS.Timeout | null = null;
      let activationResolved = false;
      
      mqttRef.current.setListeners({
        onActivationResponse: async (response) => {
          if (activationResolved || !activationResolve) return;
          
          const responseKey = (response.key || '').toUpperCase();
          const responseId = response.id || '';
          
          // Check if key matches
          if (responseKey === keyUpper && response.ok) {
            // Lưu version nếu có trong response
            if (response.version) {
              await SecureStore.setItemAsync('deviceVersion', response.version);
            }
            activationResolved = true;
            if (activationTimeout) clearTimeout(activationTimeout);
            activationResolve({ success: true, deviceId: responseId });
          }
        },
      });
      
      // Wait a bit to ensure subscription is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Send activation command
      mqttRef.current.publishActivate(keyUpper, expectedDeviceId, fp);
      
      // Wait for activation response
      const activationResult = await new Promise<{ success: boolean; deviceId?: string; error?: string }>((resolve) => {
        activationResolve = resolve;
        activationTimeout = setTimeout(() => {
          if (!activationResolved) {
            activationResolved = true;
            resolve({ success: false, error: 'Không nhận được phản hồi từ thiết bị. Hãy đảm bảo thiết bị online và key đúng.' });
          }
        }, 8000);
      });
      
      if (!activationResult.success) {
        setError(activationResult.error || 'Kích hoạt thất bại.');
        setLoading(false);
        return;
      }
      
      // Verify device ID matches với mapping
      const responseId = (activationResult.deviceId || '').toUpperCase();
      if (responseId !== expectedDeviceId.toUpperCase()) {
        setError(`Thiết bị không khớp. Key "${keyUpper}" phải kích hoạt thiết bị "${expectedDeviceId}", nhưng nhận được "${responseId}".`);
        setLoading(false);
        return;
      }
      
      // Save activation data
      await SecureStore.setItemAsync('activationKey', keyUpper);
      await SecureStore.setItemAsync('deviceId', expectedDeviceId);
      await SecureStore.setItemAsync('deviceFingerprint', fp);
      
      // Disconnect MQTT from activation screen
      if (mqttRef.current) {
        mqttRef.current.disconnect();
      }
      
      onActivated();
    } catch (err) {
      setError('Lỗi kích hoạt: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  const keyUpper = key.trim().toUpperCase();
  const mappedDeviceId = keyUpper && discoveredDevices.get(keyUpper)?.deviceId;

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.Content title="Kích hoạt thiết bị" color="white" />
      </Appbar.Header>

      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.title}>
              Kích hoạt thiết bị
            </Text>
            <Text style={styles.description}>
              {scanning ? 'Đang quét thiết bị...' : `Đã phát hiện ${devices.filter(d => d.online).length} thiết bị online`}
            </Text>
            
            <TextInput
              label="Activation Key"
              value={key}
              onChangeText={(text) => {
                setKey(text.toUpperCase());
                setError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              mode="outlined"
              placeholder="Nhập 6 ký tự"
              maxLength={6}
              secureTextEntry={!showKey}
              left={<TextInput.Icon icon="key-variant" />}
              right={
                <TextInput.Icon 
                  icon={showKey ? "eye-off" : "eye"} 
                  onPress={() => setShowKey(!showKey)}
                />
              }
              style={[styles.input, { marginTop: 16 }]}
            />

            {key.length === 6 && (() => {
              const device = discoveredDevices.get(key.toUpperCase());
              if (device && device.online) {
                return (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: '#ecfdf5', borderRadius: 8, borderWidth: 1, borderColor: '#10b981' }}>
                    <Text style={{ fontSize: 14, color: '#065f46', marginBottom: 4 }}>
                      <Text style={{ fontWeight: '700' }}>✅ Thiết bị hợp lệ:</Text> Nhà kính {device.deviceId}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#10b981' }}>
                      🟢 Đang online và sẵn sàng kết nối
                    </Text>
                  </View>
                );
              } else if (device && !device.online) {
                return (
                  <View style={{ marginTop: 12, padding: 10, backgroundColor: '#fef3c7', borderRadius: 6 }}>
                    <Text style={{ color: '#92400e', fontSize: 13 }}>
                      ⚠️ Thiết bị {device.deviceId} đang offline
                    </Text>
                  </View>
                );
              } else {
                return (
                  <View style={{ marginTop: 12, padding: 10, backgroundColor: '#fee2e2', borderRadius: 6 }}>
                    <Text style={{ color: '#dc2626', fontSize: 13 }}>
                      ❌ Key không hợp lệ hoặc thiết bị chưa kết nối
                    </Text>
                  </View>
                );
              }
            })()}

            {key.length < 6 && (
              <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                Nhập KEY 6 ký tự (A-Z, 0-9) để kích hoạt
              </Text>
            )}

            {error && (
              <View style={{ marginTop: 12, padding: 10, backgroundColor: '#fee2e2', borderRadius: 6 }}>
                <Text style={{ color: '#dc2626', fontSize: 13 }}>{error}</Text>
              </View>
            )}

            <Button
              mode="contained"
              onPress={handleActivate}
              loading={loading}
              disabled={key.length !== 6 || !discoveredDevices.get(key.toUpperCase())?.online || loading}
              style={[styles.button, { marginTop: 20 }]}
              contentStyle={styles.buttonContent}
              icon="check-circle"
            >
              {loading ? 'Đang kích hoạt...' : 'Kích hoạt thiết bị'}
            </Button>
          </Card.Content>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fef9c3',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    elevation: 2,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#15803d',
  },
  description: {
    color: '#475569',
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'white',
  },
  button: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
});