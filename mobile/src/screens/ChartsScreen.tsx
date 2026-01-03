import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, View, Dimensions, StyleSheet, Platform, TouchableOpacity, Modal } from 'react-native';
import { Text, Card, Appbar, useTheme, Button, IconButton } from 'react-native-paper';
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
  const [modalVisible, setModalVisible] = useState(false);
  const [modalChartData, setModalChartData] = useState<{
    title: string;
    data: number[];
    timestamps: number[];
    color: string;
    unit: string;
  } | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '3h' | '6h' | '12h'>('all');
  const [autoScale, setAutoScale] = useState(false);
  const serverDataService = useRef(ServerDataService.getInstance()).current;
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    loadDataFromServer();
  }, [selectedDate]);

  // Lấy dữ liệu trực tiếp từ server cho ngày được chọn
  const loadDataFromServer = async () => {
    setLoading(true);
    try {
      // Tính toán số giờ từ ngày được chọn đến hiện tại
      const now = new Date();
      const selectedDateStart = new Date(selectedDate);
      selectedDateStart.setHours(0, 0, 0, 0);
      
      const diffMs = now.getTime() - selectedDateStart.getTime();
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
      console.log(`[Charts] Sample timestamps:`, chartData.slice(0, 3).map(d => ({
        timestamp: d.timestamp,
        date: new Date(d.timestamp).toLocaleString('vi-VN')
      })));
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

  // Filter dữ liệu theo khoảng thời gian
  const getFilteredModalData = () => {
    if (!modalChartData || timeFilter === 'all') {
      return modalChartData;
    }

    const now = Date.now();
    const filterHours = {
      '1h': 1,
      '3h': 3,
      '6h': 6,
      '12h': 12
    }[timeFilter] || 24;

    const cutoffTime = now - (filterHours * 60 * 60 * 1000);
    
    const filteredIndices = modalChartData.timestamps
      .map((ts, index) => ({ ts, index }))
      .filter(item => item.ts >= cutoffTime)
      .map(item => item.index);

    if (filteredIndices.length === 0) {
      return modalChartData;
    }

    return {
      ...modalChartData,
      data: filteredIndices.map(i => modalChartData.data[i]),
      timestamps: filteredIndices.map(i => modalChartData.timestamps[i])
    };
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

    const startTimestamp = startOfDay.getTime();
    const endTimestamp = endOfDay.getTime();

    const filtered = history.filter(record => {
      // Đảm bảo timestamp là milliseconds
      const recordTimestamp = record.timestamp;
      return recordTimestamp >= startTimestamp && recordTimestamp <= endTimestamp;
    });

    console.log(`[Charts] Filtering for ${selectedDate.toLocaleDateString('vi-VN')}`);
    console.log(`[Charts] Start: ${startOfDay.toLocaleString('vi-VN')} (${startTimestamp})`);
    console.log(`[Charts] End: ${endOfDay.toLocaleString('vi-VN')} (${endTimestamp})`);
    console.log(`[Charts] Total records: ${history.length}, Filtered: ${filtered.length}`);
    
    if (filtered.length > 0) {
      console.log(`[Charts] First record:`, {
        timestamp: filtered[0].timestamp,
        date: new Date(filtered[0].timestamp).toLocaleString('vi-VN')
      });
      console.log(`[Charts] Last record:`, {
        timestamp: filtered[filtered.length - 1].timestamp,
        date: new Date(filtered[filtered.length - 1].timestamp).toLocaleString('vi-VN')
      });
    }

    return filtered;
  };

  // Simple chart component
  const SimpleChart = ({ data, timestamps, color, unit, height = 150, enableTouch = false, useAutoScale = false }: {
    data: number[];
    timestamps: number[];
    color: string;
    unit: string;
    height?: number;
    enableTouch?: boolean;
    useAutoScale?: boolean;
  }) => {
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

    if (data.length === 0) {
      return (
        <View style={[styles.chartContainer, { height }]}>
          <Text style={{ color: '#666' }}>Không có dữ liệu</Text>
        </View>
      );
    }

    const chartWidth = enableTouch ? screenWidth - 80 : screenWidth - 120;
    
    // Trục Y: Tự động hoặc cố định 0-100
    const minY = useAutoScale ? Math.floor(Math.min(...data) / 10) * 10 : 0;
    const maxY = useAutoScale ? Math.ceil(Math.max(...data) / 10) * 10 : 100;
    const rangeY = maxY - minY;
    
    // Calculate points for line
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * chartWidth;
      // Map giá trị vào khoảng 0-100
      const normalizedValue = Math.max(minY, Math.min(maxY, value));
      const y = height - ((normalizedValue - minY) / rangeY) * (height - 20) - 10;
      return { x, y };
    });

    // Tạo mốc thời gian cho trục X (hiển thị 5 mốc)
    const timeLabels = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const index = Math.floor(ratio * (timestamps.length - 1));
      const timestamp = timestamps[index];
      const date = new Date(timestamp);
      return {
        x: ratio * chartWidth,
        label: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
    });

    // Tạo mốc cho trục Y
    let yLabels: number[];
    if (useAutoScale) {
      // Tạo 6 mốc từ min đến max
      yLabels = Array.from({ length: 6 }, (_, i) => minY + (rangeY / 5) * i);
    } else {
      // Mốc cố định 0-100
      yLabels = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    }

    // Handle touch on chart
    const handleTouch = (event: any) => {
      if (!enableTouch) return;
      
      const { locationX } = event.nativeEvent;
      
      // Tìm điểm gần nhất
      let closestIndex = 0;
      let minDistance = Math.abs(points[0].x - locationX);
      
      points.forEach((point, index) => {
        const distance = Math.abs(point.x - locationX);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      setSelectedPoint(closestIndex);
    };

    return (
      <View style={[styles.chartContainer, { height: height + 60 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Y-axis labels bên trái */}
          <View style={{
            height,
            width: 35,
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingRight: 5
          }}>
            {/* Hiển thị từ max xuống min (đảo ngược mảng) */}
            {(useAutoScale 
              ? yLabels.slice().reverse().filter((_, i) => i % Math.ceil(yLabels.length / 6) === 0).slice(0, 6)
              : [100, 80, 60, 40, 20, 0]
            ).map((value, index) => (
              <Text key={index} style={{ fontSize: 9, color: '#666', textAlign: 'right' }}>
                {useAutoScale ? value.toFixed(0) : value}{unit}
              </Text>
            ))}
          </View>

          {/* Chart area */}
          <View 
            style={{
              width: chartWidth,
              height,
              backgroundColor: '#f9fafb',
              borderRadius: 8,
              position: 'relative',
              borderWidth: 1,
              borderColor: '#e5e7eb'
            }}
            onStartShouldSetResponder={() => enableTouch}
            onResponderGrant={enableTouch ? handleTouch : undefined}
            onResponderMove={enableTouch ? handleTouch : undefined}
            onResponderRelease={enableTouch ? () => setSelectedPoint(null) : undefined}
          >
          {/* Grid lines */}
          {yLabels.map((value, index) => {
            const ratio = (maxY - value) / rangeY;
            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: ratio * (height - 20) + 10,
                  height: 1,
                  backgroundColor: '#e5e7eb',
                  opacity: useAutoScale ? 0.5 : (value % 20 === 0 ? 0.7 : 0.3)
                }}
              />
            );
          })}
          
          {/* Vertical grid lines for time */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => (
            <View
              key={`v-${index}`}
              style={{
                position: 'absolute',
                left: ratio * chartWidth,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: '#e5e7eb',
                opacity: 0.3
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
              
              {/* Highlight selected point */}
              {enableTouch && selectedPoint === index && (
                <>
                  {/* Vertical line */}
                  <View
                    style={{
                      position: 'absolute',
                      left: point.x,
                      top: 0,
                      bottom: 0,
                      width: 1,
                      backgroundColor: color,
                      opacity: 0.5
                    }}
                  />
                  
                  {/* Larger point */}
                  <View
                    style={{
                      position: 'absolute',
                      left: point.x - 6,
                      top: point.y - 6,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: color,
                      borderWidth: 3,
                      borderColor: '#fff'
                    }}
                  />
                  
                  {/* Tooltip */}
                  <View
                    style={{
                      position: 'absolute',
                      left: point.x - 50,
                      top: point.y - 50,
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      padding: 8,
                      borderRadius: 6,
                      minWidth: 100,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                      {data[index].toFixed(1)}{unit}
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 9, marginTop: 2 }}>
                      {new Date(timestamps[index]).toLocaleTimeString('vi-VN', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ))}
          </View>
        </View>
        
        {/* X-axis time labels */}
        <View style={{
          width: chartWidth,
          height: 30,
          marginTop: 5,
          marginLeft: 40,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {timeLabels.map((label, index) => (
            <Text 
              key={index}
              style={{ 
                fontSize: 9, 
                color: '#666',
                textAlign: 'center',
                width: 40
              }}
            >
              {label.label}
            </Text>
          ))}
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
    const sampledData = sortedHistory.filter((_, index) => index % step === 0);
    const chartData = sampledData.map(record => record[field]);
    const timestamps = sampledData.map(record => record.timestamp);

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
          
          <TouchableOpacity 
            onPress={() => {
              setModalChartData({
                title,
                data: chartData,
                timestamps,
                color,
                unit
              });
              setModalVisible(true);
              setTimeFilter('all');
              setAutoScale(false);
            }}
            activeOpacity={0.8}
          >
            <SimpleChart 
              data={chartData}
              timestamps={timestamps}
              color={color}
              unit={unit}
              height={150}
              enableTouch={false}
            />
          </TouchableOpacity>
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

      {/* Modal hiển thị biểu đồ phóng to */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
            <Appbar.BackAction onPress={() => setModalVisible(false)} color="white" />
            <Appbar.Content title={modalChartData?.title || 'Biểu đồ chi tiết'} color="white" />
          </Appbar.Header>

          <ScrollView 
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalContent}
          >
            {modalChartData && (
              <View style={styles.modalChartWrapper}>
                {/* Filter buttons */}
                <View style={styles.filterContainer}>
                  <Text style={styles.filterLabel}>Khoảng thời gian:</Text>
                  <View style={styles.filterButtons}>
                    {(['all', '1h', '3h', '6h', '12h'] as const).map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.filterButton,
                          timeFilter === filter && styles.filterButtonActive
                        ]}
                        onPress={() => setTimeFilter(filter)}
                      >
                        <Text style={[
                          styles.filterButtonText,
                          timeFilter === filter && styles.filterButtonTextActive
                        ]}>
                          {filter === 'all' ? 'Tất cả' : filter.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Auto scale toggle */}
                <View style={styles.scaleToggle}>
                  <Text style={styles.scaleLabel}>Tự động điều chỉnh trục Y:</Text>
                  <TouchableOpacity
                    style={[styles.toggleButton, autoScale && styles.toggleButtonActive]}
                    onPress={() => setAutoScale(!autoScale)}
                  >
                    <Text style={[styles.toggleText, autoScale && styles.toggleTextActive]}>
                      {autoScale ? 'BẬT' : 'TẮT'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalHint}>
                  💡 Chạm vào biểu đồ để xem chi tiết từng điểm dữ liệu
                </Text>
                
                <SimpleChart
                  data={getFilteredModalData()?.data || []}
                  timestamps={getFilteredModalData()?.timestamps || []}
                  color={modalChartData.color}
                  unit={modalChartData.unit}
                  height={screenHeight * 0.5}
                  enableTouch={true}
                  useAutoScale={autoScale}
                />

                {/* Thống kê chi tiết */}
                <View style={styles.detailStats}>
                  <Text style={styles.detailStatsTitle}>Thống kê chi tiết</Text>
                  
                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Giá trị cao nhất:</Text>
                    <Text style={[styles.statValue, { color: modalChartData.color }]}>
                      {Math.max(...(getFilteredModalData()?.data || [])).toFixed(1)}{modalChartData.unit}
                    </Text>
                  </View>

                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Giá trị thấp nhất:</Text>
                    <Text style={[styles.statValue, { color: modalChartData.color }]}>
                      {Math.min(...(getFilteredModalData()?.data || [])).toFixed(1)}{modalChartData.unit}
                    </Text>
                  </View>

                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Giá trị trung bình:</Text>
                    <Text style={[styles.statValue, { color: modalChartData.color }]}>
                      {((getFilteredModalData()?.data || []).reduce((a, b) => a + b, 0) / (getFilteredModalData()?.data.length || 1)).toFixed(1)}{modalChartData.unit}
                    </Text>
                  </View>

                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Số điểm dữ liệu:</Text>
                    <Text style={styles.statValue}>
                      {getFilteredModalData()?.data.length || 0} điểm
                    </Text>
                  </View>

                  <View style={styles.statRow}>
                    <Text style={styles.statLabel}>Khoảng thời gian:</Text>
                    <Text style={styles.statValue}>
                      {getFilteredModalData()?.timestamps.length ? (
                        <>
                          {new Date(getFilteredModalData()!.timestamps[0]).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {new Date(getFilteredModalData()!.timestamps[getFilteredModalData()!.timestamps.length - 1]).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </>
                      ) : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

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
    paddingHorizontal: 5,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#fef9c3',
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
  },
  modalChartWrapper: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  modalHint: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  detailStats: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  detailStatsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1f2937',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  scaleToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  scaleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  toggleButtonActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#fff',
  },
});
