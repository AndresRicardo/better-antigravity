import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

const LS_ADDRESS = process.env.ANTIGRAVITY_LS_ADDRESS || 'localhost:60514';
const CSRF_TOKEN = process.env.ANTIGRAVITY_CSRF_TOKEN || '';
const PORT = parseInt(process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || '5000', 10);

const DEFAULT_FIXED_ORDER = [
  'gemini-3.8-flash',
  'gemini-4-argon',
  'claude-sonnet-5.5',
  'claude-opus-5.5',
  'gpt-oss-120b'
];

const DEFAULT_TIER_ORDER = ['high', 'medium', 'low'];

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return {
        billingRenewalDay: 16,
        refreshIntervalMs: 60000,
        fixedModelOrder: DEFAULT_FIXED_ORDER,
        tierOrder: DEFAULT_TIER_ORDER,
        ...data
      };
    }
  } catch (e) {
    console.error('Error loading settings:', e.message);
  }
  return {
    billingRenewalDay: 16,
    refreshIntervalMs: 60000,
    fixedModelOrder: DEFAULT_FIXED_ORDER,
    tierOrder: DEFAULT_TIER_ORDER
  };
}

function saveSettings(settingsToSave) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settingsToSave, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving settings:', e.message);
  }
}

let settings = loadSettings();

async function fetchUserStatus() {
  const [host, port] = LS_ADDRESS.split(':');
  const postData = JSON.stringify({});
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: host || 'localhost',
      port: parseInt(port || '60514', 10),
      path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': CSRF_TOKEN,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getNextMonthlyReset(dayOfMonth = 16) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let resetDate = new Date(year, month, dayOfMonth, 0, 0, 0);
  if (resetDate <= now) {
    resetDate = new Date(year, month + 1, dayOfMonth, 0, 0, 0);
  }
  return resetDate.toISOString();
}

