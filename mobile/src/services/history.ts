import AsyncStorage from '@react-native-async-storage/async-storage';
import { Telemetry } from './mqtt';

export type HistoryData = {
  timestamp: number;
  temp: number;
  hum: number;
  soil: number;
  r1: number;
  r2: number;
};

const STORAGE_KEY = 'greenhouse_history';
const MAX_RECORDS = 288; // 24 hours * 12 (5 min intervals)

export class HistoryService {
  private static instance: HistoryService;
  
  static getInstance(): HistoryService {
    if (!this.instance) {
      this.instance = new HistoryService();
    }
    return this.instance;
  }

  async addRecord(telemetry: Telemetry): Promise<void> {
    try {
      const history = await this.getHistory();
      const newRecord: HistoryData = {
        timestamp: Date.now(),
        temp: telemetry.temp || 0,
        hum: telemetry.hum || 0,
        soil: telemetry.soil || 0,
        r1: telemetry.r1 || 0,
        r2: telemetry.r2 || 0,
      };

      // Thêm record mới và giữ tối đa MAX_RECORDS
      const updatedHistory = [newRecord, ...history].slice(0, MAX_RECORDS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error saving history record:', error);
    }
  }

  async getHistory(): Promise<HistoryData[]> {
    try {
      const historyString = await AsyncStorage.getItem(STORAGE_KEY);
      if (historyString) {
        return JSON.parse(historyString);
      }
      return [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  async getLastHours(hours: number = 24): Promise<HistoryData[]> {
    try {
      const history = await this.getHistory();
      const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
      return history.filter(record => record.timestamp > cutoffTime);
    } catch (error) {
      console.error('Error getting history for last hours:', error);
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  // Add record with custom timestamp (for server sync)
  async addRecordWithTimestamp(telemetry: Telemetry, timestamp: number): Promise<void> {
    try {
      const history = await this.getHistory();
      const newRecord: HistoryData = {
        timestamp,
        temp: telemetry.temp || 0,
        hum: telemetry.hum || 0,
        soil: telemetry.soil || 0,
        r1: telemetry.r1 || 0,
        r2: telemetry.r2 || 0,
      };

      // Check if record already exists
      const exists = history.some(record => record.timestamp === timestamp);
      if (exists) {
        return; // Skip duplicate
      }

      // Add record and sort by timestamp
      const updatedHistory = [newRecord, ...history]
        .sort((a, b) => b.timestamp - a.timestamp) // Newest first
        .slice(0, MAX_RECORDS);
        
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Error saving history record with timestamp:', error);
    }
  }

  // Format data cho chart
  formatDataForChart(history: HistoryData[], field: keyof Pick<HistoryData, 'temp' | 'hum' | 'soil'>) {
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const labels = sortedHistory.map(record => {
      const date = new Date(record.timestamp);
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    });
    
    const data = sortedHistory.map(record => record[field]);
    
    // Lấy tối đa 20 điểm data để chart không quá dày
    const step = Math.max(1, Math.floor(sortedHistory.length / 20));
    
    return {
      labels: labels.filter((_, index) => index % step === 0),
      data: data.filter((_, index) => index % step === 0),
    };
  }
}