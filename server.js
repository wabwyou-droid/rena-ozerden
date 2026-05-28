const express   = require('express');
const { Pool }  = require('pg');
const http      = require('http');
const WebSocket = require('ws');
const multer    = require('multer');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;

const PUBLIC_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN
  : process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://rena-ozerden.onrender.com';

const NOT_URL = PUBLIC_URL + '/not';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sadece görsel'));
  }
});

// PostgreSQL
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function initDB() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS notlar (
    id BIGINT PRIMARY KEY, isim TEXT, mesaj TEXT, foto TEXT, saat TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
}
initDB();

const dilekler = [];

async function loadFromDB() {
  if (!pool) return;
  try {
    const res = await pool.query('SELECT * FROM notlar ORDER BY created_at ASC');
    dilekler.length = 0;
    res.rows.forEach(r => dilekler.push({ id: r.id, isim: r.isim, mesaj: r.mesaj, foto: r.foto, saat: r.saat }));
  } catch(e) { console.error('DB load:', e.message); }
}
loadFromDB();

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', ws => {
  if (dilekler.length) ws.send(JSON.stringify({ type: 'init', dilekler }));
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/not', upload.single('foto'), async (req, res) => {
  const isim  = (req.body && req.body.isim  ? String(req.body.isim).slice(0,40)  : '');
  const mesaj = (req.body && req.body.mesaj ? String(req.body.mesaj).slice(0,160) : '');

  let fotoBase64 = null;
  if (req.body && req.body.fotoBase64) {
    fotoBase64 = req.body.fotoBase64;
  } else if (req.file) {
    fotoBase64 = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
  }

  if (!fotoBase64) return res.status(400).json({ ok: false, error: 'foto_required' });

  const d = {
    id:   Date.now(),
    isim: isim || 'Misafir',
    mesaj: mesaj || '',
    foto: fotoBase64,
    saat: new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  };
  dilekler.push(d);

  if (pool) {
    pool.query(
      'INSERT INTO notlar (id, isim, mesaj, foto, saat) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
      [d.id, d.isim, d.mesaj, d.foto, d.saat]
    ).catch(e => console.error('DB insert:', e.message));
  }

  broadcast({ type: 'dilek', dilek: d });
  res.json({ ok: true });
});

