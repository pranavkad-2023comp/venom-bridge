const venom = require('venom-bot');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK = process.env.N8N_WEBHOOK_URL; // e.g. https://<your-n8n>.onrender.com/webhook/whats-in
const SECRET = process.env.VENOM_SECRET || 'change_me';
const SESSION_DIR = '/app/.sessions';

if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

venom.create({
  session: 'n8n-session',
  headless: true,
  folderNameToken: SESSION_DIR,
  puppeteerOptions: { args: ['--no-sandbox','--disable-setuid-sandbox'] }
}).then((client) => start(client));

function start(client){
  const app = express();
  app.use(express.json());

  client.onMessage(async (msg)=>{
    if (!N8N_WEBHOOK) return;
    try { await axios.post(N8N_WEBHOOK, msg); }
    catch(e){ console.error('forward fail', e.message); }
  });

  app.post('/send', async (req,res)=>{
    if (req.headers['x-api-key']!==SECRET) return res.status(401).json({error:'unauthorized'});
    const {to,text}=req.body;
    if(!to||!text) return res.status(400).json({error:'missing to or text'});
    await client.sendText(to,text);
    res.json({ok:true});
  });

  app.listen(PORT,()=>console.log('venom bridge on',PORT));
}