function parseQuotas(statusData) {
  const user = statusData?.userStatus || {};
  const planInfo = user.planStatus?.planInfo || {};
  const rawModels = user.cascadeModelConfigData?.clientModelConfigs || [];
  const now = new Date();

  // Monthly account credits & renewal date (16th of each month)
  // In Pro tier, base credit allocation is 500 prompt credits.
  const baseMonthlyCredits = 500;
  const availablePromptCredits = user.planStatus?.availablePromptCredits ?? 500;
  let monthlyUsed = 0;
  if (baseMonthlyCredits > 0) {
    const used = Math.max(0, baseMonthlyCredits - availablePromptCredits);
    monthlyUsed = Math.round((used / baseMonthlyCredits) * 1000) / 10;
  }

  const monthlyReset = getNextMonthlyReset(settings.billingRenewalDay || 16);

  // Group models by base name
  const familyMap = new Map();
  for (const m of rawModels) {
    const remainingFraction = m.quotaInfo?.remainingFraction ?? 1;
    const usedPercent = Math.max(0, Math.min(100, Math.round((1 - remainingFraction) * 1000) / 10));
    const resetTime = m.quotaInfo?.resetTime || null;

    let tier = 'Default';
    if (m.label?.includes('(High)')) tier = 'high';
    else if (m.label?.includes('(Medium)')) tier = 'medium';
    else if (m.label?.includes('(Low)')) tier = 'low';

    const baseName = m.label?.replace(/\s*\((High|Medium|Low)\)\s*/gi, '').trim() || m.label;
    const cleanId = baseName.toLowerCase().replace(/[^a-z0-9.]+/g, '-');

    let provider = 'google';
    if (baseName.toLowerCase().includes('claude')) provider = 'anthropic';
    else if (baseName.toLowerCase().includes('gpt')) provider = 'openai';

    if (!familyMap.has(baseName)) {
      familyMap.set(baseName, {
        id: cleanId,
        name: baseName,
        provider,
        tiers: [tier],
        usedPercent,
        resetTime,
        modelId: m.modelId
      });
    } else {
      const fam = familyMap.get(baseName);
      if (!fam.tiers.includes(tier)) fam.tiers.push(tier);
      if (usedPercent > fam.usedPercent) {
        fam.usedPercent = usedPercent;
        fam.resetTime = resetTime;
      }
    }
  }

  const tierOrder = settings.tierOrder || DEFAULT_TIER_ORDER;

  const models = Array.from(familyMap.values()).map(fam => {
    const windows = [];

    if (fam.resetTime) {
      const diffDays = (new Date(fam.resetTime) - now) / (1000 * 60 * 60 * 24);
      if (diffDays > 0.8) {
        windows.push({
          type: 'week',
          usedPercent: fam.usedPercent,
          resetTime: fam.resetTime
        });
      } else {
        windows.push({
          type: '5h',
          usedPercent: fam.usedPercent,
          resetTime: fam.resetTime
        });
      }
    }

    // Monthly window (reflects actual monthly credits consumed, 0% when 500/500 are intact)
    windows.push({
      type: 'month',
      usedPercent: monthlyUsed,
      resetTime: monthlyReset
    });

    const sortedTiers = fam.tiers
      .filter(t => t !== 'Default')
      .sort((a, b) => {
        const idxA = tierOrder.indexOf(a.toLowerCase());
        const idxB = tierOrder.indexOf(b.toLowerCase());
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });

    return {
      id: fam.id,
      name: fam.name,
      provider: fam.provider,
      tiers: sortedTiers.join(' · ') || 'pro',
      windows
    };
  });

  // Always keep the exact same fixed model order
  const fixedOrder = settings.fixedModelOrder || DEFAULT_FIXED_ORDER;
  models.sort((a, b) => {
    const idxA = fixedOrder.indexOf(a.id);
    const idxB = fixedOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    plan: planInfo.planName || 'Pro',
    user: user.name || 'User',
    billingRenewalDay: settings.billingRenewalDay || 16,
    refreshIntervalMs: settings.refreshIntervalMs || 60000,
    availablePromptCredits,
    models
  };
}

function getHtml() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quota</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #000000;
      color: #e0e0e0;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.4;
      padding: 14px 12px;
      user-select: none;
      -webkit-font-smoothing: antialiased;
    }

    /* Minimal Top Bar */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 6px;
      border-bottom: 1px solid #1a1a1a;
      color: #666666;
      font-size: 11px;
    }

    .top-bar .title {
      color: #888888;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .top-bar .sync-info {
      color: #555555;
      font-size: 10px;
      margin-left: 6px;
    }

    .actions-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn-cutoff {
      background: #111111;
      border: 1px solid #282828;
      color: #888888;
      cursor: pointer;
      font-family: inherit;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s ease;
    }

    .btn-cutoff:hover {
      border-color: #444444;
      color: #ff9e3b;
    }

    .btn-refresh {
      background: transparent;
      border: none;
      color: #555555;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px;
      transition: color 0.15s ease;
    }

    .btn-refresh:hover {
      color: #ff9e3b;
    }

    .btn-refresh.spinning svg {
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* Model Cards Container */
    .models-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Minimalist Terminal Card */
    .model-card {
      position: relative;
      background: #000000;
      border: 1px solid #222222;
      border-radius: 6px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      transition: border-color 0.2s ease;
    }

    .model-card:hover {
      border-color: #333333;
    }

    /* Notched Top-Left Label */
    .card-label {
      position: absolute;
      top: -8px;
      left: 10px;
      background: #000000;
      padding: 0 5px;
      font-size: 11px;
      color: #666666;
      letter-spacing: -0.2px;
    }

    /* Left Side: Prompt arrows & status/tier */
    .card-left {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ff9e3b;
      font-size: 12px;
      white-space: nowrap;
    }

    .card-arrows {
      color: #ff9e3b;
      font-size: 11px;
      letter-spacing: -1px;
    }

    .card-meta {
      color: #ff9e3b;
      font-weight: 500;
    }

    /* Right Side: Stack of windows (5h, week, month) */
    .card-right {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: flex-end;
    }

    /* Single Window Row */
    .win-row {
      display: flex;
      align-items: center;
      font-size: 12px;
      white-space: nowrap;
    }

    .win-name {
      color: #666666;
      width: 40px;
      text-align: right;
      margin-right: 10px;
      font-weight: 500;
    }

    /* Ultra-sleek thin progress bar */
    .bar-track {
      width: 70px;
      height: 2px;
      background: #222222;
      border-radius: 1px;
      overflow: hidden;
      margin-right: 12px;
    }

    .bar-fill {
      height: 100%;
      background: #ff6b4a;
      border-radius: 1px;
      transition: width 0.4s ease;
    }

    .win-pct {
      color: #ffffff;
      font-weight: 700;
      min-width: 32px;
      text-align: right;
    }

    .win-dot {
      color: #444444;
      margin: 0 6px;
    }

    .win-time {
      color: #777777;
      min-width: 50px;
      text-align: right;
    }

    @media (max-width: 380px) {
      .model-card {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
      }
      .card-right {
        width: 100%;
        align-items: flex-start;
      }
      .bar-track {
        width: 50px;
      }
    }
  </style>
</head>
<body>

  <div class="top-bar">
    <div class="title">
      <span>model quotas</span>
      <span class="sync-info" id="syncInfo">· auto 1m</span>
    </div>
    <div class="actions-wrap">
      <button class="btn-cutoff" id="btnCutoff" title="Clic para ajustar el día de corte mensual">corte: día <span id="cutoffDay">16</span></button>
      <button class="btn-refresh" id="btnRefresh" title="Actualizar ahora">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>sync</span>
      </button>
    </div>
  </div>

  <div class="models-container" id="modelsContainer">
    <!-- Rendered dynamically -->
  </div>

  <script>
    let modelsData = [];
    let currentCutoffDay = 16;
    const container = document.getElementById('modelsContainer');
    const btnRefresh = document.getElementById('btnRefresh');
    const btnCutoff = document.getElementById('btnCutoff');
    const cutoffDaySpan = document.getElementById('cutoffDay');

    function formatTimeRemaining(ms) {
      if (ms <= 0) return '0m';
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);

      if (days > 0) {
        return days + 'd ' + hours + 'h';
      }
      if (hours > 0) {
        return hours + 'h ' + minutes + 'm';
      }
      return minutes + 'm';
    }

    function renderCards() {
      const now = Date.now();

      container.innerHTML = modelsData.map(model => {
        const windowsHtml = model.windows.map(win => {
          const remMs = win.resetTime ? (new Date(win.resetTime).getTime() - now) : 0;
          const timeStr = win.resetTime ? formatTimeRemaining(remMs) : '--';
          const pctStr = Math.round(win.usedPercent) + '%';
          const barWidth = Math.max(2, Math.min(100, win.usedPercent));

          return \`
            <div class="win-row" title="\${win.type === 'month' ? 'Cuota mensual de créditos: ' + pctStr + ' usado' : ''}">
              <span class="win-name">\${win.type}</span>
              <div class="bar-track">
                <div class="bar-fill" style="width: \${barWidth}%;"></div>
              </div>
              <span class="win-pct">\${pctStr}</span>
              <span class="win-dot">·</span>
              <span class="win-time" data-reset="\${win.resetTime || ''}">\${timeStr}</span>
            </div>
          \`;
        }).join('');

        return \`
          <div class="model-card">
            <span class="card-label">\${model.id}</span>
            <div class="card-left">
              <span class="card-arrows">&#9654; &#9654;</span>
              <span class="card-meta">\${model.provider} \${model.tiers ? '· ' + model.tiers : ''}</span>
            </div>
            <div class="card-right">
              \${windowsHtml}
            </div>
          </div>
        \`;
      }).join('');
    }

    function updateTimers() {
      const now = Date.now();
      document.querySelectorAll('.win-time').forEach(el => {
        const resetIso = el.getAttribute('data-reset');
        if (resetIso) {
          const remMs = new Date(resetIso).getTime() - now;
          el.textContent = formatTimeRemaining(remMs);
        }
      });
    }

    async function loadData() {
      try {
        btnRefresh.classList.add('spinning');
        const res = await fetch('/api/quota');
        if (res.ok) {
          const data = await res.json();
          modelsData = data.models || [];
          if (data.billingRenewalDay) {
            currentCutoffDay = data.billingRenewalDay;
            cutoffDaySpan.textContent = currentCutoffDay;
          }
          renderCards();
        }
      } catch (e) {
        console.error('Error fetching quota:', e);
      } finally {
        setTimeout(() => btnRefresh.classList.remove('spinning'), 400);
      }
    }

    btnCutoff.addEventListener('click', async () => {
      const input = prompt('Introduce el día de corte mensual de tu suscripción (1-31):', currentCutoffDay);
      if (input !== null) {
        const day = parseInt(input.trim(), 10);
        if (!isNaN(day) && day >= 1 && day <= 31) {
          try {
            await fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ billingRenewalDay: day })
            });
            loadData();
          } catch (e) {
            alert('Error al guardar: ' + e.message);
          }
        } else {
          alert('Por favor ingresa un día válido entre 1 y 31.');
        }
      }
    });

    const ONE_MINUTE_MS = 60000;
    setInterval(loadData, ONE_MINUTE_MS);

    setInterval(updateTimers, 1000);

    btnRefresh.addEventListener('click', loadData);

    loadData();
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:' + PORT);

  if (url.pathname === '/api/quota') {
    try {
      const rawStatus = await fetchUserStatus();
      const quota = parseQuotas(rawStatus);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify(quota));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname === '/api/settings' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newSettings = JSON.parse(body);
        if (newSettings.billingRenewalDay) {
          settings.billingRenewalDay = parseInt(newSettings.billingRenewalDay, 10);
        }
        if (newSettings.fixedModelOrder && Array.isArray(newSettings.fixedModelOrder)) {
          settings.fixedModelOrder = newSettings.fixedModelOrder;
        }
        if (newSettings.tierOrder && Array.isArray(newSettings.tierOrder)) {
          settings.tierOrder = newSettings.tierOrder;
        }
        saveSettings(settings);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, settings }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHtml());
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Subscription Quota Sidecar] Listening on 127.0.0.1:${PORT}`);
});
