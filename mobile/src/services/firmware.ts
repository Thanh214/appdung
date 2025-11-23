/**
 * Firmware Version Service
 * Kiểm tra phiên bản firmware từ server
 */

const SERVER_URL = 'http://serverdung.ddns.net:8080/greenhouse/version.php';

export type FirmwareVersionInfo = {
  version: string;
  filename: string;
  size: number;
  upload_time: string;
  device_type: string;
  download_url: string;
  server_time?: string;
};

export type FirmwareVersionResponse = {
  success: boolean;
  data?: FirmwareVersionInfo;
  message?: string;
};

/**
 * Normalize download URL để đảm bảo có port 8080
 */
function normalizeDownloadUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Nếu URL không có port và là http://serverdung.ddns.net, thêm port 8080
    if (!urlObj.port && urlObj.hostname === 'serverdung.ddns.net') {
      urlObj.port = '8080';
    }
    return urlObj.toString();
  } catch {
    // Nếu parse URL lỗi, trả về nguyên bản
    return url;
  }
}

/**
 * Lấy thông tin phiên bản firmware mới nhất từ server
 */
export async function checkFirmwareVersion(): Promise<FirmwareVersionResponse> {
  try {
    const response = await fetch(SERVER_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Lỗi kết nối server: ${response.status}`,
      };
    }

    const data = await response.json();
    
    // Normalize download_url nếu có
    if (data.success && data.data && data.data.download_url) {
      data.data.download_url = normalizeDownloadUrl(data.data.download_url);
    }
    
    return data;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Lỗi không xác định',
    };
  }
}

/**
 * So sánh 2 phiên bản firmware
 * @returns true nếu version1 < version2 (có phiên bản mới hơn)
 */
export function compareVersions(version1: string, version2: string): boolean {
  // So sánh version theo format semantic versioning (v1.0.0, 1.0.0, etc.)
  const normalize = (v: string) => {
    // Loại bỏ 'v' prefix nếu có
    v = v.replace(/^v/i, '');
    // Tách thành các phần
    const parts = v.split('.').map(Number);
    // Đảm bảo có ít nhất 3 phần
    while (parts.length < 3) parts.push(0);
    return parts;
  };

  const v1Parts = normalize(version1);
  const v2Parts = normalize(version2);

  for (let i = 0; i < 3; i++) {
    if (v1Parts[i] < v2Parts[i]) return true;
    if (v1Parts[i] > v2Parts[i]) return false;
  }

  return false; // Bằng nhau
}

