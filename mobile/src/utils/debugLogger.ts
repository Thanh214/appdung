/**
 * Debug Logger
 * Centralized logging system for debugging
 */

export type LogEntry = {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'success';
  tag: string;
  message: string;
  data?: any;
};

class DebugLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 200;
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  log(level: 'info' | 'warn' | 'error' | 'success', tag: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      tag,
      message,
      data,
    };

    this.logs.push(entry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also log to console
    const emoji = {
      info: '📘',
      warn: '⚠️',
      error: '❌',
      success: '✅',
    }[level];

    console.log(`${emoji} [${tag}] ${message}`, data || '');

    // Notify listeners
    this.notifyListeners();
  }

  info(tag: string, message: string, data?: any) {
    this.log('info', tag, message, data);
  }

  warn(tag: string, message: string, data?: any) {
    this.log('warn', tag, message, data);
  }

  error(tag: string, message: string, data?: any) {
    this.log('error', tag, message, data);
  }

  success(tag: string, message: string, data?: any) {
    this.log('success', tag, message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
    this.notifyListeners();
  }

  addListener(callback: (logs: LogEntry[]) => void) {
    this.listeners.push(callback);
  }

  removeListener(callback: (logs: LogEntry[]) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.logs]));
  }
}

export const logger = new DebugLogger();