// ── TV EKRANI ──
app.get('/', async (req, res) => {
  const QRCodeLib = require('qrcode');
  const qrDataUrl = await QRCodeLib.toDataURL(NOT_URL, {
    width: 240, margin: 2,
    color: { dark: '#1A0A00', light: '#FFFFFF' }
  });
  const qrImg = '<img src="' + qrDataUrl + '" style="display:block;width:min(16vw,200px);height:min(16vw,200px);" alt="QR"/>';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Rena Özerden</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Lato:wght@100;200;300&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:#F5F0E8;color-scheme:light only;}
body{display:flex;align-items:center;justify-content:center;background:#F5F0E8;}
.canvas{position:relative;width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;overflow:hidden;background:#FAF6F0;}
.bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 100% 100% at 20% 50%,#FFF8F2 0%,#F5EDE0 100%);}
.grain{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.018;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px;}
.canvas>*{position:relative;z-index:2;}
.layout{position:absolute;inset:0;z-index:5;display:grid;grid-template-columns:33.33% 66.67%;}
.left-col{display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:2.5vw 2vw 2vw 2.5vw;border-right:1px solid rgba(200,168,136,.15);}
.title-block{text-align:center;}
.title-rena{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(26px,5vw,78px);color:#7A5535;letter-spacing:.14em;line-height:1;display:block;}
.title-ozerden{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(26px,5vw,78px);color:#7A5535;letter-spacing:.14em;line-height:1;display:block;}
.title-line{width:min(10vw,120px);height:1px;background:linear-gradient(to right,transparent,#C8A878,transparent);margin:.6vw auto;opacity:.5;}
.flower-wrap{width:92%;}
.bloom-sway{transform-origin:50% 98%;}
.bloom-petal{
  transform-origin:50% 100%;
  animation:petalGrow 18s cubic-bezier(0.25,0.46,0.45,0.94) infinite;
  animation-delay:var(--bloom-del,0s);
}
@keyframes petalGrow{
  0%  {transform:rotate(var(--base-rot)) scaleY(0) scaleX(0);opacity:0;}
  8%  {transform:rotate(var(--base-rot)) scaleY(1.12) scaleX(1.08);opacity:1;}
  14% {transform:rotate(var(--base-rot)) scaleY(0.96) scaleX(0.98);opacity:.95;}
  18% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:1;}
  52% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:1;}
  56% {transform:rotate(var(--base-rot)) scaleY(1.04) scaleX(1.03);opacity:1;}
  60% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:1;}
  82% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:.9;}
  96% {transform:rotate(var(--base-rot)) scaleY(.05) scaleX(.1);opacity:0;}
  100%{transform:rotate(var(--base-rot)) scaleY(0) scaleX(0);opacity:0;}
}
.bloom-inner{
  transform-origin:50% 100%;
  animation:innerGrow 18s cubic-bezier(0.25,0.46,0.45,0.94) infinite;
  animation-delay:var(--bloom-del,.3s);
}
@keyframes innerGrow{
  0%  {transform:rotate(var(--base-rot)) scaleY(0) scaleX(0);opacity:0;}
  10% {transform:rotate(var(--base-rot)) scaleY(1.1) scaleX(1.06);opacity:1;}
  16% {transform:rotate(var(--base-rot)) scaleY(.97) scaleX(.99);opacity:.95;}
  20% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:1;}
  52% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:1;}
  56% {transform:rotate(var(--base-rot)) scaleY(1.05) scaleX(1.04);opacity:1;}
  60% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:1;}
  84% {transform:rotate(var(--base-rot)) scaleY(1) scaleX(1);opacity:.85;}
  97% {transform:rotate(var(--base-rot)) scaleY(.04) scaleX(.08);opacity:0;}
  100%{transform:rotate(var(--base-rot)) scaleY(0) scaleX(0);opacity:0;}
}
.bloom-center{animation:centerGrow 18s ease-in-out infinite .8s;}
@keyframes centerGrow{
  0%  {transform:scale(0);opacity:0;}
  12% {transform:scale(1.2);opacity:1;}
  18% {transform:scale(.94);opacity:.95;}
  22% {transform:scale(1);opacity:1;}
  45% {transform:scale(1);opacity:1;}
  48% {transform:scale(1.08);opacity:1;}
  51% {transform:scale(.97);opacity:1;}
  54% {transform:scale(1.04);opacity:1;}
  57% {transform:scale(1);opacity:1;}
  82% {transform:scale(1);opacity:.9;}
  97% {transform:scale(.05);opacity:0;}
  100%{transform:scale(0);opacity:0;}
}
.qr-block{text-align:center;}
.qr-wrap{display:inline-flex;flex-direction:column;align-items:center;gap:.5vw;background:rgba(255,250,244,.92);border:1px solid rgba(200,168,136,.25);padding:.8vw 1vw .6vw;box-shadow:0 4px 20px rgba(160,120,80,.1);}
.qr-bow{font-size:clamp(12px,1.5vw,22px);line-height:1;margin-bottom:.1vw;}
.qr-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:clamp(18px,2.6vw,40px);color:#7A5535;letter-spacing:.04em;line-height:1.35;}
.qr-heart{font-size:clamp(8px,.9vw,13px);color:#C87888;margin-top:.2vw;opacity:.8;}
.qr-frame{display:inline-block;background:#fff;padding:7px;border:1px solid rgba(200,168,136,.25);}
.qr-frame img{display:block !important;width:min(16vw,200px) !important;height:min(16vw,200px) !important;}
.right-col{position:relative;overflow:hidden;}
.col-line{position:absolute;top:0;bottom:0;width:1px;left:50%;background:linear-gradient(to bottom,transparent,rgba(200,168,136,.08) 20%,rgba(200,168,136,.08) 80%,transparent);z-index:1;pointer-events:none;}
#snow{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;}
.sp{position:absolute;top:-5vw;opacity:0;animation:spFall var(--dur) ease-in-out infinite var(--del);}
@keyframes spFall{0%{opacity:0;transform:translateY(0) rotate(0deg) translateX(0);}8%{opacity:var(--op);}85%{opacity:var(--op);}100%{opacity:0;transform:translateY(115vh) rotate(var(--spin)) translateX(var(--sway));}}
#sparkles{position:absolute;inset:0;z-index:2;pointer-events:none;}
.sparkle{position:absolute;animation:twinkle var(--dur) ease-in-out infinite var(--del);opacity:0;}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(0);}50%{opacity:var(--op);transform:scale(1) rotate(90deg);}}
#petals{position:absolute;inset:0;z-index:4;pointer-events:none;}
.burst{position:absolute;}
.petal{position:absolute;border-radius:50%;animation:petalOut var(--pd,1.4s) ease-out forwards;}
@keyframes petalOut{0%{transform:translate(0,0);opacity:1;}100%{transform:translate(var(--tx),var(--ty)) scale(.2);opacity:0;}}
#notes{position:absolute;z-index:10;pointer-events:none;overflow:hidden;top:0;bottom:0;left:33.33%;right:0;}
.nc{position:absolute;background:rgba(255,253,250,.97);border:1px solid rgba(200,165,140,.28);padding:.8vw 1vw;width:15vw;max-width:15vw;overflow:hidden;box-sizing:border-box;box-shadow:0 4px 20px rgba(140,100,70,.1);animation:ncFall var(--fall-dur) linear forwards;opacity:0;}
@keyframes ncFall{0%{opacity:0;transform:translateY(-140px) rotate(var(--r));}4%{opacity:1;}92%{opacity:1;transform:translateY(var(--fall-dist)) rotate(var(--r));}100%{opacity:0;transform:translateY(var(--fall-dist)) rotate(var(--r));}}
.nc-foto{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;margin-bottom:.5vw;border-radius:1px;}
.nc-name{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(14px,1.7vw,27px);color:#5A3518;letter-spacing:.02em;margin-bottom:.4vw;word-break:break-word;overflow-wrap:break-word;}
.nc-msg{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:clamp(13px,1.45vw,23px);color:#6A4525;line-height:1.5;word-break:break-word;overflow-wrap:break-word;}
.toast{position:fixed;top:3vw;left:50%;transform:translateX(-50%);z-index:60;white-space:nowrap;background:rgba(255,252,248,.97);border:1px solid rgba(200,168,136,.3);padding:.5vw 1.8vw;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(10px,1vw,16px);color:#8A6040;animation:toastAnim 4s ease forwards;pointer-events:none;}
@keyframes toastAnim{0%{opacity:0;transform:translateX(-50%) translateY(-8px);}10%{opacity:1;transform:translateX(-50%) translateY(0);}78%{opacity:1;}100%{opacity:0;}}
.counter{position:absolute;bottom:1.8vw;right:1.5vw;z-index:20;display:flex;align-items:center;gap:.4vw;}
.ldot{width:5px;height:5px;border-radius:50%;background:#C8A878;flex-shrink:0;animation:ldotPulse 3s ease-in-out infinite;}
@keyframes ldotPulse{0%,100%{opacity:1;}50%{opacity:.3;}}
.ctxt{font-family:'Lato',sans-serif;font-weight:200;font-size:clamp(7px,.7vw,10px);letter-spacing:.3em;color:rgba(168,128,96,.6);}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
</style>
</head>
<body>
<div class="canvas" id="canvas">
  <div class="bg"></div>
  <div class="grain"></div>
  <div id="snow"></div>
  <div id="sparkles"></div>
  <div id="petals"></div>
  <div id="notes"></div>
  <div class="layout">
    <div class="left-col">
      <div class="title-block">
        <span class="title-rena">Rena</span>
        <div class="title-line"></div>
        <span class="title-ozerden">Özerden</span>
      </div>
      <div class="flower-wrap">
        <div class="bloom-sway">
        <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="rp1" cx="50%" cy="20%" r="70%"><stop offset="0%" stop-color="#FEE0E8"/><stop offset="50%" stop-color="#F5B0C0"/><stop offset="100%" stop-color="#D88898"/></radialGradient>
            <radialGradient id="rp2" cx="50%" cy="20%" r="70%"><stop offset="0%" stop-color="#FEE8EE"/><stop offset="50%" stop-color="#ECA8BC"/><stop offset="100%" stop-color="#CC8090"/></radialGradient>
            <radialGradient id="rp3" cx="50%" cy="20%" r="60%"><stop offset="0%" stop-color="#FFF0F4"/><stop offset="50%" stop-color="#F8C0CC"/><stop offset="100%" stop-color="#E090A0"/></radialGradient>
            <radialGradient id="rcg" cx="45%" cy="35%" r="60%"><stop offset="0%" stop-color="#FFF0E0"/><stop offset="100%" stop-color="#E8C090"/></radialGradient>
            <radialGradient id="rlg" cx="30%" cy="30%" r="70%"><stop offset="0%" stop-color="#D0DDB0"/><stop offset="100%" stop-color="#8AAA68"/></radialGradient>
          </defs>
          <path d="M150,195 Q148,165 150,140 Q152,115 150,95" stroke="#9AB878" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M150,155 Q128,151 108,149 Q90,148 72,144" stroke="#9AB878" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M90,148 Q78,135 70,122 Q85,130 95,143Z" fill="url(#rlg)" opacity=".8"/>
          <path d="M150,138 Q172,133 192,130 Q210,128 228,124" stroke="#9AB878" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M210,130 Q222,117 230,103 Q218,115 205,126Z" fill="url(#rlg)" opacity=".75"/>
          <g transform="translate(228,112)">
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp3)" opacity=".8" transform="rotate(0,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp2)" opacity=".8" transform="rotate(72,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp3)" opacity=".8" transform="rotate(144,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp2)" opacity=".8" transform="rotate(216,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp3)" opacity=".8" transform="rotate(288,0,0)"/>
            <circle cx="0" cy="0" r="5" fill="url(#rcg)"/>
          </g>
          <g transform="translate(150,75)">
            <g class="bloom-petal" style="--base-rot:0deg;--bloom-del:0s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:45deg;--bloom-del:.15s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:90deg;--bloom-del:.3s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:135deg;--bloom-del:.45s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:180deg;--bloom-del:.6s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:225deg;--bloom-del:.75s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:270deg;--bloom-del:.9s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:315deg;--bloom-del:1.05s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-inner" style="--base-rot:22.5deg;--bloom-del:.5s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:67.5deg;--bloom-del:.6s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:112.5deg;--bloom-del:.7s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:157.5deg;--bloom-del:.8s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:202.5deg;--bloom-del:.9s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:247.5deg;--bloom-del:1.0s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:292.5deg;--bloom-del:1.1s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:337.5deg;--bloom-del:1.2s;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:0deg;--bloom-del:1.4s;transform-origin:0px 0px;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:60deg;--bloom-del:1.5s;transform-origin:0px 0px;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:120deg;--bloom-del:1.6s;transform-origin:0px 0px;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:180deg;--bloom-del:1.7s;transform-origin:0px 0px;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:240deg;--bloom-del:1.8s;transform-origin:0px 0px;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:300deg;--bloom-del:1.9s;transform-origin:0px 0px;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-center">
              <circle cx="0" cy="0" r="16" fill="url(#rcg)"/>
              <circle cx="0" cy="0" r="10" fill="#F5DCC0" opacity=".9"/>
              <circle cx="-3" cy="-3" r="4" fill="rgba(255,248,235,.65)"/>
              <g stroke="#C8986A" stroke-width=".9" opacity=".75">
                <line x1="0" y1="-9" x2="0" y2="-14"/><circle cx="0" cy="-15" r="1.8" fill="#D4A870"/>
                <line x1="7" y1="-6" x2="10" y2="-11"/><circle cx="11" cy="-12" r="1.5" fill="#D4A870"/>
                <line x1="-7" y1="-6" x2="-10" y2="-11"/><circle cx="-11" cy="-12" r="1.5" fill="#D4A870"/>
                <line x1="9" y1="2" x2="13" y2="5"/><circle cx="14" cy="6" r="1.3" fill="#D4A870"/>
                <line x1="-9" y1="2" x2="-13" y2="5"/><circle cx="-14" cy="6" r="1.3" fill="#D4A870"/>
              </g>
            </g>
          </g>
        </svg>
        </div>
      </div>
      <div class="qr-block">
        <div class="qr-wrap">
          <div class="qr-bow">🎀</div>
          <div class="qr-title">Rena'ya<br>bir not bırak</div>
          <div class="qr-frame">QR_PLACEHOLDER</div>
          <div class="qr-heart">♡ &nbsp; ♡ &nbsp; ♡</div>
        </div>
      </div>
    </div>
    <div class="right-col"><div class="col-line"></div></div>
  </div>
  <div class="counter"><div class="ldot"></div><div class="ctxt" id="ct">0 not</div></div>
</div>
<script>
// FALLING ITEMS
(function(){
  var s=document.getElementById('snow');
  function pacifierSVG(sz,op){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="'+sz+'" height="'+sz+'" style="display:block;"><ellipse cx="20" cy="22" rx="14" ry="10" fill="rgba(232,180,190,'+op+')" /><ellipse cx="20" cy="22" rx="14" ry="10" fill="none" stroke="rgba(210,150,160,'+op+')" stroke-width="1"/><ellipse cx="20" cy="12" rx="4.5" ry="6" fill="rgba(220,160,150,'+(op*1.1)+')" /><circle cx="20" cy="33" r="4" fill="none" stroke="rgba(210,150,160,'+op+')" stroke-width="1.8"/></svg>';}
  function bottleSVG(sz,op){var w=Math.round(sz*.6);return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 42" width="'+w+'" height="'+sz+'" style="display:block;"><ellipse cx="12" cy="4" rx="3" ry="3.5" fill="rgba(200,160,140,'+op+')" /><rect x="8" y="6" width="8" height="4" rx="2" fill="rgba(220,175,165,'+op+')" /><path d="M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z" fill="rgba(245,225,225,'+(op*.85)+')" /><path d="M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z" fill="none" stroke="rgba(210,170,165,'+op+')" stroke-width="1"/></svg>';}
  function flowerSVG(sz,op){var c='rgba(210,175,165,'+op+')';return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="'+sz+'" height="'+sz+'" style="display:block;"><ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(0,10,10)"/><ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(60,10,10)"/><ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(120,10,10)"/><ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(180,10,10)"/><ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(240,10,10)"/><ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(300,10,10)"/><circle cx="10" cy="10" r="3.5" fill="rgba(245,225,215,'+op+')" /></svg>';}
  var types=['pacifier','bottle','flower','pacifier','bottle','flower','pacifier','bottle'];
  for(var i=0;i<30;i++){
    var el=document.createElement('div');el.className='sp';
    var type=types[i%types.length],sz=8+Math.random()*6,op=(0.2+Math.random()*.28).toFixed(2);
    var inner=type==='pacifier'?pacifierSVG(sz,op):type==='bottle'?bottleSVG(sz,op):flowerSVG(sz,op);
    el.innerHTML=inner;
    el.style.cssText='left:'+(Math.random()*100)+'%;--dur:'+(11+Math.random()*14)+'s;--del:-'+(Math.random()*22)+'s;--op:1;--spin:'+((Math.random()-.5)*260)+'deg;--sway:'+((Math.random()-.5)*5)+'vw;';
    s.appendChild(el);
  }
})();

// SPARKLES
(function(){
  var sp=document.getElementById('sparkles');
  for(var i=0;i<16;i++){
    var el=document.createElement('div');el.className='sparkle';
    var sz=.25+Math.random()*.55;
    el.style.cssText='left:'+(Math.random()*95)+'%;top:'+(5+Math.random()*90)+'%;--dur:'+(3+Math.random()*4)+'s;--del:-'+(Math.random()*6)+'s;--op:'+(0.2+Math.random()*.3)+';';
    el.innerHTML='<svg width="'+(sz*10)+'px" height="'+(sz*10)+'px" viewBox="0 0 12 12"><path d="M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z" fill="rgba(190,155,110,'+(0.28+Math.random()*.28)+')"/></svg>';
    sp.appendChild(el);
  }
})();

// CLICK BLOOM
var PCOLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8'];
function bloom(x,y){
  var c=document.getElementById('canvas');
  var b=document.createElement('div');b.className='burst';b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;z-index:4;';
  for(var i=0;i<14;i++){
    var p=document.createElement('div');p.className='petal';
    var ang=(Math.PI*2/14)*i,dist=20+Math.random()*25,sz=3+Math.random()*4;
    p.style.cssText='width:'+sz+'px;height:'+sz+'px;background:'+PCOLS[i%5]+';left:0;top:0;--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;--pd:'+(0.9+Math.random()*.5)+'s;animation-delay:'+(Math.random()*.06)+'s;';
    b.appendChild(p);
  }
  c.appendChild(b);setTimeout(function(){if(b.parentNode)b.remove();},1600);
}
document.getElementById('canvas').addEventListener('click',function(e){
  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();
  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));
});

// NOTES — 4 columns, position-tracked, no overlap
var count=0;
function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
var _COLS=[{left:1,lastBottom:-999},{left:26,lastBottom:-999},{left:51,lastBottom:-999},{left:76,lastBottom:-999}];
var _noteQueue=[];
var _NOTE_H_VH=22,_NOTE_GAP=8;
function getBestCol(){var best=null,bestScore=-Infinity;_COLS.forEach(function(col){var score=-col.lastBottom;if(score>bestScore){bestScore=score;best=col;}});return best;}
function canLaunch(col){return col.lastBottom<(_NOTE_H_VH+_NOTE_GAP);}
function launchNote(isim,mesaj,foto){
  var col=getBestCol();
  if(!canLaunch(col)){_noteQueue.push({isim:isim,mesaj:mesaj,foto:foto});return;}
  var el=document.createElement('div');el.className='nc';
  var fallDur=16,startTop=-20;
  el.style.cssText='left:'+col.left+'%;top:'+startTop+'vh;--r:0deg;--fall-dist:130vh;--fall-dur:'+fallDur+'s;';
  var fHtml=foto?'<img class="nc-foto" src="'+foto+'" alt=""/>':'';
  el.innerHTML=fHtml+'<div class="nc-name">'+esc(isim)+'</div><div class="nc-msg">'+esc(mesaj)+'</div>';
  document.getElementById('notes').appendChild(el);
  col.lastBottom=startTop+_NOTE_H_VH;
  var speed=130/16,startTime=Date.now();
  var tracker=setInterval(function(){
    var elapsed=(Date.now()-startTime)/1000;
    col.lastBottom=startTop+_NOTE_H_VH+speed*elapsed;
    if(col.lastBottom>110){clearInterval(tracker);col.lastBottom=-999;}
  },200);
  setTimeout(function(){
    clearInterval(tracker);col.lastBottom=-999;
    if(el.parentNode)el.remove();
    if(_noteQueue.length<200)_noteQueue.push({isim:isim,mesaj:mesaj,foto:foto});
    setTimeout(tryQueue,100);
  },fallDur*1000+200);
}
function tryQueue(){
  if(!_noteQueue.length)return;
  var col=getBestCol();
  if(!canLaunch(col)){setTimeout(tryQueue,500);return;}
  var next=_noteQueue.shift();launchNote(next.isim,next.mesaj,next.foto);
}
function spawnNote(isim,mesaj,foto){
  launchNote(isim,mesaj,foto);count++;
  var ct=document.getElementById('ct');if(ct)ct.textContent=count+' not';
  var t=document.createElement('div');t.className='toast';
  t.textContent=esc(isim)+' bir not bıraktı ♡';
  document.getElementById('canvas').appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},4200);
}

// HAND PRINTS
(function(){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(ov);
  function foot(flip){
    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 32 36');s.setAttribute('width','12');s.setAttribute('height','13');
    var ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');
    if(flip)g.setAttribute('transform','scale(-1,1) translate(-32,0)');
    var palm=document.createElementNS(ns,'path');palm.setAttribute('d','M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 C6,13 7,12 9,12 C11,12 13,12 15,13 C17,12 19,12 21,13 C23,12 25,13 26,15 C27,17 28,19 28,23 C29,27 28,31 25,32 Z');palm.setAttribute('fill','#C8A090');palm.setAttribute('opacity','0.4');g.appendChild(palm);
    [{cx:7,cy:8,rx:2.8,ry:3.2},{cx:12,cy:6,rx:2.6,ry:3.4},{cx:18,cy:6,rx:2.6,ry:3.4},{cx:23,cy:7.5,rx:2.4,ry:3.1}].forEach(function(f){var e=document.createElementNS(ns,'ellipse');e.setAttribute('cx',f.cx);e.setAttribute('cy',f.cy);e.setAttribute('rx',f.rx);e.setAttribute('ry',f.ry);e.setAttribute('fill','#C8A090');e.setAttribute('opacity','0.38');g.appendChild(e);});
    var thumb=document.createElementNS(ns,'ellipse');thumb.setAttribute('cx','3');thumb.setAttribute('cy','18');thumb.setAttribute('rx','2.2');thumb.setAttribute('ry','3.5');thumb.setAttribute('fill','#C8A090');thumb.setAttribute('opacity','0.32');thumb.setAttribute('transform','rotate(-25,3,18)');g.appendChild(thumb);s.appendChild(g);return s;
  }
  function walk(){
    var W=window.innerWidth,H=window.innerHeight,sx=0.08+Math.random()*0.78,sy=0.12+Math.random()*0.68;
    var ang=(-15+Math.random()*30)*Math.PI/180,stride=0.05+Math.random()*0.02;
    for(var i=0;i<5;i++){(function(idx){
      var right=idx%2===0,perp=ang+Math.PI/2,lat=right?0.022:-0.022;
      var px=(sx+Math.cos(ang)*stride*idx+Math.cos(perp)*lat)*W,py=(sy+Math.sin(ang)*stride*idx+Math.sin(perp)*lat)*H;
      var rot=(ang*180/Math.PI)+(right?8:-8);
      setTimeout(function(){
        var wrap=document.createElement('div');wrap.style.cssText='position:absolute;left:'+px+'px;top:'+py+'px;transform:rotate('+rot+'deg);opacity:0;transition:opacity 0.5s ease;';
        wrap.appendChild(foot(!right));ov.appendChild(wrap);
        requestAnimationFrame(function(){requestAnimationFrame(function(){wrap.style.opacity='0.55';});});
        setTimeout(function(){wrap.style.transition='opacity 1.8s ease';wrap.style.opacity='0';setTimeout(function(){if(wrap.parentNode)wrap.remove();},1900);},3500);
      },idx*400);
    })(i);}
  }
  setTimeout(function(){walk();setInterval(walk,6000+Math.random()*3000);},2000);
})();

// WEBSOCKET
function esc2(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function connect(){
  var proto=location.protocol==='https:'?'wss:':'ws:';
  var ws=new WebSocket(proto+'//'+location.host);
  ws.onmessage=function(e){
    try{
      var msg=JSON.parse(e.data);
      if(msg.type==='init'){if(!window._noteQueue)window._noteQueue=[];msg.dilekler.forEach(function(d){if(typeof spawnNote==='function')spawnNote(d.isim,d.mesaj,d.foto);});if(typeof count!=='undefined')count=msg.dilekler.length;var ct=document.getElementById('ct');if(ct)ct.textContent=msg.dilekler.length+' not';}
      else if(msg.type==='dilek'){if(typeof spawnNote==='function')spawnNote(msg.dilek.isim,msg.dilek.mesaj,msg.dilek.foto);}
      else if(msg.type==='clear'){var n=document.getElementById('notes');if(n)n.innerHTML='';if(typeof count!=='undefined')count=0;var ct=document.getElementById('ct');if(ct)ct.textContent='0 not';window._noteQueue=[];}
    }catch(err){console.log('WS:',err);}
  };
  ws.onclose=function(){setTimeout(connect,3000);};
}
connect();
</script>
</body>
</html>`;

  const finalHtml = html.replace('QR_PLACEHOLDER', qrImg);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(finalHtml);
});

// ── MOBİL NOT SAYFASI ──
app.get('/not', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="color-scheme" content="light only">
<title>Rena'ya Not Birak</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Lato:wght@200;300;400&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;min-height:100%;background:#F9F4EE;color-scheme:light only;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px 20px;font-family:'Cormorant Garamond',Georgia,serif;}
.card{width:100%;max-width:400px;background:linear-gradient(160deg,#FFFBF6 0%,#FFF6EE 100%);border:1px solid rgba(200,168,136,.25);padding:38px 28px 34px;text-align:center;box-shadow:0 8px 40px rgba(160,120,80,.08);}
.logo{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:300;font-size:46px;color:#7A5535;letter-spacing:.14em;margin-bottom:2px;display:block;}
.logo-sub{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:300;font-size:18px;color:#9A7050;letter-spacing:.18em;margin-bottom:6px;display:block;}
.year{font-family:'Lato',sans-serif;font-weight:200;font-size:11px;letter-spacing:.5em;color:#B89878;margin-bottom:28px;display:block;}
.rule{width:50px;height:1px;background:linear-gradient(to right,transparent,#C8A878,transparent);margin:0 auto 28px;}
label{display:block;text-align:left;font-family:'Lato',sans-serif;font-weight:300;font-size:13px;letter-spacing:.08em;color:#8A6040;margin-bottom:8px;}
input,textarea{display:block;width:100%;background:transparent;border:none;border-bottom:1.5px solid rgba(200,168,136,.4);font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:20px;color:#5A3820;padding:10px 4px;outline:none;transition:border-color .3s;margin-bottom:24px;resize:none;-webkit-appearance:none;border-radius:0;}
input::placeholder,textarea::placeholder{color:rgba(160,120,80,.35);font-style:italic;font-size:18px;}
input:focus,textarea:focus{border-color:#C8A878;}
.foto-area{width:100%;aspect-ratio:4/3;border:1.5px dashed rgba(200,168,136,.4);display:flex;align-items:center;justify-content:center;cursor:pointer;margin-bottom:24px;overflow:hidden;background:rgba(255,250,244,.6);position:relative;border-radius:2px;}
.foto-hint{font-family:'Lato',sans-serif;font-weight:200;font-size:12px;letter-spacing:.06em;color:rgba(160,120,80,.5);margin-top:8px;text-align:center;}
.foto-icon{font-size:28px;}
.foto-preview{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;display:none;}
.btn{display:block;width:100%;padding:16px;background:linear-gradient(135deg,#D4A878,#A87850);border:none;font-family:'Lato',sans-serif;font-weight:300;font-size:14px;letter-spacing:.15em;color:#fff;cursor:pointer;transition:opacity .3s;-webkit-appearance:none;border-radius:0;}
.btn:active{opacity:.85;}.btn:disabled{opacity:.5;}
.err{font-family:'Lato',sans-serif;font-size:13px;color:#C07060;margin-top:-16px;margin-bottom:16px;display:none;text-align:left;letter-spacing:.03em;}
.success{display:none;padding:16px 0;}
.s-icon{font-size:52px;margin-bottom:16px;display:block;animation:pop .6s cubic-bezier(.22,1,.36,1);}
@keyframes pop{0%{transform:scale(0);}100%{transform:scale(1);}}
.s-title{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:300;font-size:34px;color:#7A5535;margin-bottom:8px;letter-spacing:.05em;}
.s-sub{font-family:'Lato',sans-serif;font-weight:200;font-size:12px;letter-spacing:.25em;color:#B89878;}
.again{margin-top:26px;background:transparent;border:1px solid rgba(200,168,136,.35);font-family:'Lato',sans-serif;font-weight:300;font-size:13px;letter-spacing:.08em;color:#9A7050;padding:12px 24px;cursor:pointer;-webkit-appearance:none;border-radius:0;}
</style>
</head>
<body>
<div class="card">
  <span class="logo">Rena</span>
  <span class="logo-sub">Özerden</span>
  <span class="year">2 0 2 6</span>
  <div class="rule"></div>
  <div id="form">
    <label>Adınız</label>
    <input type="text" id="isim" placeholder="Adınızı yazın…" maxlength="40" autocomplete="off" autocorrect="off">
    <label>Notunuz</label>
    <textarea id="mesaj" rows="3" placeholder="Rena'ya bir not bırakın…" maxlength="160"></textarea>
    <label>Fotoğraf <span style="color:#C07060;font-weight:300;">*</span></label>
    <div class="foto-area" id="fotoArea" onclick="document.getElementById('fotoInput').click()">
      <div id="fotoPlaceholder" style="text-align:center;">
        <div class="foto-icon">📸</div>
        <div class="foto-hint">Fotoğraf seç veya çek</div>
      </div>
      <img id="fotoPreview" class="foto-preview" alt=""/>
    </div>
    <input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none">
    <div class="err" id="err">Fotoğraf zorunludur.</div>
    <button class="btn" id="sendBtn">Ekrana Gönder ♡</button>
  </div>
  <div class="success" id="success">
    <span class="s-icon">🌸</span>
    <div class="s-title">Notun uçtu!</div>
    <div class="s-sub">TV ekranında süzülüyor</div>
    <button class="again" id="anotherBtn">Bir not daha bırak</button>
  </div>
</div>
<script>
document.getElementById('fotoInput').addEventListener('change',function(){
  var file=this.files[0];if(!file)return;
  var img=new Image(),reader=new FileReader();
  reader.onload=function(e){
    img.onload=function(){
      var canvas=document.createElement('canvas'),max=400;
      var w=img.width,h=img.height;
      if(w>h){if(w>max){h=h*max/w;w=max;}}else{if(h>max){w=w*max/h;h=max;}}
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);
      var compressed=canvas.toDataURL('image/jpeg',0.7);
      document.getElementById('fotoPreview').src=compressed;
      document.getElementById('fotoPreview').style.display='block';
      document.getElementById('fotoPlaceholder').style.display='none';
      window._compressedFoto=compressed;
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
});
var btn=document.getElementById('sendBtn');
btn.addEventListener('click',async function(){
  var isim=document.getElementById('isim').value.trim();
  var mesaj=document.getElementById('mesaj').value.trim();
  var errEl=document.getElementById('err');
  if(!window._compressedFoto){errEl.textContent='Fotoğraf zorunludur.';errEl.style.display='block';return;}
  errEl.style.display='none';
  btn.disabled=true;btn.textContent='Gönderiliyor…';
  try{
    var fd=new FormData();
    if(isim)fd.append('isim',isim);
    if(mesaj)fd.append('mesaj',mesaj);
    fd.append('fotoBase64',window._compressedFoto);
    var r=await fetch('/api/not',{method:'POST',body:fd});
    if(r.ok){document.getElementById('form').style.display='none';document.getElementById('success').style.display='block';}
    else{btn.disabled=false;btn.textContent='Ekrana Gönder ♡';}
  }catch(e){btn.disabled=false;btn.textContent='Bağlantı hatası — tekrar dene';}
});
document.getElementById('anotherBtn').addEventListener('click',function(){
  document.getElementById('isim').value='';document.getElementById('mesaj').value='';
  document.getElementById('fotoInput').value='';window._compressedFoto=null;
  document.getElementById('fotoPreview').style.display='none';
  document.getElementById('fotoPlaceholder').style.display='block';
  document.getElementById('success').style.display='none';
  document.getElementById('form').style.display='block';
  btn.disabled=false;btn.textContent='Ekrana Gönder ♡';
});
</script>
</body>
</html>`);
});

// ── ADMİN ──
const ADMIN_KEY = process.env.ADMIN_KEY || 'rena2026';
app.get('/admin', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.send('<html><body style="font-family:sans-serif;padding:40px"><h2>Şifre gerekli</h2><form><input name="key" type="password" placeholder="Şifre"/><button>Gir</button></form></body></html>');
  }
  const count = dilekler.length;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Georgia,serif;background:#F9F4EE;padding:32px 20px;max-width:600px;margin:0 auto;}h1{color:#7A5535;font-size:28px;margin-bottom:4px;}.sub{color:#B89878;font-size:13px;margin-bottom:32px;}.note{background:#fff;border:1px solid rgba(200,168,136,.25);padding:16px 18px;margin-bottom:12px;border-radius:2px;}.note-name{font-weight:600;color:#9A7050;font-size:14px;margin-bottom:4px;}.note-msg{color:#7A5535;font-size:15px;font-style:italic;}.note-time{color:#C8A878;font-size:11px;margin-top:6px;}.note-foto{width:80px;height:80px;object-fit:cover;float:right;border-radius:2px;margin-left:12px;}.btn-clear{background:#C87060;color:#fff;border:none;padding:14px 28px;font-size:14px;cursor:pointer;border-radius:2px;margin-top:24px;}.empty{color:#C8A878;font-style:italic;}</style></head><body>
<h1>Rena Özerden</h1><div class="sub">Admin · ${count} not</div>
${dilekler.length===0?'<p class="empty">Henüz not yok.</p>':dilekler.map(d=>`<div class="note">${d.foto?'<img class="note-foto" src="'+d.foto+'" alt=""/>':''}<div class="note-name">${d.isim}</div><div class="note-msg">${d.mesaj||'—'}</div><div class="note-time">${d.saat}</div></div>`).join('')}
${dilekler.length>0?`<form method="POST" action="/admin/clear?key=${ADMIN_KEY}" onsubmit="return confirm('Tüm notlar silinecek. Emin misin?')"><button class="btn-clear" type="submit">Tüm Notları Sil (${count})</button></form>`:''}
</body></html>`);
});

app.post('/admin/clear', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send('Yetkisiz');
  dilekler.length = 0;
  if (pool) await pool.query('DELETE FROM notlar').catch(e => console.error(e.message));
  broadcast({ type: 'clear' });
  res.redirect('/admin?key=' + ADMIN_KEY);
});

app.get('/ping', (req, res) => res.send('ok'));

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n✨  Rena Özerden\n');
  console.log('📺  TV  →  http://localhost:' + PORT);
  console.log('📱  Not →  ' + NOT_URL + '\n');
});
