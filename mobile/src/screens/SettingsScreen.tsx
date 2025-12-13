import React, { useEffect, useRef, useState } from 'react';
import { View, Alert, ScrollView } from 'react-native';
import { Appbar, Button, Card, Text, IconButton, useTheme, Divider } from 'react-native-paper';
import BottomTabs from '@/components/BottomTabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { GreenhouseMqttService } from '@/services/mqtt';
import * as SecureStore from 'expo-secure-store';
import { useActivation } from '@/contexts/ActivationContext';
import { checkFirmwareVersion, compareVersions, FirmwareVersionInfo } from '@/services/firmware';
type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export default function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { logout } = useActivation();
  const [tempThr, setTempThr] = useState(38.0);
  const [soilThr, setSoilThr] = useState(60);
  const [currentVersion, setCurrentVersion] = useState<string>('Chưa xác định');
  const [latestVersion, setLatestVersion] = useState<FirmwareVersionInfo | null>(null);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [updating, setUpdating] = useState(false);
  const svcRef = useRef<GreenhouseMqttService | null>(null);
  const shouldSyncRef = useRef(false); // Flag để chỉ sync khi nhấn refresh
  const ensureSvc = async () => {
    if (!svcRef.current) {
      // Load activationKey và deviceId từ SecureStore
      const [activationKey, deviceId] = await Promise.all([
        SecureStore.getItemAsync('activationKey'),
        SecureStore.getItemAsync('deviceId'),
      ]);
      
      svcRef.current = new GreenhouseMqttService({ 
        host: 'wss://serverdung.ddns.net:9002/mqtt',
        activationKey: activationKey || undefined,
        deviceId: deviceId || undefined,
      });
      svcRef.current.setListeners({
        onTelemetry: (data) => {
          // Chỉ đồng bộ từ telemetry khi nhấn refresh
          if (shouldSyncRef.current && typeof data.t_thr === 'number' && typeof data.s_thr === 'number') {
            setTempThr(data.t_thr);
            setSoilThr(Math.round(data.s_thr));
            SecureStore.setItemAsync('thrT', String(data.t_thr)).catch(() => {});
            SecureStore.setItemAsync('thrS', String(Math.round(data.s_thr))).catch(() => {});
            shouldSyncRef.current = false; // Reset flag sau khi sync
          }
        },
        onAck: (ack) => {
          // Đồng bộ từ ACK khi refresh (nhận config response) hoặc sau khi apply
          if (shouldSyncRef.current) {
            // Đang refresh: sync từ config response
            if (typeof ack.t_thr === 'number') {
              setTempThr(ack.t_thr);
              SecureStore.setItemAsync('thrT', String(ack.t_thr)).catch(() => {});
            }
            if (typeof ack.s_thr === 'number') {
              const v = Math.round(ack.s_thr);
              setSoilThr(v);
              SecureStore.setItemAsync('thrS', String(v)).catch(() => {});
            }
            shouldSyncRef.current = false; // Reset flag sau khi sync
          } else {
            // Sau khi apply: sync từ ACK xác nhận
            if (typeof ack.t_thr === 'number') {
              setTempThr(ack.t_thr);
              SecureStore.setItemAsync('thrT', String(ack.t_thr)).catch(() => {});
            }
            if (typeof ack.s_thr === 'number') {
              const v = Math.round(ack.s_thr);
              setSoilThr(v);
              SecureStore.setItemAsync('thrS', String(v)).catch(() => {});
            }
          }
        },
        onInfo: async (info) => {
          // Lưu version khi nhận được từ device
          if (info.version || info.fw_ver) {
            const version = info.version || info.fw_ver || '';
            if (version) {
              setCurrentVersion(version);
              await SecureStore.setItemAsync('deviceVersion', version);
            }
          }
        },
        onConnected: () => {
          // Request info khi connect để lấy version hiện tại
          setTimeout(() => {
            if (svcRef.current) {
              svcRef.current.requestInfo();
            }
          }, 500);
        },
      });
      svcRef.current.connect();
    }
    return svcRef.current;
  };
  
  useEffect(() => {
    (async () => {
      try {
        const [tStr, sStr, versionStr] = await Promise.all([
          SecureStore.getItemAsync('thrT'),
          SecureStore.getItemAsync('thrS'),
          SecureStore.getItemAsync('deviceVersion'),
        ]);
        if (tStr) setTempThr(parseFloat(tStr));
        if (sStr) setSoilThr(parseInt(sStr, 10));
        if (versionStr) setCurrentVersion(versionStr);
      } finally {
        await ensureSvc();
      }
    })();
  }, []);
  const handleApply = async () => {
    const t = Math.min(60, Math.max(20, Number(tempThr.toFixed(1))));
    const s = Math.min(90, Math.max(10, Math.round(soilThr)));
    const svc = await ensureSvc();
    svc.publishConfig(t, s);
    // Giá trị sẽ được cập nhật từ onAck khi server xác nhận
  };
  const inc = (v: number, step: number, max: number) => Math.min(max, Number((v + step).toFixed(1)));
  const dec = (v: number, step: number, min: number) => Math.max(min, Number((v - step).toFixed(1)));
  const incInt = (v: number, step: number, max: number) => Math.min(max, Math.round(v + step));
  const decInt = (v: number, step: number, min: number) => Math.max(min, Math.round(v - step));

  const handleUpdate = async () => {
    if (!latestVersion) return;
    
    Alert.alert(
      'Xác nhận cập nhật',
      `Bạn có chắc chắn muốn cập nhật firmware lên phiên bản ${latestVersion.version}?\n\nThiết bị sẽ tự động khởi động lại sau khi cập nhật.`,
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Cập nhật',
          onPress: async () => {
            setUpdating(true);
            try {
              const svc = await ensureSvc();
              if (!svc.isConnected()) {
                Alert.alert('Lỗi', 'Không kết nối được với thiết bị. Vui lòng kiểm tra kết nối MQTT.');
                setUpdating(false);
                return;
              }
              console.log('[OTA] Sending OTA update command with URL:', latestVersion.download_url);
              svc.publishOTAUpdate(latestVersion.download_url);
              Alert.alert(
                'Đã gửi lệnh cập nhật',
                'Lệnh cập nhật đã được gửi đến thiết bị. Thiết bị sẽ tự động tải và cài đặt firmware mới, sau đó khởi động lại.\n\nVui lòng đợi thiết bị khởi động lại.',
                [{ text: 'OK' }]
              );
              // Cập nhật version sau khi update thành công (có thể cần nhận ACK từ device)
              // setCurrentVersion(latestVersion.version);
              // await SecureStore.setItemAsync('deviceVersion', latestVersion.version);
            } catch (error) {
              console.error('[OTA] Error sending OTA command:', error);
              Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không thể gửi lệnh cập nhật');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất Key hiện tại? Bạn sẽ cần nhập Key mới để xem dữ liệu thiết bị khác.',
      [
        {
          text: 'Hủy',
          style: 'cancel',
        },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            // Disconnect MQTT
            if (svcRef.current) {
              svcRef.current.disconnect();
              svcRef.current = null;
            }
            // Logout và xóa dữ liệu
            await logout();
          },
        },
      ]
    );
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Cấu hình ngưỡng" />
        <Appbar.Action icon="refresh" onPress={async () => {
          const svc = await ensureSvc();
          shouldSyncRef.current = true; // Bật flag để sync từ telemetry tiếp theo
          svc.requestConfig(); // Request config từ device
          svc.requestInfo(); // Request info để lấy version
        }} />
      </Appbar.Header>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <Card.Title title="Nhiệt độ (°C)" />
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <IconButton icon="minus" onPress={() => { setTempThr(v => dec(v, 0.5, 20)); }} />
              <Text variant="headlineMedium">{tempThr.toFixed(1)}</Text>
              <IconButton icon="plus" onPress={() => { setTempThr(v => inc(v, 0.5, 60)); }} />
            </View>
          </Card.Content>
        </Card>
        <Card>
          <Card.Title title="Độ ẩm đất (%)" />
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <IconButton icon="minus" onPress={() => { setSoilThr(v => decInt(v, 1, 10)); }} />
              <Text variant="headlineMedium">{Math.round(soilThr)}</Text>
              <IconButton icon="plus" onPress={() => { setSoilThr(v => incInt(v, 1, 90)); }} />
            </View>
          </Card.Content>
        </Card>
        <Button mode="contained" onPress={handleApply}>
          Áp dụng
        </Button>
        <Divider style={{ marginVertical: 16 }} />
        <Card>
          <Card.Title title="Firmware" />
          <Card.Content>
            <View style={{ marginBottom: 12 }}>
              <Text variant="bodyMedium" style={{ marginBottom: 4 }}>
                Phiên bản hiện tại:
              </Text>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
                {currentVersion}
              </Text>
            </View>
            {latestVersion && compareVersions(currentVersion, latestVersion.version) && (
              <View style={{ marginBottom: 12, padding: 12, backgroundColor: theme.colors.primaryContainer, borderRadius: 8 }}>
                <Text variant="bodyMedium" style={{ marginBottom: 4, fontWeight: 'bold' }}>
                  Có phiên bản mới:
                </Text>
                <Text variant="bodyMedium">
                  {latestVersion.version}
                </Text>
                <Text variant="bodySmall" style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
                  Tải lên: {new Date(latestVersion.upload_time).toLocaleString('vi-VN')}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                mode="outlined"
                onPress={async () => {
                  setCheckingVersion(true);
                  try {
                    const result = await checkFirmwareVersion();
                    if (result.success && result.data) {
                      setLatestVersion(result.data);
                      if (compareVersions(currentVersion, result.data.version)) {
                        Alert.alert(
                          'Có phiên bản mới',
                          `Phiên bản mới: ${result.data.version}\nPhiên bản hiện tại: ${currentVersion}\nBạn có muốn cập nhật không?`,
                          [
                            { text: 'Hủy', style: 'cancel' },
                            { text: 'Cập nhật', onPress: () => handleUpdate() },
                          ]
                        );
                      } else {
                        Alert.alert('Thông báo', 'Thiết bị đang sử dụng phiên bản mới nhất.');
                      }
                    } else {
                      Alert.alert('Lỗi', result.message || 'Không thể kiểm tra phiên bản');
                    }
                  } catch (error) {
                    Alert.alert('Lỗi', error instanceof Error ? error.message : 'Lỗi không xác định');
                  } finally {
                    setCheckingVersion(false);
                  }
                }}
                loading={checkingVersion}
                disabled={checkingVersion}
                style={{ flex: 1 }}
                icon="cloud-download-outline"
              >
                Kiểm tra phiên bản mới
              </Button>
              {latestVersion && compareVersions(currentVersion, latestVersion.version) && (
                <Button
                  mode="contained"
                  onPress={handleUpdate}
                  loading={updating}
                  disabled={updating}
                  style={{ flex: 1 }}
                  icon="update"
                >
                  Cập nhật
                </Button>
              )}
            </View>
          </Card.Content>
        </Card>
        <Divider style={{ marginVertical: 16 }} />
        <Card>
          <Card.Title title="Quản lý tài khoản" />
          <Card.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 12 }}>
              Đăng xuất Key hiện tại để nhập Key mới và xem dữ liệu thiết bị khác
            </Text>
            <Button 
              mode="outlined" 
              onPress={handleLogout}
              icon="logout"
              textColor={theme.colors.error}
            >
              Đăng xuất Key
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      <BottomTabs current="Settings" onNavigate={(key)=>{
        if (key==='Dashboard') navigation.navigate('Dashboard');
        else if (key==='Charts') navigation.navigate('Charts');
      }} />
    </View>
  );
}