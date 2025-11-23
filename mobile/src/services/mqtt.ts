import { Client, Message } from 'paho-mqtt';

export type Telemetry = {
  id?: string;
  temp: number;
  hum: number;
  soil: number;
  r1: number;
  r2: number;
  t_thr: number;
  s_thr: number;
};

export type MqttConfig = {
  host: string; // e.g. ws://192.168.1.171:9001/mqtt
  clientId?: string;
  username?: string;
  password?: string;
  activationKey?: string; // Key đã kích hoạt (ví dụ: ABC123)
  deviceId?: string; // Device ID tương ứng (ví dụ: GH001)
};

export type ActivationResponse = {
  cmd?: string;
  ok?: boolean;
  id?: string;
  key?: string;
  version?: string;
  mac?: string;
  uptime?: number;
  fingerprint?: string;
  timestamp?: number;
};

export type InfoResponse = {
  ok?: boolean;
  id?: string;
  key?: string;
  version?: string;
  fw_ver?: string;
  build_date?: string;
  build_time?: string;
};

export class GreenhouseMqttService {
  private client: Client | null = null;
  private onTelemetry?: (data: Telemetry) => void;
  private onStatus?: (status: { id?: string; online?: boolean }) => void;
  private onAck?: (ack: { ok: boolean; t_thr?: number; s_thr?: number }) => void;
  private onConnected?: () => void;
  private onDisconnected?: () => void;
  private onAlarm?: (alarm: { id?: string; r1?: number; r2?: number; temp?: number; soil?: number }) => void;
  private onActivationResponse?: (response: ActivationResponse) => void;
  private onInfo?: (info: InfoResponse) => void;
  private activationKey?: string;
  private deviceId?: string;

  constructor(private cfg: MqttConfig) {
    this.activationKey = cfg.activationKey?.toUpperCase();
    this.deviceId = cfg.deviceId?.toUpperCase();
  }

  setListeners(listeners: {
    onTelemetry?: (data: Telemetry) => void;
    onStatus?: (status: { id?: string; online?: boolean }) => void;
    onAck?: (ack: { ok: boolean; t_thr?: number; s_thr?: number }) => void;
    onAlarm?: (alarm: { id?: string; r1?: number; r2?: number; temp?: number; soil?: number }) => void;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onActivationResponse?: (response: ActivationResponse) => void;
    onInfo?: (info: InfoResponse) => void;
  }) {
    this.onTelemetry = listeners.onTelemetry;
    this.onStatus = listeners.onStatus;
    this.onAck = listeners.onAck;
    this.onAlarm = listeners.onAlarm;
    this.onConnected = listeners.onConnected;
    this.onDisconnected = listeners.onDisconnected;
    this.onActivationResponse = listeners.onActivationResponse;
    this.onInfo = listeners.onInfo;
  }

