#include "wifi_manager.h"
#include "config.h"
#include <Preferences.h>

extern Preferences prefs;

static char g_wifiSsid[33] = {0};
static char g_wifiPass[65] = {0};
static WebServer* g_portal = nullptr;
static bool g_portalActive = false;
static uint32_t g_wifiAttemptStart = 0;

// HTML template for WiFi configuration portal
const char PAGE_TMPL[] PROGMEM = R"rawliteral(
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Greenhouse WiFi</title>
  <style>
    * { box-sizing: border-box }
    body { margin:0; font-family: system-ui,-apple-system, Segoe UI, Roboto, Arial; background:#f0fdf4; color:#064e3b; }
    .container { max-width:720px; margin:0 auto; padding:16px; min-height:100vh; display:flex; align-items:center; justify-content:center; }
    .card { background:#ffffff; border-radius:14px; box-shadow:0 6px 16px rgba(0,0,0,.08); padding:20px; border:1px solid #e2e8f0; }
    .title { display:flex; align-items:center; gap:10px; margin:0 0 12px; color:#065f46; }
    .title .dot { width:10px; height:10px; border-radius:50%; background:#16a34a; box-shadow:0 0 0 4px rgba(22,163,74,.2); }
    .group { margin:12px 0 }
    label { display:block; font-size:14px; margin-bottom:6px; color:#065f46; font-weight:600 }
    select, input { width:100%; border:1px solid #94a3b8; border-radius:10px; padding:10px 12px; font-size:16px; outline:none }
    select:focus, input:focus { border-color:#16a34a; box-shadow:0 0 0 3px rgba(22,163,74,.25) }
    .row { display:flex; gap:10px }
    .btn { display:inline-block; text-decoration:none; background:#16a34a; color:#fff; border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer }
    .btn.secondary { background:#065f46 }
    .btn:active { transform:scale(.98) }
    footer { margin-top:10px; color:#64748b; font-size:12px; text-align:center }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h2 class="title"><span class="dot"></span>Thiết lập WiFi</h2>
      <form method="post" action="/save">
        <div class="group">
          <label>SSID</label>
          <select name="ssid">
            {{OPTIONS}}
          </select>
        </div>
        <div class="group">
          <label>Mật khẩu</label>
          <input name="pass" type="password" placeholder="Password"/>
        </div>
        <div class="row">
          <button class="btn" type="submit">Lưu & Kết nối</button>
          <a class="btn secondary" href="/">Quét lại</a>
        </div>
      </form>
      <footer>Greenhouse AP 192.168.4.1</footer>
    </div>
  </div>
</body>
</html>
)rawliteral";

String buildOptions() {
  int n = WiFi.scanNetworks(false, true); // sync scan, include hidden
  String opts;
  for (int i = 0; i < n; i++) {
    String ssid = WiFi.SSID(i);
    if (!ssid.length()) continue;
    ssid.replace("\"", "&quot;");   // escape "
    int rssi = WiFi.RSSI(i);
    int qual = constrain(2 * (rssi + 100), 0, 100); // approximate %
    opts += "<option value=\"";
    opts += ssid;
    opts += "\">";
    opts += ssid;
    opts += " (";
    opts += String(qual);
    opts += "%)</option>";
  }
  if (opts.isEmpty()) opts = "<option value=\"\">(Không tìm thấy mạng)</option>";
  return opts;
}

String buildPortalPage() {
  String html = FPSTR(PAGE_TMPL);
  html.replace("{{OPTIONS}}", buildOptions());
  return html;
}

void initWiFiManager() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
}

void loadWifiCreds() {
  prefs.begin("wifi", true);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();
  
  ssid.substring(0, sizeof(g_wifiSsid) - 1).toCharArray(g_wifiSsid, sizeof(g_wifiSsid));
  pass.substring(0, sizeof(g_wifiPass) - 1).toCharArray(g_wifiPass, sizeof(g_wifiPass));
}

void saveWifiCreds(const String& ssid, const String& pass) {
  prefs.begin("wifi", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();
  
  memset(g_wifiSsid, 0, sizeof(g_wifiSsid));
  memset(g_wifiPass, 0, sizeof(g_wifiPass));
  ssid.substring(0, sizeof(g_wifiSsid) - 1).toCharArray(g_wifiSsid, sizeof(g_wifiSsid));
  pass.substring(0, sizeof(g_wifiPass) - 1).toCharArray(g_wifiPass, sizeof(g_wifiPass));
}

void wifiConnect() {
  if (WiFi.status() == WL_CONNECTED) return;
  
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  
  const char* ssid = (g_wifiSsid[0] != '\0') ? g_wifiSsid : WIFI_SSID;
  const char* pass = (g_wifiPass[0] != '\0') ? g_wifiPass : WIFI_PASS;
  
  WiFi.begin(ssid, pass);
  
  if (g_wifiAttemptStart == 0) {
    g_wifiAttemptStart = millis();
  }
}

void ensureWiFi() {
  static uint32_t lastTry = 0;
  
  if (WiFi.status() == WL_CONNECTED) return;
  if (millis() - lastTry < 3000) return;  // backoff ~3s
  
  lastTry = millis();
  wifiConnect();
}

void startApPortal() {
  if (g_portalActive) return;
  
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(AP_SSID);  // IP default 192.168.4.1
  
  g_portal = new WebServer(80);
  
  g_portal->on("/", HTTP_GET, []() {
    String page = buildPortalPage();
    g_portal->send(200, "text/html; charset=utf-8", page);
  });
  
  g_portal->onNotFound([]() {
    String page = buildPortalPage();
    g_portal->send(200, "text/html; charset=utf-8", page);
  });
  
  g_portal->on("/save", HTTP_POST, []() {
    String ssid = g_portal->arg("ssid");
    String pass = g_portal->arg("pass");
    saveWifiCreds(ssid, pass);
    
    String done = R"rawliteral(
      <!doctype html><html><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{font-family:system-ui;background:#f0fdf4;color:#065f46;text-align:center;padding:40px}
      .box{display:inline-block;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 6px 16px rgba(0,0,0,.08);padding:20px 24px}</style>
      </head><body><div class="box"><h3>Đã lưu cấu hình</h3>
      <p>Thiết bị sẽ kết nối vào Wi-Fi của bạn...</p><a href="/">Quay lại</a></div></body></html>)rawliteral";
    
    g_portal->send(200, "text/html; charset=utf-8", done);
    
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    g_portalActive = false;
    g_wifiAttemptStart = 0;
    wifiConnect();
  });
  
  g_portal->begin();
  g_portalActive = true;
}

void maybeRunPortal() {
  if (g_portalActive && g_portal) {
    g_portal->handleClient();
  }
}

bool isPortalActive() {
  return g_portalActive;
}

bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

// Check if WiFi connection timeout and start portal
void checkWiFiTimeout() {
  if (WiFi.status() != WL_CONNECTED) {
    if (g_wifiAttemptStart != 0 && millis() - g_wifiAttemptStart > WIFI_TIMEOUT_MS) {
      startApPortal();
    }
  }
}

