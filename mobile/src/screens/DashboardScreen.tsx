import React, { useEffect, useRef, useState } from 'react';
import { View, RefreshControl, ScrollView, Animated, Easing, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Card, IconButton, Appbar, List, useTheme, Badge, Button } from 'react-native-paper';
import BottomTabs from '@/components/BottomTabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { GreenhouseMqttService, Telemetry } from '@/services/mqtt';
import { showAlarmNotification } from '@/services/notifications';
import { HistoryService } from '@/services/history';
import * as SecureStore from 'expo-secure-store';
type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;
export default function DashboardScreen({ navigation }: Props) {
  const theme = useTheme();
  const [connected, setConnected] = useState(false);
  const [tele, setTele] = useState<Telemetry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [alarms, setAlarms] = useState<Array<{ title: string; body: string; ts: number }>>([]);
  const [unread, setUnread] = useState(0);
  const [manualControl, setManualControl] = useState(true);
  const [r1Mode, setR1Mode] = useState<'auto' | 'manual'>('auto');
  const [r2Mode, setR2Mode] = useState<'auto' | 'manual'>('auto');
  const mqttRef = useRef<GreenhouseMqttService | null>(null);
  const lastRelayRef = useRef<{ r1?: number; r2?: number }>({});
  const lastAlarmRelayRef = useRef<{ r1?: number; r2?: number }>({});
  const lastAlarmTime = useRef<number>(0);
  const historyService = useRef(HistoryService.getInstance()).current;
  const isRelayAlarm = (a: { title: string; body: string }) => {
    const t = (a.title || '').toLowerCase();
    const b = (a.body || '').toLowerCase();
    return (
      t.includes('relay') ||
      b.includes('relay') ||
      t.includes('quạt') ||
      b.includes('quạt') ||
      t.includes('máy bơm') ||
      b.includes('máy bơm') ||
      t.includes('bơm') ||
      b.includes('bơm')
    );
  };
  // Animations
  const c1 = useRef(new Animated.Value(0)).current;
  const c2 = useRef(new Animated.Value(0)).current;
  const c3 = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // staggered entrance
    Animated.stagger(120, [c1, c2, c3].map(v =>
      Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })
    )).start();
    // loop title color animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(titleAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(titleAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: false })
      ])
    ).start();
    
    // Load activationKey và deviceId từ SecureStore
    (async () => {
      try {
        const [activationKey, deviceId] = await Promise.all([
          SecureStore.getItemAsync('activationKey'),
          SecureStore.getItemAsync('deviceId'),
        ]);
        
        const svc = new GreenhouseMqttService({ 
          host: 'wss://serverdung.ddns.net:9002/mqtt',
          activationKey: activationKey || undefined,
          deviceId: deviceId || undefined,
        });
    svc.setListeners({
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onTelemetry: (d) => {
        lastRelayRef.current = { r1: d.r1, r2: d.r2 };
        setTele(d);
        // Lưu dữ liệu vào history
        historyService.addRecord(d);
        
        // Kiểm tra vượt ngưỡng (chỉ cảnh báo 1 lần mỗi 5 phút)
        const now = Date.now();
        if (now - lastAlarmTime.current > 5 * 60 * 1000) {
          const parts: string[] = [];
          
          // Kiểm tra nhiệt độ vượt ngưỡng
          if (typeof d.temp === 'number' && typeof d.t_thr === 'number') {
            if (d.temp > d.t_thr) {
              parts.push(`Nhiệt độ cao: ${d.temp.toFixed(1)}°C (ngưỡng: ${d.t_thr}°C)`);
            }
          }
          
          // Kiểm tra độ ẩm đất thấp hơn ngưỡng
          if (typeof d.soil === 'number' && typeof d.s_thr === 'number') {
            if (d.soil < d.s_thr) {
              parts.push(`Độ ẩm đất thấp: ${Math.round(d.soil)}% (ngưỡng: ${d.s_thr}%)`);
            }
          }
          
          if (parts.length > 0) {
            const body = parts.join(' | ');
            const title = '⚠️ Cảnh báo vượt ngưỡng';
            setAlarms(prev => [{ title, body, ts: now }, ...prev].slice(0, 10));
            setUnread(v => v + 1);
            showAlarmNotification(title, body);
            lastAlarmTime.current = now;
          }
        }
      },
      onAlarm: (a) => {
        // Bỏ qua alarm messages - đã chuyển sang kiểm tra trong onTelemetry
        // Điều này tránh spam notification khi toggle relay thủ công
        return;
      },
    });
    svc.connect();
    mqttRef.current = svc;
      } catch (err) {
        console.error('Error loading activation data:', err);
      }
    })();
    
    return () => {
      if (mqttRef.current) {
        mqttRef.current.disconnect();
        mqttRef.current = null;
      }
    };
  }, []);
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleManualControlToggle = (value: boolean) => {
    setManualControl(value);
    if (!value) {
      // Khi tắt manual control, chuyển cả 2 về auto
      setR1Mode('auto');
      setR2Mode('auto');
      mqttRef.current?.publishRelayCommand('auto', 'auto');
    }
  };

  const handleFanToggle = () => {
    if (!manualControl) return;
    const newState = tele?.r1 ? 0 : 1;
    setR1Mode('manual');
    // Optimistic update - cập nhật UI ngay lập tức
    if (tele) {
      setTele({ ...tele, r1: newState });
    }
    mqttRef.current?.publishRelayCommand(newState);
  };

  const handleFanAuto = () => {
    setR1Mode('auto');
    mqttRef.current?.publishRelayCommand('auto');
  };

  const handlePumpToggle = () => {
    if (!manualControl) return;
    const newState = tele?.r2 ? 0 : 1;
    setR2Mode('manual');
    // Optimistic update - cập nhật UI ngay lập tức
    if (tele) {
      setTele({ ...tele, r2: newState });
    }
    mqttRef.current?.publishRelayCommand(undefined, newState);
  };

  const handlePumpAuto = () => {
    setR2Mode('auto');
    mqttRef.current?.publishRelayCommand(undefined, 'auto');
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header>
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <Animated.Text
            style={{
              color: titleAnim.interpolate({ inputRange: [0, 1], outputRange: ['#065f46', '#16a34a'] }),
              fontWeight: '800',
              letterSpacing: 2,
              fontSize: 18,
            }}
          >
            GREENHOUSE
          </Animated.Text>
        </View>
        <View style={{ position: 'relative' }}>
          <Appbar.Action
            icon="bell"
            onPress={() => { 
              // Xóa toàn bộ thông báo/cảnh báo liên quan đến relay khỏi nguồn dữ liệu
              const cleaned = alarms.filter(a => !isRelayAlarm(a));
              if (cleaned.length !== alarms.length) setAlarms(cleaned);
              setUnread(0);
              navigation.navigate('Notifications', { 
                alarms: cleaned, 
                onClear: () => { setAlarms([]); setUnread(0); } 
              }); 
            }}
          />
          {unread > 0 && (
            <Badge style={{ position: 'absolute', top: 6, right: 6 }} size={14}>
              {unread}
            </Badge>
          )}
        </View>
      </Appbar.Header>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Sensor Cards */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {/* Temperature Card */}
          <Animated.View style={{ flex: 1, minWidth: '45%', opacity: c1, transform: [{ translateY: c1.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
            <Card style={{ backgroundColor: '#fee2e2' }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                    <IconButton icon="thermometer" size={20} iconColor="#fff" style={{ margin: 0 }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>Nhiệt độ</Text>
                </View>
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#dc2626' }}>
                  {tele ? (tele.temp < -50 ? '-99.9°C' : `${tele.temp.toFixed(1)}°C`) : '--.-°C'}
                </Text>
              </Card.Content>
            </Card>
          </Animated.View>

          {/* Air Humidity Card */}
          <Animated.View style={{ flex: 1, minWidth: '45%', opacity: c2, transform: [{ translateY: c2.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
            <Card style={{ backgroundColor: '#dbeafe' }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                    <IconButton icon="water" size={20} iconColor="#fff" style={{ margin: 0 }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>Độ ẩm không khí</Text>
                </View>
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#2563eb' }}>
                  {tele ? (tele.hum < 0 ? '-1%' : `${Math.round(tele.hum)}%`) : '--%'}
                </Text>
              </Card.Content>
            </Card>
          </Animated.View>

          {/* Soil Humidity Card */}
          <Animated.View style={{ width: '100%', opacity: c3, transform: [{ translateY: c3.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }] }}>
            <Card style={{ backgroundColor: '#fed7aa' }}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f97316', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                    <IconButton icon="water-percent" size={20} iconColor="#fff" style={{ margin: 0 }} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>Độ ẩm đất</Text>
                </View>
                <Text style={{ fontSize: 32, fontWeight: '700', color: '#ea580c' }}>
                  {tele ? `${Math.round(tele.soil)}%` : '--%'}
                </Text>
              </Card.Content>
            </Card>
          </Animated.View>
        </View>

        {/* Device Control Section */}
        <Card style={{ backgroundColor: '#f9fafb', elevation: 2 }}>
          <Card.Content>
            {/* Header */}
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>
                Điều khiển thiết bị
              </Text>
            </View>

            {/* Fan Control */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <IconButton icon="fan" size={24} iconColor="#6b7280" style={{ margin: 0, marginRight: 8 }} />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>Quạt</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {tele?.r1 ? 'Đang bật' : 'Đang tắt'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleFanToggle}
                  disabled={!manualControl}
                  style={[
                    styles.controlButton,
                    { 
                      borderColor: manualControl ? (tele?.r1 ? '#dc2626' : '#16a34a') : '#d1d5db', 
                      backgroundColor: manualControl && tele?.r1 ? '#fee2e2' : '#fff',
                      opacity: manualControl ? 1 : 0.5 
                    }
                  ]}
                >
                  <Text style={{ color: manualControl ? (tele?.r1 ? '#dc2626' : '#16a34a') : '#9ca3af', fontWeight: '600' }}>
                    {tele?.r1 ? 'TẮT' : 'BẬT'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleFanAuto}
                  style={[
                    styles.autoButton,
                    { borderColor: r1Mode === 'auto' ? '#16a34a' : '#d1d5db', backgroundColor: r1Mode === 'auto' ? '#f0fdf4' : '#fff' }
                  ]}
                >
                  <IconButton icon="cog" size={16} iconColor={r1Mode === 'auto' ? '#16a34a' : '#9ca3af'} style={{ margin: 0 }} />
                  <Text style={{ color: r1Mode === 'auto' ? '#16a34a' : '#6b7280', fontWeight: '600', fontSize: 12 }}>AUTO</Text>
                </TouchableOpacity>
              </View>
            </View>

          {/* Pump Control */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <IconButton icon="pump" size={24} iconColor="#6b7280" style={{ margin: 0, marginRight: 8 }} />
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>Bơm</Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {tele?.r2 ? 'Đang bật' : 'Đang tắt'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={handlePumpToggle}
                disabled={!manualControl}
                style={[
                  styles.controlButton,
                  { 
                    borderColor: manualControl ? (tele?.r2 ? '#dc2626' : '#16a34a') : '#d1d5db', 
                    backgroundColor: manualControl && tele?.r2 ? '#fee2e2' : '#fff',
                    opacity: manualControl ? 1 : 0.5 
                  }
                ]}
              >
                <Text style={{ color: manualControl ? (tele?.r2 ? '#dc2626' : '#16a34a') : '#9ca3af', fontWeight: '600' }}>
                  {tele?.r2 ? 'TẮT' : 'BẬT'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePumpAuto}
                style={[
                  styles.autoButton,
                  { borderColor: r2Mode === 'auto' ? '#16a34a' : '#d1d5db', backgroundColor: r2Mode === 'auto' ? '#f0fdf4' : '#fff' }
                ]}
              >
                <IconButton icon="auto-fix" size={16} iconColor={r2Mode === 'auto' ? '#16a34a' : '#9ca3af'} style={{ margin: 0 }} />
                <Text style={{ color: r2Mode === 'auto' ? '#16a34a' : '#6b7280', fontWeight: '600', fontSize: 12 }}>AUTO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card.Content>
      </Card>
      </ScrollView>
      <BottomTabs current="Dashboard" onNavigate={(key)=>{ 
        if (key==='Charts') navigation.navigate('Charts');
        else if (key==='Settings') navigation.navigate('Settings'); 
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  autoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
});