  connect() {
    if (this.client) return;
    const url = new URL(this.cfg.host);
    const path = url.pathname && url.pathname !== '/' ? url.pathname : '/mqtt';
    const clientId = this.cfg.clientId ?? `rn-${Math.random().toString(16).slice(2)}`;
    const client = new Client(url.hostname, Number(url.port || 80), path, clientId);
    this.client = client;

    client.onConnectionLost = () => {
      this.onDisconnected?.();
      setTimeout(() => this.reconnect(), 1500);
    };
    client.onMessageArrived = (msg: Message) => {
      try {
        const topic = msg.destinationName;
        const payload = JSON.parse(msg.payloadString || '{}');
        
        // Nếu có activationKey, chỉ xử lý topics của Key đó
        if (this.activationKey) {
          const keyPrefix = `greenhouse/${this.activationKey}/`;
          
          // Chỉ xử lý nếu topic bắt đầu với keyPrefix
          if (!topic.startsWith(keyPrefix)) {
            return; // Bỏ qua dữ liệu từ thiết bị khác
          }
          
          // Kiểm tra device ID trong payload (nếu có)
          if (this.deviceId && payload.id) {
            const payloadId = (payload.id as string).toUpperCase();
            if (payloadId !== this.deviceId) {
              return; // Bỏ qua nếu device ID không khớp
            }
          }
          
          // Xử lý các topics cụ thể
          if (topic === `${keyPrefix}telemetry`) {
            this.onTelemetry?.(payload as Telemetry);
          } else if (topic === `${keyPrefix}status`) {
            this.onStatus?.(payload as { id?: string; online?: boolean });
          } else if (topic === `${keyPrefix}ack`) {
            // Handle both regular ack and activation response
            if (payload.cmd === 'activation_response') {
              this.onActivationResponse?.(payload as ActivationResponse);
            } else {
              this.onAck?.(payload as { ok: boolean; t_thr?: number; s_thr?: number });
            }
          } else if (topic === `${keyPrefix}alarm`) {
            this.onAlarm?.(payload as { id?: string; r1?: number; r2?: number; temp?: number; soil?: number });
          } else if (topic === `${keyPrefix}${this.deviceId}/info` || topic.endsWith('/info')) {
            // Xử lý info response (khi request get_info)
            // Info response có format: {"ok":true,"id":"...","key":"...","version":"...","fw_ver":"...",...}
            this.onInfo?.(payload as InfoResponse);
          } else if (topic === `${keyPrefix}${this.deviceId}/config` || topic.endsWith('/config')) {
            // Xử lý config response (khi request get_config)
            // Config response có format: {"t_thr":38.0,"s_thr":60}
            if (typeof payload.t_thr === 'number' || typeof payload.s_thr === 'number') {
              this.onAck?.(payload as { ok: boolean; t_thr?: number; s_thr?: number });
            }
          }
        } else {
          // Fallback: xử lý wildcard topics (cho activation screen)
          // Topic format: greenhouse/{KEY}/telemetry, greenhouse/{KEY}/status, ...
          const topicParts = topic.split('/');
          
          if (topicParts.length >= 3 && topicParts[0] === 'greenhouse') {
            const topicType = topicParts[2]; // telemetry, status, ack, alarm
            
            if (topicType === 'telemetry') {
              this.onTelemetry?.(payload as Telemetry);
            } else if (topicType === 'status') {
              this.onStatus?.(payload as { id?: string; online?: boolean });
            } else if (topicType === 'ack') {
              // Handle both regular ack and activation response
              if (payload.cmd === 'activation_response') {
                this.onActivationResponse?.(payload as ActivationResponse);
              } else {
                this.onAck?.(payload as { ok: boolean; t_thr?: number; s_thr?: number });
              }
            } else if (topicType === 'alarm') {
              this.onAlarm?.(payload as { id?: string; r1?: number; r2?: number; temp?: number; soil?: number });
            }
          }
        }
      } catch {}
    };

    const options: any = {
      useSSL: url.protocol === 'wss:',
      onSuccess: () => {
        this.onConnected?.();
        // Nếu có activationKey, subscribe vào topics của Key đó
        if (this.activationKey) {
          const keyPrefix = `greenhouse/${this.activationKey}/`;
          client.subscribe(`${keyPrefix}telemetry`, { qos: 0 });
          client.subscribe(`${keyPrefix}status`, { qos: 0 });
          client.subscribe(`${keyPrefix}ack`, { qos: 0 });
          client.subscribe(`${keyPrefix}alarm`, { qos: 0 });
          // Subscribe topic config và info để nhận config/info response
          if (this.deviceId) {
            client.subscribe(`${keyPrefix}${this.deviceId}/config`, { qos: 0 });
            client.subscribe(`${keyPrefix}${this.deviceId}/info`, { qos: 0 });
          }
        } else {
          // Fallback: subscribe wildcard để nhận TẤT CẢ các thiết bị (cho activation screen)
          // + = wildcard cho bất kỳ KEY nào (ABC123, XYZ789, ...)
          client.subscribe('greenhouse/+/telemetry', { qos: 0 });
          client.subscribe('greenhouse/+/status', { qos: 0 });
          client.subscribe('greenhouse/+/ack', { qos: 0 });
          client.subscribe('greenhouse/+/alarm', { qos: 0 });
        }
      },
      onFailure: () => {
        this.onDisconnected?.();
        setTimeout(() => this.reconnect(), 1500);
      },
      timeout: 4,
    };
    if (typeof this.cfg.username === 'string') options.userName = this.cfg.username;
    if (typeof this.cfg.password === 'string') options.password = this.cfg.password;
    client.connect(options);
  }

  reconnect() {
    if (!this.client) return;
    try { this.client.disconnect(); } catch {}
    this.client = null;
    this.connect();
  }

  disconnect() {
    if (!this.client) return;
    try {
      this.client.disconnect();
      this.onDisconnected?.();
    } catch {}
    this.client = null;
  }

