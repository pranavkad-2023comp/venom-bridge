const venom = require('venom-bot');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = process.env.https://pk2005.app.n8n.cloud/webhook/whats-in; // e.g. https://<your-n8n>.onrender.com/webhook/whats-in
const SECRET = process.env.VENOM_SECRET || 'change_me';
const SESSION_DIR = '/tmp/.sessions'; // Render writable folder

// Ensure session folder exists
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

// Create Venom session
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
    if (!N8N_WEBHOOK) return;
    try {
      await axios.post(N8N_WEBHOOK, msg);
    } catch (e) {
      console.error('Forward fail:', e.message);
    }
  });

  // Endpoint to send WhatsApp messages via API
  app.post('/send', async (req, res) => {
    if (req.headers['x-api-key'] !== SECRET)
      return res.status(401).json({ error: 'unauthorized' });

    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'missing to or text' });

    try {
      await client.sendText(to, text);
      res.json({ ok: true });
    } catch (e) {
      console.error('Send fail:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // Start server
  app.listen(PORT, () => console.log(`Venom bridge running on port ${PORT}`));
}

