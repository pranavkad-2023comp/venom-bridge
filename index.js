const venom = require('venom-bot');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = 'https://pk2005.app.n8n.cloud/webhook/whats-in'; // Your webhook URL
const SECRET = 'venom_secret_123'; // Your secret key
const SESSION_DIR = '/tmp/.sessions'; // Render writable folder

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

venom.create({
  session: 'n8n-session',
  headless: true,
  folderNameToken: SESSION_DIR,
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
}).then((client) => start(client))
  .catch(err => console.error('Venom init error:', err));

function start(client) {
  const app = express();
  app.use(express.json());

  // Forward incoming WhatsApp messages to N8N
  client.onMessage(async (msg) => {
    try { await axios.post(N8N_WEBHOOK, msg); } 
    catch (e) { console.error('Forward fail:', e.message); }
  });

  // Endpoint to send WhatsApp messages via API
  app.post('/send', async (req, res) => {
    if (req.headers['x-api-key'] !== SECRET)
      return res.status(401).json({ error: 'unauthorized' });

    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'missing to or text' });

    try { await client.sendText(to, text); res.json({ ok: true }); } 
    catch (e) { console.error('Send fail:', e.message); res.status(500).json({ error: e.message }); }
  });

  // Listen on all network interfaces so Render can detect the port
  app.listen(PORT, '0.0.0.0', () => console.log(`Venom bridge running on port ${PORT}`));
}



