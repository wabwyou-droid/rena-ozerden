const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const QRCode    = require('qrcode');
const multer    = require('multer');
const sharp     = require('sharp');

// Multer: memory storage, max 8MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sadece görsel yüklenebilir'));
  }
});

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;

const PUBLIC_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const NOT_URL = `${PUBLIC_URL}/not`;
const dilekler = [];

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', ws => {
  if (dilekler.length) ws.send(JSON.stringify({ type: 'init', dilekler }));
});

app.use(express.json());

app.post('/api/not', upload.single('foto'), async (req, res) => {
  const isim  = (req.body?.isim  || '').slice(0, 40);
  const mesaj = (req.body?.mesaj || '').slice(0, 160);
  if (!isim && !mesaj && !req.file) return res.status(400).json({ ok: false });

  let fotoBase64 = null;
  if (req.file) {
    try {
      // Resize to max 400px wide, convert to jpeg for small payload
      const buf = await sharp(req.file.buffer)
        .resize({ width: 400, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
      fotoBase64 = 'data:image/jpeg;base64,' + buf.toString('base64');
    } catch (e) {
      // If sharp fails, use original base64
      fotoBase64 = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    }
  }

  const d = {
    id:    Date.now(),
    isim:  isim  || 'Misafir',
    mesaj: mesaj || '',
    foto:  fotoBase64,
    saat:  new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  };
  dilekler.push(d);
  broadcast({ type: 'dilek', dilek: d });
  res.json({ ok: true });
});

// ── TV EKRANI ── //
app.get('/', async (req, res) => {
  const qr = await QRCode.toDataURL(NOT_URL, {
    width: 180, margin: 1,
    color: { dark: '#9A7050', light: '#F9F4EE' }
  });

  // Replace QR placeholder with real QR
  const qrImg = `<img src="${qr}" alt="QR" style="display:block;width:100%;height:100%;">`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Rena Özerden</title>
<style>

@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Lato:wght@100;200;300&display=swap');

*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
html {
  width:100%; height:100%;
  color-scheme: light only;
  background:#F7F0E8;
}
body {
  width:100vw; height:100vh; overflow:hidden;
  display:flex; align-items:center; justify-content:center;
  background:#F7F0E8;
  color-scheme: light only;
}

/* ── CANVAS 16:9 ── */
.canvas {
  position:relative;
  width:100vw; height:56.25vw;
  max-height:100vh; max-width:177.78vh;
  overflow:hidden; cursor:crosshair;
  background:#F9F4EE;
}

/* ── BG TEXTURE ── */
.bg {
  position:absolute; inset:0; z-index:0;
  background: radial-gradient(ellipse 80% 70% at 50% 50%, #FFFBF6 0%, #F5EDE2 60%, #EDE0D4 100%);
  animation: bgBreath 20s ease-in-out infinite;
}
@keyframes bgBreath {
  0%,100% { background:radial-gradient(ellipse 80% 70% at 50% 50%, #FFFBF6 0%, #F5EDE2 60%, #EDE0D4 100%); }
  50%     { background:radial-gradient(ellipse 80% 70% at 50% 50%, #FFFDF8 0%, #F8F0E6 60%, #EFE3D8 100%); }
}

/* Fine grain */
.grain {
  position:absolute; inset:0; z-index:1; pointer-events:none; opacity:.025;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px;
}

.canvas > * { position:relative; z-index:2; }

/* ── FALLING PETALS ── */
#snow { position:absolute; inset:0; z-index:3; pointer-events:none; overflow:hidden; }
.sp {
  position:absolute; top:-3vw;
  opacity:0; font-size:var(--fs);
  animation: spFall var(--dur) ease-in-out infinite var(--del);
}
@keyframes spFall {
  0%   { opacity:0; transform:translateY(0) rotate(0deg) translateX(0); }
  8%   { opacity:var(--op); }
  85%  { opacity:var(--op); }
  100% { opacity:0; transform:translateY(115vh) rotate(var(--spin)) translateX(var(--sway)); }
}

/* ── CLICK BURST ── */
#petals { position:absolute; inset:0; z-index:4; pointer-events:none; overflow:hidden; }
.burst  { position:absolute; pointer-events:none; }
.petal  {
  position:absolute; border-radius:50%;
  animation: petalOut var(--dur,1.4s) ease-out forwards;
}
@keyframes petalOut {
  0%   { transform:translate(0,0) scale(1); opacity:1; }
  100% { transform:translate(var(--tx),var(--ty)) scale(.2); opacity:0; }
}

/* ── SPARKLES ── */
#sparkles { position:absolute; inset:0; z-index:2; pointer-events:none; overflow:hidden; }
.sparkle {
  position:absolute;
  animation: twinkle var(--dur) ease-in-out infinite var(--del);
  opacity:0;
}
@keyframes twinkle {
  0%,100% { opacity:0; transform:scale(0) rotate(0deg); }
  40%,60% { opacity:var(--op); transform:scale(1) rotate(90deg); }
}

/* ── NOTE CARDS ── */
#notes { position:absolute; inset:0; z-index:20; pointer-events:none; overflow:hidden; }
.nc {
  position:absolute;
  background:rgba(255,252,248,.95);
  border:1px solid rgba(210,175,155,.3);
  padding:.9vw 1.2vw; max-width:18vw;
  box-shadow:0 4px 24px rgba(160,120,90,.08);
  animation: ncIn 1.2s cubic-bezier(.22,1,.36,1) forwards, ncDrift var(--dd) ease-in-out infinite 1.2s;
  opacity:0;
}
@keyframes ncIn {
  from { opacity:0; transform:translateY(8px) rotate(var(--r)) scale(.93); }
  to   { opacity:1; transform:translateY(0)   rotate(var(--r)) scale(1); }
}
@keyframes ncDrift {
  0%   { transform:translate(0,0) rotate(var(--r)); }
  25%  { transform:translate(var(--x1),var(--y1)) rotate(calc(var(--r) + .8deg)); }
  50%  { transform:translate(var(--x2),var(--y2)) rotate(calc(var(--r) - .6deg)); }
  75%  { transform:translate(var(--x1),var(--y2)) rotate(calc(var(--r) + .4deg)); }
  100% { transform:translate(0,0) rotate(var(--r)); }
}
.nc-foto { width:100%; aspect-ratio:1; object-fit:cover; display:block; margin-bottom:.5vw; border-radius:1px; }
.nc-name {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-weight:400; font-size:clamp(8px,.95vw,14px);
  color:#9A7055; letter-spacing:.06em; margin-bottom:.25vw;
}
.nc-msg {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-weight:300;
  font-size:clamp(7px,.82vw,12px); color:#B8906A; line-height:1.55;
}
.nc-heart { font-size:.6vw; color:#DDB898; margin-top:.3vw; opacity:.7; }

/* ── MAIN LAYOUT ── */
.layout {
  position:absolute; inset:0; z-index:5;
  display:grid;
  grid-template-columns: 1.1fr 1px 1fr;
  align-items:center;
  padding:0 7vw;
}

/* ── LEFT: Flower + title ── */
.left-col {
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  padding-right:4vw; gap:0;
}

/* Flower */
.flower-wrap {
  width:min(34vw,56vh);
  opacity:0; animation:fadeUp 2.5s ease forwards .3s;
  filter:drop-shadow(0 8px 24px rgba(180,130,100,.14));
}
.flower-wrap svg {
  animation:flowerSway 14s ease-in-out infinite 4s;
  transform-origin:50% 95%;
}
@keyframes flowerSway {
  0%,100% { transform:rotate(0deg) translateY(0); }
  30%     { transform:rotate(1.2deg) translateY(-.3vw); }
  70%     { transform:rotate(-1deg) translateY(.2vw); }
}

/* Title */
.title-rena {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-weight:300;
  font-size:clamp(36px,6.5vw,104px);
  color:#8A6040; letter-spacing:.18em; line-height:1;
  margin-top:-1vw; margin-bottom:.3vw;
  opacity:0; animation:fadeUp 2s ease forwards 1.4s, renaBreath 12s ease-in-out infinite 8s;
}
@keyframes renaBreath {
  0%,100% { letter-spacing:.18em; }
  50%     { letter-spacing:.24em; }
}
.title-ozerden {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-weight:300;
  font-size:clamp(36px,6.5vw,104px);
  letter-spacing:.18em;
  color:#8A6040; margin-bottom:0;
  opacity:0; animation:fadeUp 2s ease forwards 1.9s;
}
.title-line {
  width:0; height:1px;
  background:linear-gradient(to right,transparent,#C8A888,transparent);
  margin:.8vw 0; opacity:.6;
  animation:lineGrow 2s ease forwards 2.4s;
}
@keyframes lineGrow { to { width:min(8vw,100px); } }
.title-year {
  font-family:'Lato',sans-serif; font-weight:300;
  font-size:clamp(11px,1.05vw,16px); letter-spacing:.5em;
  color:#8A6845; opacity:0; animation:fadeUp 2s ease forwards 2.8s;
}

/* ── DIVIDER ── */
.div-v {
  height:0; width:1px; align-self:center;
  background:linear-gradient(to bottom,transparent,#C8A888 25%,#C8A888 75%,transparent);
  opacity:.4; animation:divGrow 2.2s ease forwards 3.2s;
}
@keyframes divGrow { to { height:45%; } }

/* ── RIGHT: Typography ── */
.right-col {
  padding-left:5vw;
  display:flex; flex-direction:column; justify-content:center;
}

.r-top {
  font-family:'Lato',sans-serif; font-weight:300;
  font-size:clamp(12px,1.2vw,20px); letter-spacing:.3em;
  color:#8A6040; opacity:0; animation:fadeUp 2s ease forwards 3.6s;
  margin-bottom:.8vw;
}
.r-main {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-weight:300;
  font-size:clamp(32px,5.8vw,94px);
  line-height:.92; color:#7A5535;
  letter-spacing:.02em;
  opacity:0; animation:fadeUp 2.2s ease forwards 4.1s, mainGlow 14s ease-in-out infinite 10s;
  margin-bottom:.8vw;
  text-shadow:0 2px 30px rgba(160,110,70,.12);
}
@keyframes mainGlow {
  0%,100% { text-shadow:0 2px 30px rgba(160,110,70,.12); }
  50%     { text-shadow:0 2px 50px rgba(160,110,70,.28), 0 0 80px rgba(180,130,80,.1); }
}
.r-line {
  width:0; height:1px;
  background:linear-gradient(to right,#C8A888,transparent);
  opacity:.45; margin-bottom:1.8vw;
  animation:lineGrow2 1.8s ease forwards 5s;
}
@keyframes lineGrow2 { to { width:min(5vw,64px); } }
.r-sub {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-weight:300;
  font-size:clamp(10px,1.1vw,18px); line-height:2;
  color:#A88060; letter-spacing:.06em;
  opacity:0; animation:fadeUp 2s ease forwards 5.4s;
}

/* ── QR ── */
.qr-panel {
  position:absolute; bottom:3.5vw; right:4vw; z-index:10;
  display:flex; flex-direction:column; align-items:center; gap:.6vw;
  opacity:0; animation:fadeUp 2s ease forwards 6.5s;
}
.qr-frame {
  background:#FFFBF6; padding:5px;
  border:1px solid rgba(200,168,136,.3);
  box-shadow:0 2px 12px rgba(160,120,80,.06);
}
.qr-frame svg { display:block; width:min(5vw,60px); height:min(5vw,60px); }
.qr-lbl {
  font-family:'Lato',sans-serif; font-weight:100;
  font-size:clamp(5px,.6vw,8px); letter-spacing:.25em;
  color:rgba(168,128,96,.55); text-align:center; line-height:2;
}

/* ── COUNTER ── */
.counter {
  position:absolute; bottom:3.5vw; left:4vw; z-index:10;
  display:flex; align-items:center; gap:.5vw;
  opacity:0; animation:fadeUp 2s ease forwards 6.5s;
}
.ldot {
  width:5px; height:5px; border-radius:50%;
  background:#D4B090; flex-shrink:0;
  animation:ldotPulse 3s ease-in-out infinite;
}
@keyframes ldotPulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.3;transform:scale(.5);} }
.ctxt {
  font-family:'Lato',sans-serif; font-weight:100;
  font-size:clamp(6px,.65vw,9px); letter-spacing:.3em;
  color:rgba(168,128,96,.5);
}

/* ── DEMO BTN ── */
.demo-btn {
  position:absolute; bottom:3.5vw; left:50%; transform:translateX(-50%);
  z-index:10; background:rgba(255,252,248,.85);
  border:1px solid rgba(200,168,136,.3);
  font-family:'Lato',sans-serif; font-weight:200;
  font-size:clamp(7px,.7vw,10px); letter-spacing:.2em;
  color:#A88060; padding:.5vw 1.4vw; cursor:pointer;
  white-space:nowrap; transition:background .3s;
  opacity:0; animation:fadeUp 2s ease forwards 7s;
}
.demo-btn:hover { background:rgba(255,250,244,.95); }

/* ── TOAST ── */
.toast {
  position:absolute; top:5vw; left:50%; z-index:60;
  transform:translateX(-50%); white-space:nowrap;
  background:rgba(255,252,248,.96);
  border:1px solid rgba(200,168,136,.28);
  padding:.55vw 1.8vw;
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-size:clamp(10px,1.05vw,16px);
  color:#9A7050; letter-spacing:.04em;
  box-shadow:0 2px 16px rgba(160,120,80,.07);
  animation:toastAnim 4s ease forwards; pointer-events:none;
}
@keyframes toastAnim {
  0%  { opacity:0; transform:translateX(-50%) translateY(-8px); }
  10% { opacity:1; transform:translateX(-50%) translateY(0); }
  78% { opacity:1; }
  100%{ opacity:0; }
}

@keyframes fadeUp {
  from { opacity:0; transform:translateY(10px); }
  to   { opacity:1; transform:translateY(0); }
}

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

    <!-- LEFT -->
    <div class="left-col">

      <!-- Large tulip / peony illustration -->
      <div class="flower-wrap">
        <svg viewBox="0 0 380 420" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="p1" cx="45%" cy="30%" r="65%">
              <stop offset="0%" stop-color="#FDEAEA"/>
              <stop offset="40%" stop-color="#F2C0C0"/>
              <stop offset="100%" stop-color="#D99090"/>
            </radialGradient>
            <radialGradient id="p2" cx="55%" cy="30%" r="65%">
              <stop offset="0%" stop-color="#FDEEF0"/>
              <stop offset="40%" stop-color="#EDB8C0"/>
              <stop offset="100%" stop-color="#D08898"/>
            </radialGradient>
            <radialGradient id="p3" cx="50%" cy="25%" r="60%">
              <stop offset="0%" stop-color="#FFF0F0"/>
              <stop offset="50%" stop-color="#F0C8CC"/>
              <stop offset="100%" stop-color="#C88890"/>
            </radialGradient>
            <radialGradient id="p4" cx="50%" cy="25%" r="60%">
              <stop offset="0%" stop-color="#FDE8EE"/>
              <stop offset="50%" stop-color="#E8B0BC"/>
              <stop offset="100%" stop-color="#C07888"/>
            </radialGradient>
            <radialGradient id="leafG" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#C8D8A8"/>
              <stop offset="100%" stop-color="#8AAA68"/>
            </radialGradient>
            <radialGradient id="centerG" cx="45%" cy="35%" r="60%">
              <stop offset="0%" stop-color="#FFEEDD"/>
              <stop offset="100%" stop-color="#E0B890"/>
            </radialGradient>
            <filter id="petalBlur"><feGaussianBlur stdDeviation=".4"/></filter>
          </defs>

          <!-- Stem -->
          <path d="M190,400 Q188,340 190,280 Q192,240 190,200" stroke="#9AB878" stroke-width="4" fill="none" stroke-linecap="round"/>

          <!-- Left leaf -->
          <path d="M185,320 Q150,290 120,298 Q145,310 182,328Z" fill="url(#leafG)" opacity=".85"/>
          <path d="M185,320 Q152,296 124,300" stroke="#8AAA68" stroke-width=".8" fill="none" opacity=".5"/>

          <!-- Right leaf -->
          <path d="M195,295 Q230,265 260,272 Q235,283 197,302Z" fill="url(#leafG)" opacity=".8"/>
          <path d="M195,295 Q228,268 258,274" stroke="#8AAA68" stroke-width=".8" fill="none" opacity=".5"/>

          <!-- Small left leaf -->
          <path d="M186,260 Q158,240 140,248 Q160,254 185,268Z" fill="url(#leafG)" opacity=".65"/>

          <!-- Outer petals — bottom layer -->
          <!-- Petal BL -->
          <path d="M190,195 Q148,155 138,105 Q132,70 155,55 Q175,42 190,75 Q190,130 190,195Z" fill="url(#p1)" opacity=".75"/>
          <!-- Petal BR -->
          <path d="M190,195 Q232,155 242,105 Q248,70 225,55 Q205,42 190,75 Q190,130 190,195Z" fill="url(#p2)" opacity=".75"/>
          <!-- Petal far left -->
          <path d="M190,195 Q130,175 100,135 Q75,98 90,72 Q108,48 140,75 Q165,100 190,195Z" fill="url(#p1)" opacity=".7"/>
          <!-- Petal far right -->
          <path d="M190,195 Q250,175 280,135 Q305,98 290,72 Q272,48 240,75 Q215,100 190,195Z" fill="url(#p2)" opacity=".7"/>

          <!-- Middle petals -->
          <!-- ML -->
          <path d="M190,188 Q155,148 150,100 Q148,65 170,52 Q188,42 190,80 Q190,135 190,188Z" fill="url(#p3)" opacity=".88"/>
          <!-- MR -->
          <path d="M190,188 Q225,148 230,100 Q232,65 210,52 Q192,42 190,80 Q190,135 190,188Z" fill="url(#p4)" opacity=".88"/>
          <!-- ML2 -->
          <path d="M190,185 Q148,160 138,118 Q132,85 158,70 Q178,58 190,95 Q190,140 190,185Z" fill="url(#p3)" opacity=".82"/>
          <!-- MR2 -->
          <path d="M190,185 Q232,160 242,118 Q248,85 222,70 Q202,58 190,95 Q190,140 190,185Z" fill="url(#p4)" opacity=".82"/>

          <!-- Inner petals -->
          <path d="M190,178 Q162,148 160,108 Q158,78 178,66 Q190,60 190,90 Q190,136 190,178Z" fill="url(#p3)"/>
          <path d="M190,178 Q218,148 220,108 Q222,78 202,66 Q190,60 190,90 Q190,136 190,178Z" fill="url(#p4)"/>
          <path d="M190,172 Q168,145 168,110 Q168,84 184,75 Q190,72 190,96 Q190,136 190,172Z" fill="url(#p3)" opacity=".9"/>
          <path d="M190,172 Q212,145 212,110 Q212,84 196,75 Q190,72 190,96 Q190,136 190,172Z" fill="url(#p4)" opacity=".9"/>

          <!-- Petal veins / highlights -->
          <path d="M182,180 Q176,148 174,118 Q172,92 180,78" stroke="rgba(255,235,235,.5)" stroke-width="1" fill="none" stroke-linecap="round"/>
          <path d="M198,180 Q204,148 206,118 Q208,92 200,78" stroke="rgba(255,235,235,.5)" stroke-width="1" fill="none" stroke-linecap="round"/>

          <!-- Center -->
          <circle cx="190" cy="160" r="22" fill="url(#centerG)"/>
          <circle cx="190" cy="160" r="14" fill="#F5DCC0" opacity=".8"/>
          <circle cx="188" cy="157" r="6"  fill="rgba(255,245,235,.7)"/>

          <!-- Stamens -->
          <g stroke="#C8986A" stroke-width=".9" stroke-linecap="round" opacity=".7">
            <line x1="190" y1="152" x2="190" y2="144"/><circle cx="190" cy="142" r="2" fill="#D4A870"/>
            <line x1="183" y1="154" x2="179" y2="147"/><circle cx="178" cy="145" r="1.8" fill="#D4A870"/>
            <line x1="197" y1="154" x2="201" y2="147"/><circle cx="202" cy="145" r="1.8" fill="#D4A870"/>
            <line x1="186" y1="151" x2="183" y2="143"/><circle cx="182" cy="141" r="1.5" fill="#D4A870"/>
            <line x1="194" y1="151" x2="197" y2="143"/><circle cx="198" cy="141" r="1.5" fill="#D4A870"/>
          </g>

          <!-- Small bud left -->
          <path d="M155,230 Q148,215 150,205 Q155,198 160,205 Q163,215 155,230Z" fill="#EDB8C0" opacity=".7"/>
          <path d="M155,230 Q150,218 152,207" stroke="#9AB878" stroke-width="1.5" fill="none"/>
          <line x1="155" y1="230" x2="155" y2="260" stroke="#9AB878" stroke-width="2.5"/>

          <!-- Small bud right -->
          <path d="M225,245 Q218,230 220,220 Q225,213 230,220 Q233,230 225,245Z" fill="#F2C0C8" opacity=".65"/>
          <line x1="225" y1="245" x2="225" y2="270" stroke="#9AB878" stroke-width="2"/>

        </svg>
      </div>

      <div class="title-rena">Rena</div>
      <div class="title-ozerden">Özerden</div>
      <div class="title-line"></div>
      <div class="title-year">2 0 2 6</div>
    </div>

    <!-- DIVIDER -->
    <div class="div-v"></div>

    <!-- RIGHT -->
    <div class="right-col">
      <div class="r-top" style="opacity:1;color:#7A5030;font-family:Georgia,serif;font-size:clamp(13px,1.3vw,22px);font-weight:400;letter-spacing:.2em;margin-bottom:.8vw;">Ho&#x15F; Geldin</div>
      <div class="r-main">
        Hoş Geldin<br>
        Rena
      </div>
      <div class="r-line"></div>
      <div class="r-sub" style="opacity:1 !important;color:#7A5535 !important;font-family:Georgia,serif;font-style:italic;font-size:clamp(12px,1.2vw,20px);line-height:2;letter-spacing:.04em;">
        notunuzu b&#x131;rakmay&#x131;<br>l&#xFC;tfen unutmay&#x131;n&#x131;z
      </div>
    </div>

  </div>

  <!-- QR -->
  <div class="qr-panel">
    <div class="qr-frame">
      ${qrImg}
    </div>
    <div class="qr-lbl">Not bırak ♡</div>
  </div>

  <div class="counter">
    <div class="ldot"></div>
    <div class="ctxt" id="ct">0 not</div>
  </div>

  <button class="demo-btn" id="demoBtn">+ Demo not ekle</button>
</div>

<script>
// ── FALLING PETALS ──
(function(){
  var s=document.getElementById('snow');
  var items=['🌸','🌷','✿','❀','·','∘','⋅'];
  for(var i=0;i<28;i++){
    var el=document.createElement('div'); el.className='sp';
    var sz=(.5+Math.random()*.9);
    el.style.cssText=
      'left:'+(Math.random()*105-2)+'%;'+
      '--fs:'+(sz*1.3)+'vw;'+
      '--dur:'+(11+Math.random()*14)+'s;'+
      '--del:-'+(Math.random()*20)+'s;'+
      '--op:'+(0.2+Math.random()*.4)+';'+
      '--spin:'+((Math.random()-.5)*300)+'deg;'+
      '--sway:'+((Math.random()-.5)*6)+'vw;';
    el.textContent=items[i%items.length];
    s.appendChild(el);
  }
})();

// ── SPARKLES ──
(function(){
  var sp=document.getElementById('sparkles');
  for(var i=0;i<18;i++){
    var el=document.createElement('div'); el.className='sparkle';
    var sz=.3+Math.random()*.7;
    el.style.cssText=
      'left:'+(5+Math.random()*90)+'%;top:'+(5+Math.random()*90)+'%;'+
      '--dur:'+(3+Math.random()*4)+'s;'+
      '--del:-'+(Math.random()*6)+'s;'+
      '--op:'+(0.3+Math.random()*.4)+';';
    el.innerHTML='<svg width="'+(sz*12)+'px" height="'+(sz*12)+'px" viewBox="0 0 12 12"><path d="M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z" fill="rgba(190,155,110,'+(0.35+Math.random()*.3)+')"/></svg>';
    sp.appendChild(el);
  }
})();

// ── CLICK BLOOM ──
var COLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8','#F5E0E0'];
function bloom(x,y){
  var b=document.createElement('div');b.className='burst';
  b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;';
  for(var i=0;i<16;i++){
    var p=document.createElement('div');p.className='petal';
    var ang=(Math.PI*2/16)*i,dist=25+Math.random()*30,s=4+Math.random()*5;
    p.style.cssText='width:'+s+'px;height:'+s+'px;background:'+COLS[i%6]+';left:0;top:0;'+
      '--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;'+
      '--dur:'+(1+Math.random()*.5)+'s;'+
      'animation-delay:'+(Math.random()*.08)+'s;';
    b.appendChild(p);
  }
  document.getElementById('petals').appendChild(b);
  setTimeout(function(){if(b.parentNode)b.remove();},1800);
}
document.getElementById('canvas').addEventListener('click',function(e){
  if(e.target.closest('#demoBtn')) return;
  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();
  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));
});

// ── NOTES ──
var count=0;
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function spawnNote(isim,mesaj,foto){
  var el=document.createElement('div');el.className='nc';
  var side=Math.random()>.5,left=side?54+Math.random()*26:4+Math.random()*20,top=10+Math.random()*62;
  var rot=(Math.random()-.5)*3.5;
  el.style.cssText='left:'+left+'%;top:'+top+'%;--r:'+rot+'deg;'+
    '--x1:'+((Math.random()-.5)*14)+'px;--y1:'+((Math.random()-.5)*12)+'px;'+
    '--x2:'+((Math.random()-.5)*12)+'px;--y2:'+((Math.random()-.5)*15)+'px;'+
    '--dd:'+(15+Math.random()*11).toFixed(1)+'s;';
  var fHtml=foto?'<img class="nc-foto" src="'+foto+'" alt=""/>':'';
  el.innerHTML=fHtml+'<div class="nc-name">'+esc(isim)+'</div><div class="nc-msg">'+esc(mesaj)+'</div><div class="nc-heart">♡</div>';
  document.getElementById('notes').appendChild(el);
  count++; document.getElementById('ct').textContent=count+' not';
  var t=document.createElement('div');t.className='toast';
  t.textContent=isim+' bir not bıraktı ♡';
  document.getElementById('canvas').appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},4200);
  var c=document.getElementById('canvas');bloom(c.offsetWidth*.7,c.offsetHeight*.44);
}

// ── DEMO ──
var demos=[
  {isim:'Ayşe Hanım',   mesaj:'Rena\'ya uzun ve sağlıklı bir ömür diliyorum 🌸'},
  {isim:'Mehmet Bey',   mesaj:'Hoş geldin dünyaya küçük prenses!'},
  {isim:'Zeynep & Can', mesaj:'Sen bizim en büyük sevincimizsin ♡'},
  {isim:'Selin',        mesaj:'Yüzün hep gülsün canım Rena'},
  {isim:'Büyükanne',    mesaj:'Torunum, gözümün nuru. Hoş geldin!'},
];
var di=0;
document.getElementById('demoBtn').addEventListener('click',function(e){
  e.stopPropagation();
  var n=demos[di%demos.length]; di++;
  spawnNote(n.isim,n.mesaj,null);
});

// Force all visible after 400ms
setTimeout(function(){
  var sel='.title-rena,.title-ozerden,.title-year,.r-top,.r-main,.r-sub,.r-line,.flower-wrap,.left-col,.qr-panel,.counter,.demo-btn,.div-v';
  document.querySelectorAll(sel).forEach(function(el){
    el.style.opacity='1';
    el.style.transform='translateY(0)';
  });
},400);
</script>
<script>
// ── FALLING PETALS ──
(function(){
  var s=document.getElementById('snow');
  var items=['🌸','🌷','✿','❀','·','∘','⋅'];
  for(var i=0;i<28;i++){
    var el=document.createElement('div'); el.className='sp';
    var sz=(.5+Math.random()*.9);
    el.style.cssText=
      'left:'+(Math.random()*105-2)+'%;'+
      '--fs:'+(sz*1.3)+'vw;'+
      '--dur:'+(11+Math.random()*14)+'s;'+
      '--del:-'+(Math.random()*20)+'s;'+
      '--op:'+(0.2+Math.random()*.4)+';'+
      '--spin:'+((Math.random()-.5)*300)+'deg;'+
      '--sway:'+((Math.random()-.5)*6)+'vw;';
    el.textContent=items[i%items.length];
    s.appendChild(el);
  }
})();

// ── SPARKLES ──
(function(){
  var sp=document.getElementById('sparkles');
  for(var i=0;i<18;i++){
    var el=document.createElement('div'); el.className='sparkle';
    var sz=.3+Math.random()*.7;
    el.style.cssText=
      'left:'+(5+Math.random()*90)+'%;top:'+(5+Math.random()*90)+'%;'+
      '--dur:'+(3+Math.random()*4)+'s;'+
      '--del:-'+(Math.random()*6)+'s;'+
      '--op:'+(0.3+Math.random()*.4)+';';
    el.innerHTML='<svg width="'+(sz*12)+'px" height="'+(sz*12)+'px" viewBox="0 0 12 12"><path d="M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z" fill="rgba(190,155,110,'+(0.35+Math.random()*.3)+')"/></svg>';
    sp.appendChild(el);
  }
})();

// ── CLICK BLOOM ──
var COLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8','#F5E0E0'];
function bloom(x,y){
  var b=document.createElement('div');b.className='burst';
  b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;';
  for(var i=0;i<16;i++){
    var p=document.createElement('div');p.className='petal';
    var ang=(Math.PI*2/16)*i,dist=25+Math.random()*30,s=4+Math.random()*5;
    p.style.cssText='width:'+s+'px;height:'+s+'px;background:'+COLS[i%6]+';left:0;top:0;'+
      '--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;'+
      '--dur:'+(1+Math.random()*.5)+'s;'+
      'animation-delay:'+(Math.random()*.08)+'s;';
    b.appendChild(p);
  }
  document.getElementById('petals').appendChild(b);
  setTimeout(function(){if(b.parentNode)b.remove();},1800);
}
document.getElementById('canvas').addEventListener('click',function(e){
  if(e.target.closest('#demoBtn')) return;
  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();
  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));
});

// ── NOTES ──
var count=0;
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function spawnNote(isim,mesaj,foto){
  var el=document.createElement('div');el.className='nc';
  var side=Math.random()>.5,left=side?54+Math.random()*26:4+Math.random()*20,top=10+Math.random()*62;
  var rot=(Math.random()-.5)*3.5;
  el.style.cssText='left:'+left+'%;top:'+top+'%;--r:'+rot+'deg;'+
    '--x1:'+((Math.random()-.5)*14)+'px;--y1:'+((Math.random()-.5)*12)+'px;'+
    '--x2:'+((Math.random()-.5)*12)+'px;--y2:'+((Math.random()-.5)*15)+'px;'+
    '--dd:'+(15+Math.random()*11).toFixed(1)+'s;';
  var fHtml=foto?'<img class="nc-foto" src="'+foto+'" alt=""/>':'';
  el.innerHTML=fHtml+'<div class="nc-name">'+esc(isim)+'</div><div class="nc-msg">'+esc(mesaj)+'</div><div class="nc-heart">♡</div>';
  document.getElementById('notes').appendChild(el);
  count++; document.getElementById('ct').textContent=count+' not';
  var t=document.createElement('div');t.className='toast';
  t.textContent=isim+' bir not bıraktı ♡';
  document.getElementById('canvas').appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},4200);
  var c=document.getElementById('canvas');bloom(c.offsetWidth*.7,c.offsetHeight*.44);
}

// ── DEMO ──
var demos=[
  {isim:'Ayşe Hanım',   mesaj:'Rena\'ya uzun ve sağlıklı bir ömür diliyorum 🌸'},
  {isim:'Mehmet Bey',   mesaj:'Hoş geldin dünyaya küçük prenses!'},
  {isim:'Zeynep & Can', mesaj:'Sen bizim en büyük sevincimizsin ♡'},
  {isim:'Selin',        mesaj:'Yüzün hep gülsün canım Rena'},
  {isim:'Büyükanne',    mesaj:'Torunum, gözümün nuru. Hoş geldin!'},
];
var di=0;
document.getElementById('demoBtn').addEventListener('click',function(e){
  e.stopPropagation();
  var n=demos[di%demos.length]; di++;
  spawnNote(n.isim,n.mesaj,null);
});

// Force all visible after 400ms
setTimeout(function(){
  var sel='.title-rena,.title-ozerden,.title-year,.r-top,.r-main,.r-sub,.r-line,.flower-wrap,.left-col,.qr-panel,.counter,.demo-btn,.div-v';
  document.querySelectorAll(sel).forEach(function(el){
    el.style.opacity='1';
    el.style.transform='translateY(0)';
  });
},400);

// WebSocket — auto reconnect
function connect(){
  var proto=location.protocol==='https:'?'wss:':'ws:';
  var ws=new WebSocket(proto+'//'+location.host);
  ws.onmessage=function(e){
    var msg=JSON.parse(e.data);
    if(msg.type==='init'){
      msg.dilekler.forEach(function(d){ spawnNote(d.isim,d.mesaj,d.foto); });
      count=msg.dilekler.length;
      document.getElementById('ct').textContent=count+' not';
    } else if(msg.type==='dilek'){
      spawnNote(msg.dilek.isim,msg.dilek.mesaj,msg.dilek.foto);
    }
  };
  ws.onclose=function(){ setTimeout(connect,3000); };
}
connect();
</script>
</body>
</html>`);
});

// ── MOBİL NOT SAYFASI ── //
app.get('/not', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Rena'ya Not Bırak ♡</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Lato:wght@100;200;300;400&family=Great+Vibes&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;min-height:100%;background:#FDE8EE;}
body{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:100vh;padding:28px 20px;
  background-color:#FDE8EE;
  background-image:
    repeating-linear-gradient(0deg,transparent,transparent 29px,rgba(220,150,170,.25) 29px,rgba(220,150,170,.25) 30px),
    repeating-linear-gradient(90deg,transparent,transparent 29px,rgba(220,150,170,.25) 29px,rgba(220,150,170,.25) 30px);
}
.card{
  width:100%;max-width:400px;
  background:linear-gradient(160deg,#FFF9F6 0%,#FFF0F3 100%);
  border:1.5px solid rgba(232,160,176,.35);
  padding:36px 28px 32px;text-align:center;
  box-shadow:0 8px 40px rgba(200,104,126,.1);
}
/* Bow top */
.bow{font-size:48px;margin-bottom:-8px;display:block;animation:bowBounce 4s ease-in-out infinite;}
@keyframes bowBounce{0%,100%{transform:rotate(-3deg);}50%{transform:rotate(3deg);}}
.logo{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:44px;color:#C8687E;letter-spacing:.1em;margin-bottom:2px;}
.logo-ya{font-family:'Great Vibes',cursive;font-size:22px;color:#D4849A;display:block;margin-bottom:4px;}
.sub{font-family:'Lato',sans-serif;font-weight:200;font-size:11px;letter-spacing:.3em;color:#D4849A;margin-bottom:28px;}
.rule{width:50px;height:1.5px;background:linear-gradient(to right,transparent,#E8A0B0,transparent);margin:0 auto 28px;}

label{display:block;text-align:left;font-family:'Lato',sans-serif;font-weight:300;font-size:12px;letter-spacing:.08em;color:#C8687E;margin-bottom:8px;}
input,textarea{
  width:100%;background:transparent;border:none;
  border-bottom:1.5px solid rgba(232,160,176,.4);
  font-family:'Cormorant Garamond',serif;font-weight:400;
  font-size:20px;color:#7A3040;
  padding:10px 4px;outline:none;
  transition:border-color .3s;margin-bottom:24px;
  resize:none;-webkit-appearance:none;border-radius:0;
}
input::placeholder,textarea::placeholder{color:rgba(200,104,126,.35);font-style:italic;font-size:18px;}
input:focus,textarea:focus{border-color:#E8A0B0;}
.btn{
  width:100%;padding:16px;
  background:linear-gradient(135deg,#E8A0B0,#C8687E);
  border:none;font-family:'Lato',sans-serif;font-weight:300;
  font-size:14px;letter-spacing:.12em;
  color:#fff;cursor:pointer;
  transition:all .3s;-webkit-appearance:none;border-radius:0;
}
.btn:active,.btn:hover{background:linear-gradient(135deg,#D4849A,#B85870);}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.err{font-family:'Lato',sans-serif;font-size:12px;color:#C87070;margin-top:-16px;margin-bottom:16px;display:none;text-align:left;}
.success{display:none;padding:16px 0;}
.s-icon{font-size:52px;margin-bottom:16px;animation:pop .6s cubic-bezier(.22,1,.36,1);}
@keyframes pop{0%{transform:scale(0);}100%{transform:scale(1);}}
.s-title{font-family:'Great Vibes',cursive;font-size:38px;color:#C8687E;margin-bottom:8px;}
.s-sub{font-family:'Lato',sans-serif;font-weight:200;font-size:12px;letter-spacing:.2em;color:#D4849A;}
.foto-area{
  width:100%; aspect-ratio:4/3;
  border:1.5px dashed rgba(232,160,176,.5);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; margin-bottom:24px; overflow:hidden;
  transition:border-color .3s; background:rgba(255,245,248,.5);
  position:relative;
}
.foto-area:active{ border-color:#E8A0B0; }
.foto-placeholder{ text-align:center; }
.foto-hint{
  font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;
  font-size:12px; font-weight:300; letter-spacing:.05em;
  color:rgba(200,104,126,.5); margin-top:6px;
}
.foto-preview{
  width:100%; height:100%; object-fit:cover;
  position:absolute; inset:0;
}
.again{margin-top:28px;background:transparent;border:1.5px solid rgba(232,160,176,.4);font-family:'Lato',sans-serif;font-weight:300;font-size:12px;letter-spacing:.08em;color:#C8687E;padding:12px 24px;cursor:pointer;-webkit-appearance:none;border-radius:0;}
</style>
</head>
<body>
<div class="card">
  <span class="bow">🎀</span>
  <div class="logo">RENA</div>
  <span class="logo-ya">'ya</span>
  <div class="sub">2026 · Hoş Geldin</div>
  <div class="rule"></div>

  <div id="form">
    <label>Adınız</label>
    <input type="text" id="isim" placeholder="Adınızı yazın…" maxlength="40" autocomplete="off" autocorrect="off">
    <label>Notunuz</label>
    <textarea id="mesaj" rows="3" placeholder="Rena'ya bir not bırakın…" maxlength="160"></textarea>

    <!-- Photo upload -->
    <label>Fotoğraf <span style="font-weight:200;color:rgba(200,104,126,.5);font-style:italic;">(isteğe bağlı)</span></label>
    <div class="foto-area" id="fotoArea" onclick="document.getElementById('fotoInput').click()">
      <div class="foto-placeholder" id="fotoPlaceholder">
        <span style="font-size:28px">📸</span>
        <div class="foto-hint">Fotoğraf seç veya çek</div>
      </div>
      <img id="fotoPreview" class="foto-preview" style="display:none" alt="Önizleme"/>
    </div>
    <input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none">

    <div class="err" id="err">Lütfen bir şeyler yazın.</div>
    <button class="btn" id="sendBtn">Ekrana Gönder ♡</button>
  </div>

  <div class="success" id="success">
    <div class="s-icon">🌸</div>
    <div class="s-title">Notun uçtu!</div>
    <div class="s-sub">TV ekranında süzülüyor</div>
    <button class="again" id="anotherBtn">Bir not daha bırak</button>
  </div>
</div>

<script>
// Photo preview
document.getElementById('fotoInput').addEventListener('change', function(){
  const file = this.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    const img = document.getElementById('fotoPreview');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('fotoPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

const btn=document.getElementById('sendBtn');
btn.addEventListener('click',async()=>{
  const isim  = document.getElementById('isim').value.trim();
  const mesaj = document.getElementById('mesaj').value.trim();
  const foto  = document.getElementById('fotoInput').files[0];
  if(!isim && !mesaj && !foto){document.getElementById('err').style.display='block';return;}
  document.getElementById('err').style.display='none';
  btn.disabled=true; btn.textContent='Gönderiliyor…';
  try{
    const fd = new FormData();
    if(isim)  fd.append('isim', isim);
    if(mesaj) fd.append('mesaj', mesaj);
    if(foto)  fd.append('foto', foto);
    const r = await fetch('/api/not',{ method:'POST', body:fd });
    if(r.ok){
      document.getElementById('form').style.display='none';
      document.getElementById('success').style.display='block';
    } else {
      btn.disabled=false; btn.textContent='Ekrana Gönder ♡';
    }
  } catch(e){
    btn.disabled=false; btn.textContent='Bağlantı hatası — tekrar dene';
  }
});
document.getElementById('anotherBtn').addEventListener('click',()=>{
  document.getElementById('isim').value='';
  document.getElementById('mesaj').value='';
  document.getElementById('fotoInput').value='';
  document.getElementById('fotoPreview').style.display='none';
  document.getElementById('fotoPlaceholder').style.display='block';
  document.getElementById('success').style.display='none';
  document.getElementById('form').style.display='block';
  btn.disabled=false; btn.textContent='Ekrana Gönder ♡';
  document.getElementById('isim').focus();
});
</script>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n✨  Rena - Canlı Not Sistemi\n');
  console.log('📺  TV  →  http://localhost:' + PORT);
  console.log('📱  Not →  ' + NOT_URL + '\n');
});
