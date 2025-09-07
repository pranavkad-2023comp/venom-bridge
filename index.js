const venom = require('venom-bot');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

console.log('Starting Venom bridge (server will start immediately)...');

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL || 'https://pk2005.app.n8n.cloud/webhook/whats-in';
const SECRET = process.env.VENOM_SECRET || 'venom_secret_123';
const SESSION_DIR = '/tmp/.sessions';

// ensure session dir exists
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let venomClient = null;
let venomReady = false;
let lastQr = null;   // <–– store latest QR

// Start Express server immediately so Render can detect the port
const app = express();
app.use(express.json());

// Serve the QR as an HTML <img>
app.get('/qr', (req, res) => {
  if (!lastQr) return res.status(404).send('QR not generated yet');
  res.send(`
    <html>
      <body style="display:flex;justify-content:center;align-items:center;height:100vh">
        <img src="${lastQr}" alt="WhatsApp QR" />
      </body>
    </html>
  `);
});

// Health & status endpoints
app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/status', (req, res) => res.json({
  venomReady,
  sessionDir: SESSION_DIR
}));

// Send endpoint — returns 503 if venom not ready
app.post('/send', async (req, res) => {
  if (!venomReady || !venomClient) {
    return res.status(503).json({ error: 'venom-not-ready' });
  }

  if (req.headers['x-api-key'] !== SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'missing to or text' });

  try {
    await venomClient.sendText(to, text);
    res.json({ ok: true });
  } catch (err) {
    console.error('Send fail:', err && err.message ? err.message : err);
    res.status(500).json({ error: err && err.message ? err.message : 'send-failed' });
  }
});

// Always listen on 0.0.0.0 so Render can detect the port
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Venom bridge HTTP server listening on 0.0.0.0:${PORT}`);
});

// Venom init with retries
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 15000; // 15 seconds

async function initVenom(attempt = 1) {
  console.log(`Attempting to initialize Venom (attempt ${attempt}/${MAX_RETRIES})...`);
  try {
    const client = await venom.create({
      session: 'n8n-session',
      headless: true,
      multidevice: true,
      folderNameToken: SESSION_DIR,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      },
    });

    // listen for QR events
    if (typeof client.onQR === 'function') {
      client.onQR((base64Qr, asciiQR) => {
        console.log('QR RECEIVED (scan it quickly)');
        console.log(asciiQR);           // still prints if you want
        lastQr = `data:image/png;base64,${base64Qr}`; // keep for /qr endpoint
      });
    }

    venomClient = client;
    venomReady = true;
    console.log('Venom client initialized and ready.');

    // Forward incoming messages to n8n
    client.onMessage(async (msg) => {
      try {
        if (N8N_WEBHOOK) await axios.post(N8N_WEBHOOK, msg);
      } catch (e) {
        console.error('Forward fail:', e && e.message ? e.message : e);
      }
    });

    // Monitor state
    if (typeof client.onStateChange === 'function') {
      client.onStateChange((state) => {
        console.log('Venom state changed:', state);
        if (state === 'CONFLICT' || state === 'UNPAIRED' || state === 'UNPAIRED_IDLE') {
          venomReady = false;
          console.warn('Venom reported unpaired/conflict. You may need to re-login.');
        }
      });
    }

  } catch (err) {
    console.error('Venom init error:', err && err.message ? err.message : err);
    venomReady = false;
    if (attempt < MAX_RETRIES) {
      console.log(`Retrying Venom init in ${RETRY_DELAY_MS / 1000}s...`);
      setTimeout(() => initVenom(attempt + 1), RETRY_DELAY_MS);
    } else {
      console.error('Venom init reached max retries. Will keep server running but venom is not ready.');
    }
  }
}

// Start Venom initialization in background
initVenom();
