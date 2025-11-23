/**
 * Server Data Service
 * Fetch dữ liệu từ server khi app mở lại
 */

export type ServerDataRecord = {
  timestamp: number;
  temp: number;
  hum: number;
  soil: number;
  r1: number;
  r2: number;
  device_id: string;
  received_at: string;
};

export type ServerDataResponse = {
  success: boolean;
  data: ServerDataRecord[];
  total_records: number;
  filtered_records: number;
  server_time: string;
};

const API_BASE_URL = 'http://serverdung.ddns.net:8080/greenhouse/data_api.php';

export class ServerDataService {
  private static instance: ServerDataService;
  
  static getInstance(): ServerDataService {
    if (!this.instance) {
      this.instance = new ServerDataService();
    }
    return this.instance;
  }

  async fetchSensorData(hours: number = 24, limit: number = 100): Promise<ServerDataRecord[]> {
    try {
      const url = `${API_BASE_URL}?hours=${hours}&limit=${limit}`;
      console.log(`[ServerData] Fetching data from: ${url}`);

      // Tạo timeout thủ công cho React Native
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ServerDataResponse = await response.json();

      if (!result.success) {
        throw new Error('Server returned error response');
      }

      console.log(`[ServerData] Fetched ${result.filtered_records} records`);
      return result.data;

    } catch (error) {
      console.error('[ServerData] Error fetching data:', error);

      // Return empty array on error - app will fall back to local data
      return [];
    }
  }

  async syncWithLocalHistory(historyService: any): Promise<void> {
    try {
      console.log('[ServerData] Starting sync with server...');
      
      // Fetch last 24 hours of data
      const serverData = await this.fetchSensorData(24, 200);
      
      if (serverData.length === 0) {
        console.log('[ServerData] No server data available');
        return;
      }

      // Get local history
      const localHistory = await historyService.getHistory();
      
      // Find new records (not in local storage)
      const localTimestamps = new Set(localHistory.map((r: any) => r.timestamp));
      const newRecords = serverData.filter(record => 
        !localTimestamps.has(record.timestamp)
      );

      console.log(`[ServerData] Found ${newRecords.length} new records to sync`);

      // Add new records to local storage
      for (const record of newRecords) {
        const telemetryData = {
          temp: record.temp,
          hum: record.hum,
          soil: record.soil,
          r1: record.r1,
          r2: record.r2,
        };

        // Override timestamp to match server
        await historyService.addRecordWithTimestamp(telemetryData, record.timestamp);
      }

      console.log('[ServerData] Sync completed successfully');
      
    } catch (error) {
      console.error('[ServerData] Sync error:', error);
    }
  }

  // Check if we have recent data (within last 5 minutes)
  hasRecentData(records: ServerDataRecord[]): boolean {
    if (records.length === 0) return false;
    
    const latestTimestamp = Math.max(...records.map(r => r.timestamp));
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    return latestTimestamp > fiveMinutesAgo;
  }

  // Get data freshness status
  getDataStatus(records: ServerDataRecord[]): {
    status: 'fresh' | 'stale' | 'offline';
    lastUpdate: string;
    minutesAgo: number;
  } {
    if (records.length === 0) {
      return {
        status: 'offline',
        lastUpdate: 'Không có dữ liệu',
        minutesAgo: 0
      };
    }

    const latestTimestamp = Math.max(...records.map(r => r.timestamp));
    const minutesAgo = Math.floor((Date.now() - latestTimestamp) / (1000 * 60));
    const lastUpdate = new Date(latestTimestamp).toLocaleTimeString('vi-VN');

    let status: 'fresh' | 'stale' | 'offline';
    if (minutesAgo < 5) {
      status = 'fresh';
    } else if (minutesAgo < 30) {
      status = 'stale';
    } else {
      status = 'offline';
    }

    return {
      status,
      lastUpdate,
      minutesAgo
    };
  }
}
