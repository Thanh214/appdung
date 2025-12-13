import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, View, Dimensions, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Text, Card, Appbar, useTheme, Button } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList } from '../../App';
import BottomTabs from '@/components/BottomTabs';
import { ServerDataService } from '@/services/serverData';

type Props = NativeStackScreenProps<RootStackParamList, 'Charts'>;

// Định nghĩa kiểu dữ liệu cho biểu đồ
type ChartData = {
  timestamp: number;
  temp: number;
  hum: number;
  soil: number;
  r1: number;
  r2: number;
};

export default function ChartsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [history, setHistory] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const serverDataService = useRef(ServerDataService.getInstance()).current;
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadDataFromServer();
  }, [selectedDate]);

  // Lấy dữ liệu trực tiếp từ server cho ngày được chọn
  const loadDataFromServer = async () => {
    setLoading(true);
    try {
      // Tính toán số giờ từ ngày được chọn đến hiện tại
      const now = new Date();
      const diffMs = now.getTime() - selectedDate.getTime();
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      const hours = Math.max(24, diffHours); // Tối thiểu 24 giờ
      const limit = hours * 60; // 60 records mỗi giờ

      console.log(`[Charts] Fetching data from ${selectedDate.toLocaleDateString('vi-VN')} (${hours}h)...`);
      const serverData = await serverDataService.fetchSensorData(hours, limit);

      // Chuyển đổi dữ liệu server thành format cho biểu đồ
      const chartData: ChartData[] = serverData.map(record => ({
        timestamp: record.timestamp,
        temp: record.temp,
        hum: record.hum,
        soil: record.soil,
        r1: record.r1,
        r2: record.r2,
      }));

      setHistory(chartData);
      console.log(`[Charts] Loaded ${chartData.length} records from server`);
    } catch (error) {
      console.error('[Charts] Error loading from server:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabPress = (key: 'Dashboard' | 'Charts' | 'Settings') => {
    if (key !== 'Charts') {
      navigation.navigate(key as any);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // Lọc dữ liệu chỉ lấy của ngày được chọn
  const getFilteredData = () => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return history.filter(record => {
      const recordDate = new Date(record.timestamp);
      return recordDate >= startOfDay && recordDate <= endOfDay;
    });
  };

  // Simple chart component
  const SimpleChart = ({ data, color, unit, height = 150 }: {
    data: number[];
    color: string;
    unit: string;
    height?: number;
  }) => {
    if (data.length === 0) {
      return (
        <View style={[styles.chartContainer, { height }]}>
          <Text style={{ color: '#666' }}>Không có dữ liệu</Text>
        </View>
      );
    }

    const chartWidth = screenWidth - 120;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    // Calculate points for line
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * chartWidth;
      const y = height - ((value - min) / range) * (height - 20) - 10;
      return { x, y };
    });

    return (
      <View style={[styles.chartContainer, { height: height + 40 }]}>
        {/* Chart area */}
        <View style={{
          width: chartWidth,
          height,
          backgroundColor: '#f9fafb',
          borderRadius: 8,
          position: 'relative',
          borderWidth: 1,
          borderColor: '#e5e7eb'
        }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: ratio * (height - 20) + 10,
                height: 1,
                backgroundColor: '#e5e7eb',
                opacity: 0.5
              }}
            />
          ))}
          
          {/* Data points and line */}
          {points.map((point, index) => (
            <View key={index}>
              {/* Line segment */}
              {index > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    left: points[index - 1].x,
                    top: points[index - 1].y,
                    width: Math.sqrt(
                      Math.pow(point.x - points[index - 1].x, 2) +
                      Math.pow(point.y - points[index - 1].y, 2)
                    ),
                    height: 2,
                    backgroundColor: color,
                    transform: [{
                      rotate: `${Math.atan2(
                        point.y - points[index - 1].y,
                        point.x - points[index - 1].x
                      )}rad`
                    }],
                    transformOrigin: 'left center'
                  }}
                />
              )}
              
              {/* Data point */}
              <View
                style={{
                  position: 'absolute',
                  left: point.x - 3,
                  top: point.y - 3,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: color,
                  borderWidth: 2,
                  borderColor: '#fff'
                }}
              />
            </View>
          ))}
        </View>
        
        {/* Y-axis labels */}
        <View style={{
          position: 'absolute',
          left: -50,
          top: 0,
          height,
          justifyContent: 'space-between',
          paddingVertical: 10
        }}>
          <Text style={{ fontSize: 10, color: '#666' }}>{max.toFixed(1)}{unit}</Text>
          <Text style={{ fontSize: 10, color: '#666' }}>{((min + max) / 2).toFixed(1)}{unit}</Text>
          <Text style={{ fontSize: 10, color: '#666' }}>{min.toFixed(1)}{unit}</Text>
        </View>
      </View>
    );
  };

  const renderChart = (
    title: string,
    field: 'temp' | 'hum' | 'soil',
    unit: string,
    color: string
  ) => {
    // Lấy dữ liệu đã filter theo ngày
    const filteredData = getFilteredData();

    if (filteredData.length === 0) {
      return (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.chartTitle}>
              {title}
            </Text>
            <View style={styles.noDataContainer}>
              <Text>Không có dữ liệu cho ngày {selectedDate.toLocaleDateString('vi-VN')}</Text>
            </View>
          </Card.Content>
        </Card>
      );
    }

    // Get chart data từ dữ liệu đã filter
    const sortedHistory = [...filteredData].sort((a, b) => a.timestamp - b.timestamp);
    const step = Math.max(1, Math.floor(sortedHistory.length / 20)); // Max 20 points
    const chartData = sortedHistory
      .filter((_, index) => index % step === 0)
      .map(record => record[field]);

    if (chartData.length === 0) {
      return (
        <Card style={styles.chartCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.chartTitle}>
              {title}
            </Text>
            <View style={styles.noDataContainer}>
              <Text>Chưa có dữ liệu cho khoảng thời gian này</Text>
            </View>
          </Card.Content>
        </Card>
      );
    }

    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    const latest = chartData[chartData.length - 1];

    return (
      <Card style={styles.chartCard}>
        <Card.Content>
          <View style={styles.chartHeader}>
            <View>
              <Text variant="titleMedium" style={styles.chartTitle}>
                {title}
              </Text>
              <Text variant="headlineSmall" style={[styles.currentValue, { color }]}>
                {latest?.toFixed(1) || '0.0'} {unit}
              </Text>
            </View>
            <View style={styles.statsContainer}>
              <Text variant="bodySmall" style={styles.statText}>
                Max: {max.toFixed(1)}{unit}
              </Text>
              <Text variant="bodySmall" style={styles.statText}>
                Min: {min.toFixed(1)}{unit}
              </Text>
            </View>
          </View>
          
          <SimpleChart 
            data={chartData}
            color={color}
            unit={unit}
            height={150}
          />
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.Content title="Biểu đồ" color="white" />
        <Appbar.Action
          icon="refresh"
          iconColor="white"
          onPress={loadDataFromServer}
          disabled={loading}
        />
      </Appbar.Header>

      {/* Loading Status */}
      {loading && (
        <View style={styles.syncStatus}>
          <Text style={styles.syncText}>Đang tải dữ liệu từ server...</Text>
        </View>
      )}

      <View style={styles.datePickerContainer}>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateLabel}>Chọn ngày:</Text>
          <Text style={styles.dateText}>
            {selectedDate.toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            locale="vi-VN"
          />
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderChart(
          'Nhiệt độ không khí',
          'temp',
          '°C',
          'rgba(239, 68, 68, 1)' // red-500
        )}

        {renderChart(
          'Độ ẩm không khí',
          'hum',
          '%',
          'rgba(59, 130, 246, 1)' // blue-500
        )}

        {renderChart(
          'Độ ẩm đất',
          'soil',
          '%',
          'rgba(34, 197, 94, 1)' // green-500
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <BottomTabs current="Charts" onNavigate={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fef9c3',
  },
  datePickerContainer: {
    padding: 16,
    backgroundColor: '#fef9c3',
  },
  dateButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  chartCard: {
    marginBottom: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  currentValue: {
    fontWeight: 'bold',
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statText: {
    color: '#6b7280',
  },
  chart: {
    borderRadius: 16,
  },
  chartContainer: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomPadding: {
    height: 100,
  },
  syncStatus: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  syncText: {
    fontSize: 12,
    color: '#15803d',
    textAlign: 'center',
  },
});