  publishConfig(thresholdTemp: number, thresholdSoil: number) {
    if (!this.client || !this.client.isConnected()) return;
    if (!this.activationKey || !this.deviceId) {
      console.warn('Cannot publish config: missing activationKey or deviceId');
      return;
    }
    const payload = JSON.stringify({ t_thr: thresholdTemp, s_thr: thresholdSoil });
    const msg = new Message(payload);
    // Publish đến topic: greenhouse/{KEY}/{DEVICE_ID}/config
    msg.destinationName = `greenhouse/${this.activationKey}/${this.deviceId}/config`;
    this.client.send(msg);
  }

  // Subscribe to a specific topic (for activation)
  subscribe(topic: string) {
    if (!this.client || !this.client.isConnected()) return;
    this.client.subscribe(topic, { qos: 0 });
  }

  // Publish activation command
  // Firmware subscribes to: greenhouse/{KEY}/{DEVICE_ID}/config or greenhouse/{KEY}/{DEVICE_ID}/cmd
  publishActivate(key: string, deviceId: string, fingerprint: string) {
    if (!this.client || !this.client.isConnected()) return;
    const payload = JSON.stringify({ cmd: 'activate', fingerprint });
    const msg = new Message(payload);
    // Send to config topic: greenhouse/{KEY}/{DEVICE_ID}/config
    msg.destinationName = `greenhouse/${key.toUpperCase()}/${deviceId.toUpperCase()}/config`;
    this.client.send(msg);
  }

  // Publish relay command (manual control or auto mode)
  // r1/r2: 0 = off, 1 = on, "auto" = auto mode
  publishRelayCommand(r1?: number | 'auto', r2?: number | 'auto') {
    if (!this.client || !this.client.isConnected()) return;
    if (!this.activationKey || !this.deviceId) {
      console.warn('Cannot publish relay command: missing activationKey or deviceId');
      return;
    }
    const payload: any = {};
    if (r1 !== undefined) payload.r1 = r1;
    if (r2 !== undefined) payload.r2 = r2;
    const msg = new Message(JSON.stringify(payload));
    // Publish đến topic: greenhouse/{KEY}/{DEVICE_ID}/config
    msg.destinationName = `greenhouse/${this.activationKey}/${this.deviceId}/config`;
    this.client.send(msg);
  }

  // Request config from device (publish get_config command)
  requestConfig() {
    if (!this.client || !this.client.isConnected()) return;
    if (!this.activationKey || !this.deviceId) {
      console.warn('Cannot request config: missing activationKey or deviceId');
      return;
    }
    const payload = JSON.stringify({ cmd: 'get_config' });
    const msg = new Message(payload);
    // Publish đến topic: greenhouse/{KEY}/{DEVICE_ID}/cmd hoặc config
    msg.destinationName = `greenhouse/${this.activationKey}/${this.deviceId}/cmd`;
    this.client.send(msg);
  }

  // Request info from device (publish get_info command)
  requestInfo() {
    if (!this.client || !this.client.isConnected()) return;
    if (!this.activationKey || !this.deviceId) {
      console.warn('Cannot request info: missing activationKey or deviceId');
      return;
    }
    const payload = JSON.stringify({ cmd: 'get_info' });
    const msg = new Message(payload);
    // Publish đến topic: greenhouse/{KEY}/{DEVICE_ID}/cmd
    msg.destinationName = `greenhouse/${this.activationKey}/${this.deviceId}/cmd`;
    this.client.send(msg);
  }

  // Check if MQTT is connected
  isConnected(): boolean {
    return this.client?.isConnected() ?? false;
  }

  // Publish OTA update command
  // Gửi lệnh OTA update với URL firmware từ server
  // Firmware chỉ nhận "cmd":"ota" (không phải "ota_update") và gửi đến topic /ota
  publishOTAUpdate(firmwareUrl: string) {
    if (!this.client || !this.client.isConnected()) return;
    if (!this.activationKey || !this.deviceId) {
      console.warn('Cannot publish OTA update: missing activationKey or deviceId');
      return;
    }
    // Firmware chỉ nhận "cmd":"ota" (không phải "ota_update")
    // Gửi đến topic /ota để firmware chắc chắn nhận được
    const payload = JSON.stringify({ 
      cmd: 'ota',
      url: firmwareUrl 
    });
    const msg = new Message(payload);
    // Publish đến topic: greenhouse/{KEY}/{DEVICE_ID}/ota
    // Firmware subscribe cả /cmd và /ota, nhưng /ota chắc chắn hơn
    msg.destinationName = `greenhouse/${this.activationKey}/${this.deviceId}/ota`;
    this.client.send(msg);
    console.log(`[OTA] Sent OTA command to topic: ${msg.destinationName}`);
  }
}


