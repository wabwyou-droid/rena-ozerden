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
  : process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://rena-ozerden.onrender.com';

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
    width: 280, margin: 2,
    color: { dark: '#9A7050', light: '#F9F4EE' }
  });
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
  position:absolute; top:-5vw;
  opacity:0;
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
  font-size:clamp(22px,3.8vw,62px);
  line-height:1.1; color:#7A5535;
  letter-spacing:.02em;
  opacity:0; animation:fadeUp 2.2s ease forwards 4.1s, mainGlow 14s ease-in-out infinite 10s;
  margin-bottom:.8vw;
  text-shadow:0 2px 30px rgba(160,110,70,.12);
  white-space:nowrap;
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
  position:absolute; bottom:2.5vw; right:3vw; z-index:10;
  display:flex; flex-direction:column; align-items:center; gap:.4vw;
  opacity:0; animation:fadeUp 2s ease forwards 6.5s;
}
.qr-top-deco {
  animation: footprintBounce 4s ease-in-out infinite;
}
@keyframes footprintBounce {
  0%,100% { transform:translateY(0); }
  50%     { transform:translateY(-2px); }
}
.qr-frame {
  background:#FFFBF6; padding:6px;
  border:1px solid rgba(200,168,136,.3);
  box-shadow:0 2px 12px rgba(160,120,80,.06);
}
.qr-frame svg { display:block; width:min(10vw,130px); height:min(10vw,130px); }
.qr-lbl {
  font-family:'Cormorant Garamond',Georgia,serif;
  font-style:italic; font-weight:300;
  font-size:clamp(8px,.8vw,12px); letter-spacing:.08em;
  color:rgba(168,118,96,.7); text-align:center; line-height:1.6;
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


#footprints { position:absolute; inset:0; z-index:3; pointer-events:none; overflow:hidden; }
.fp {
  position:absolute;
  font-size: clamp(14px, 1.8vw, 26px);
  opacity:0;
  animation: fpStep var(--dur) ease forwards var(--del);
  transform: rotate(var(--rot));
}
@keyframes fpStep {
  0%   { opacity:0;    transform:rotate(var(--rot)) scale(.6); }
  15%  { opacity:.75;  transform:rotate(var(--rot)) scale(1); }
  70%  { opacity:.65;  transform:rotate(var(--rot)) scale(1); }
  100% { opacity:0;    transform:rotate(var(--rot)) scale(.8); }
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
      
      <div class="r-main">Ho&#x15F; Geldin Rena</div>
    </div>

  </div>

  <!-- QR cute baby themed -->
  <div class="qr-panel">


    <!-- QR frame with bow on top -->
    <div style="position:relative;">
      <!-- Tiny bow -->
      <svg style="position:absolute;top:-1.4vw;left:50%;transform:translateX(-50%);width:min(4vw,48px);z-index:2;" viewBox="0 0 48 20" xmlns="http://www.w3.org/2000/svg">
        <path d="M24,12 Q14,4 6,6 Q2,8 4,12 Q6,16 14,14 Q20,12 24,12Z" fill="#E8B8C8" opacity=".85"/>
        <path d="M24,12 Q34,4 42,6 Q46,8 44,12 Q42,16 34,14 Q28,12 24,12Z" fill="#DDA8BC" opacity=".85"/>
        <ellipse cx="24" cy="12" rx="4" ry="3.5" fill="#C8889C"/>
        <ellipse cx="23" cy="11" rx="1.8" ry="1.4" fill="rgba(255,230,238,.5)"/>
      </svg>
      <div class="qr-frame">
        <svg viewBox="0 0 21 21" fill="#B89060" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="9" height="9" rx="1" fill="none" stroke="#B89060" stroke-width="1"/>
          <rect x="2" y="2" width="5" height="5" rx=".5"/>
          <rect x="12" y="0" width="9" height="9" rx="1" fill="none" stroke="#B89060" stroke-width="1"/>
          <rect x="14" y="2" width="5" height="5" rx=".5"/>
          <rect x="0" y="12" width="9" height="9" rx="1" fill="none" stroke="#B89060" stroke-width="1"/>
          <rect x="2" y="14" width="5" height="5" rx=".5"/>
          <rect x="12" y="12" width="2" height="2"/><rect x="15" y="12" width="2" height="2"/>
          <rect x="18" y="12" width="3" height="2"/><rect x="12" y="15" width="3" height="2"/>
          <rect x="16" y="15" width="2" height="2"/><rect x="12" y="18" width="2" height="3"/>
          <rect x="15" y="18" width="3" height="3"/><rect x="19" y="15" width="2" height="6"/>
        </svg>
      </div>
    </div>

    <!-- Bottom label -->
    <div class="qr-lbl">
      Rena'ya not bırak ♡
    </div>
  </div>

  <div class="counter">
    <div class="ldot"></div>
    <div class="ctxt" id="ct">0 not</div>
  </div>

</div>

<script>
// ── FALLING ITEMS: emzik + biberon + küçük çiçek ──
(function(){
  var s = document.getElementById('snow');

  // Pacifier SVG
  function pacifierSVG(size, op) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="'+size+'" height="'+size+'" style="display:block;">' +
      // Shield / guard
      '<ellipse cx="20" cy="22" rx="14" ry="10" fill="rgba(232,180,190,'+op+')" />' +
      '<ellipse cx="20" cy="22" rx="14" ry="10" fill="none" stroke="rgba(210,150,160,'+op+')" stroke-width="1"/>' +
      // Button holes
      '<circle cx="15" cy="22" r="2" fill="rgba(255,245,245,0.6)"/>' +
      '<circle cx="25" cy="22" r="2" fill="rgba(255,245,245,0.6)"/>' +
      // Nipple
      '<ellipse cx="20" cy="12" rx="4.5" ry="6" fill="rgba(220,160,150,'+op*1.1+')" />' +
      // Ring
      '<circle cx="20" cy="33" r="4" fill="none" stroke="rgba(210,150,160,'+op+')" stroke-width="1.8"/>' +
      '</svg>';
  }

  // Baby bottle SVG
  function bottleSVG(size, op) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 42" width="'+Math.round(size*.6)+'" height="'+size+'" style="display:block;">' +
      // Nipple tip
      '<ellipse cx="12" cy="4"  rx="3"   ry="3.5" fill="rgba(200,160,140,'+op+')" />' +
      // Collar
      '<rect x="8" y="6" width="8" height="4" rx="2" fill="rgba(220,175,165,'+op+')" />' +
      // Bottle body
      '<path d="M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z" fill="rgba(245,225,225,'+op*0.85+')" />' +
      '<path d="M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z" fill="none" stroke="rgba(210,170,165,'+op+')" stroke-width="1"/>' +
      // Milk level
      '<path d="M4,28 C4,28 8,26 12,27 C16,28 20,26 20,26 L20,34 C20,37 17,38 12,38 C7,38 4,37 4,34 Z" fill="rgba(255,240,240,'+op*0.7+')" />' +
      // Measurement lines
      '<line x1="5" y1="20" x2="8"  y2="20" stroke="rgba(200,160,155,'+op*0.5+')" stroke-width=".7"/>' +
      '<line x1="5" y1="24" x2="8"  y2="24" stroke="rgba(200,160,155,'+op*0.5+')" stroke-width=".7"/>' +
      '<line x1="5" y1="28" x2="8"  y2="28" stroke="rgba(200,160,155,'+op*0.5+')" stroke-width=".7"/>' +
      '</svg>';
  }

  // Small flower (kept for variety)
  function flowerSVG(size, op) {
    var c = 'rgba(210,175,165,'+op+')';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="'+size+'" height="'+size+'" style="display:block;">' +
      '<ellipse cx="10" cy="4"  rx="3" ry="4.5" fill="'+c+'" transform="rotate(0,10,10)"/>' +
      '<ellipse cx="10" cy="4"  rx="3" ry="4.5" fill="'+c+'" transform="rotate(60,10,10)"/>' +
      '<ellipse cx="10" cy="4"  rx="3" ry="4.5" fill="'+c+'" transform="rotate(120,10,10)"/>' +
      '<ellipse cx="10" cy="4"  rx="3" ry="4.5" fill="'+c+'" transform="rotate(180,10,10)"/>' +
      '<ellipse cx="10" cy="4"  rx="3" ry="4.5" fill="'+c+'" transform="rotate(240,10,10)"/>' +
      '<ellipse cx="10" cy="4"  rx="3" ry="4.5" fill="'+c+'" transform="rotate(300,10,10)"/>' +
      '<circle cx="10" cy="10" r="3.5" fill="rgba(245,225,215,'+op+')" />' +
      '</svg>';
  }

  var types = ['pacifier','bottle','flower','pacifier','bottle','flower','pacifier'];

  for (var i = 0; i < 26; i++) {
    var el  = document.createElement('div');
    el.className = 'sp';
    var type = types[i % types.length];
    var sz   = 9 + Math.random() * 7;
    var op   = (0.25 + Math.random() * 0.3).toFixed(2);
    var dur  = 11 + Math.random() * 14;
    var del  = -(Math.random() * 20);
    var spin = (Math.random() - .5) * 280;
    var sway = (Math.random() - .5) * 6;

    var inner = type === 'pacifier' ? pacifierSVG(sz, op) :
                type === 'bottle'   ? bottleSVG(sz, op)   : flowerSVG(sz, op);

    el.innerHTML = inner;
    el.style.cssText =
      'left:' + (Math.random() * 105 - 2) + '%;' +
      '--dur:' + dur + 's;' +
      '--del:' + del + 's;' +
      '--op:1;' +
      '--spin:' + spin + 'deg;' +
      '--sway:' + sway + 'vw;';
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
  {isim:'Ayşe Hanım',   mesaj:'Rena\\'ya uzun ve sağlıklı bir ömür diliyorum 🌸'},
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

<!-- FOOTPRINT OVERLAY - fixed, outside canvas -->
<div id="fp-overlay" style="position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;"></div>

<script>
(function() {
  function foot(flip) {
    var s = document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('viewBox','0 0 32 36');
    s.setAttribute('width','12');
    s.setAttribute('height','13');
    var ns = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(ns,'g');
    if(flip) g.setAttribute('transform','scale(-1,1) translate(-32,0)');

    // Palm — chubby baby palm shape
    var palm = document.createElementNS(ns,'path');
    palm.setAttribute('d',
      'M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 ' +
      'C6,13 7,12 9,12 C11,12 13,12 15,13 ' +
      'C17,12 19,12 21,13 C23,12 25,13 26,15 ' +
      'C27,17 28,19 28,23 C29,27 28,31 25,32 Z'
    );
    palm.setAttribute('fill','#C8A090');
    palm.setAttribute('opacity','0.42');
    g.appendChild(palm);

    // Palm crease line
    var crease = document.createElementNS(ns,'path');
    crease.setAttribute('d','M5,22 C10,20 18,20 27,22');
    crease.setAttribute('stroke','#B08070');
    crease.setAttribute('stroke-width','0.7');
    crease.setAttribute('fill','none');
    crease.setAttribute('opacity','0.18');
    g.appendChild(crease);

    // Fingers — 4 chubby baby fingers (thumb hidden when crawling)
    var fingers = [
      {cx:7,  cy:8,  rx:2.8, ry:3.2},
      {cx:12, cy:6,  rx:2.6, ry:3.4},
      {cx:18, cy:6,  rx:2.6, ry:3.4},
      {cx:23, cy:7.5,rx:2.4, ry:3.1},
    ];
    fingers.forEach(function(f) {
      // Finger body
      var e = document.createElementNS(ns,'ellipse');
      e.setAttribute('cx', f.cx); e.setAttribute('cy', f.cy);
      e.setAttribute('rx', f.rx); e.setAttribute('ry', f.ry);
      e.setAttribute('fill','#C8A090');
      e.setAttribute('opacity','0.40');
      g.appendChild(e);
      // Knuckle crease
      var k = document.createElementNS(ns,'path');
      k.setAttribute('d','M'+(f.cx-f.rx*.6)+','+(f.cy+f.ry*.2)+' Q'+f.cx+','+(f.cy+f.ry*.4)+' '+(f.cx+f.rx*.6)+','+(f.cy+f.ry*.2));
      k.setAttribute('stroke','#B08070');
      k.setAttribute('stroke-width','0.5');
      k.setAttribute('fill','none');
      k.setAttribute('opacity','0.2');
      g.appendChild(k);
      // Tiny nail
      var n = document.createElementNS(ns,'ellipse');
      n.setAttribute('cx', f.cx); n.setAttribute('cy', f.cy - f.ry*0.55);
      n.setAttribute('rx', f.rx*0.6); n.setAttribute('ry', f.ry*0.28);
      n.setAttribute('fill','rgba(255,240,235,0.4)');
      g.appendChild(n);
    });

    // Thumb — peeking from side
    var thumb = document.createElementNS(ns,'ellipse');
    thumb.setAttribute('cx','3'); thumb.setAttribute('cy','18');
    thumb.setAttribute('rx','2.2'); thumb.setAttribute('ry','3.5');
    thumb.setAttribute('fill','#C8A090');
    thumb.setAttribute('opacity','0.35');
    thumb.setAttribute('transform','rotate(-25,3,18)');
    g.appendChild(thumb);

    s.appendChild(g);
    return s;
  }

  function walk() {
    var ov = document.getElementById('fp-overlay');
    var W  = window.innerWidth;
    var H  = window.innerHeight;

    // Start position and direction
    var sx  = 0.08 + Math.random() * 0.78;
    var sy  = 0.12 + Math.random() * 0.68;
    var ang = (-15 + Math.random() * 30) * Math.PI / 180;
    var stride = 0.05 + Math.random() * 0.02;

    for (var i = 0; i < 5; i++) {
      (function(idx) {
        var right = idx % 2 === 0;
        var perp  = ang + Math.PI / 2;
        var lat   = right ? 0.022 : -0.022;
        var px    = (sx + Math.cos(ang) * stride * idx + Math.cos(perp) * lat) * W;
        var py    = (sy + Math.sin(ang) * stride * idx + Math.sin(perp) * lat) * H;
        var rot   = (ang * 180 / Math.PI) + (right ? 8 : -8);

        setTimeout(function() {
          var wrap = document.createElement('div');
          wrap.style.cssText =
            'position:absolute;' +
            'left:' + px + 'px;' +
            'top:'  + py + 'px;' +
            'transform:rotate(' + rot + 'deg);' +
            'opacity:0;' +
            'transition:opacity 0.5s ease;';
          wrap.appendChild(foot(!right));
          ov.appendChild(wrap);

          requestAnimationFrame(function(){ requestAnimationFrame(function(){
            wrap.style.opacity = '0.65';
          }); });

          setTimeout(function(){
            wrap.style.transition = 'opacity 1.8s ease';
            wrap.style.opacity = '0';
            setTimeout(function(){ if(wrap.parentNode) wrap.remove(); }, 1900);
          }, 3500);

        }, idx * 400);
      })(i);
    }
  }

  setTimeout(function(){
    walk();
    setInterval(walk, 5000 + Math.random() * 3000);
  }, 1500);
})();
</script>
<script>
(function() {
  function foot(flip) {
    var s = document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('viewBox','0 0 32 36');
    s.setAttribute('width','12');
    s.setAttribute('height','13');
    var ns = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(ns,'g');
    if(flip) g.setAttribute('transform','scale(-1,1) translate(-32,0)');

    // Palm — chubby baby palm shape
    var palm = document.createElementNS(ns,'path');
    palm.setAttribute('d',
      'M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 ' +
      'C6,13 7,12 9,12 C11,12 13,12 15,13 ' +
      'C17,12 19,12 21,13 C23,12 25,13 26,15 ' +
      'C27,17 28,19 28,23 C29,27 28,31 25,32 Z'
    );
    palm.setAttribute('fill','#C8A090');
    palm.setAttribute('opacity','0.42');
    g.appendChild(palm);

    // Palm crease line
    var crease = document.createElementNS(ns,'path');
    crease.setAttribute('d','M5,22 C10,20 18,20 27,22');
    crease.setAttribute('stroke','#B08070');
    crease.setAttribute('stroke-width','0.7');
    crease.setAttribute('fill','none');
    crease.setAttribute('opacity','0.18');
    g.appendChild(crease);

    // Fingers — 4 chubby baby fingers (thumb hidden when crawling)
    var fingers = [
      {cx:7,  cy:8,  rx:2.8, ry:3.2},
      {cx:12, cy:6,  rx:2.6, ry:3.4},
      {cx:18, cy:6,  rx:2.6, ry:3.4},
      {cx:23, cy:7.5,rx:2.4, ry:3.1},
    ];
    fingers.forEach(function(f) {
      // Finger body
      var e = document.createElementNS(ns,'ellipse');
      e.setAttribute('cx', f.cx); e.setAttribute('cy', f.cy);
      e.setAttribute('rx', f.rx); e.setAttribute('ry', f.ry);
      e.setAttribute('fill','#C8A090');
      e.setAttribute('opacity','0.40');
      g.appendChild(e);
      // Knuckle crease
      var k = document.createElementNS(ns,'path');
      k.setAttribute('d','M'+(f.cx-f.rx*.6)+','+(f.cy+f.ry*.2)+' Q'+f.cx+','+(f.cy+f.ry*.4)+' '+(f.cx+f.rx*.6)+','+(f.cy+f.ry*.2));
      k.setAttribute('stroke','#B08070');
      k.setAttribute('stroke-width','0.5');
      k.setAttribute('fill','none');
      k.setAttribute('opacity','0.2');
      g.appendChild(k);
      // Tiny nail
      var n = document.createElementNS(ns,'ellipse');
      n.setAttribute('cx', f.cx); n.setAttribute('cy', f.cy - f.ry*0.55);
      n.setAttribute('rx', f.rx*0.6); n.setAttribute('ry', f.ry*0.28);
      n.setAttribute('fill','rgba(255,240,235,0.4)');
      g.appendChild(n);
    });

    // Thumb — peeking from side
    var thumb = document.createElementNS(ns,'ellipse');
    thumb.setAttribute('cx','3'); thumb.setAttribute('cy','18');
    thumb.setAttribute('rx','2.2'); thumb.setAttribute('ry','3.5');
    thumb.setAttribute('fill','#C8A090');
    thumb.setAttribute('opacity','0.35');
    thumb.setAttribute('transform','rotate(-25,3,18)');
    g.appendChild(thumb);

    s.appendChild(g);
    return s;
  }

  function walk() {
    var ov = document.getElementById('fp-overlay');
    var W  = window.innerWidth;
    var H  = window.innerHeight;

    // Start position and direction
    var sx  = 0.08 + Math.random() * 0.78;
    var sy  = 0.12 + Math.random() * 0.68;
    var ang = (-15 + Math.random() * 30) * Math.PI / 180;
    var stride = 0.05 + Math.random() * 0.02;

    for (var i = 0; i < 5; i++) {
      (function(idx) {
        var right = idx % 2 === 0;
        var perp  = ang + Math.PI / 2;
        var lat   = right ? 0.022 : -0.022;
        var px    = (sx + Math.cos(ang) * stride * idx + Math.cos(perp) * lat) * W;
        var py    = (sy + Math.sin(ang) * stride * idx + Math.sin(perp) * lat) * H;
        var rot   = (ang * 180 / Math.PI) + (right ? 8 : -8);

        setTimeout(function() {
          var wrap = document.createElement('div');
          wrap.style.cssText =
            'position:absolute;' +
            'left:' + px + 'px;' +
            'top:'  + py + 'px;' +
            'transform:rotate(' + rot + 'deg);' +
            'opacity:0;' +
            'transition:opacity 0.5s ease;';
          wrap.appendChild(foot(!right));
          ov.appendChild(wrap);

          requestAnimationFrame(function(){ requestAnimationFrame(function(){
            wrap.style.opacity = '0.65';
          }); });

          setTimeout(function(){
            wrap.style.transition = 'opacity 1.8s ease';
            wrap.style.opacity = '0';
            setTimeout(function(){ if(wrap.parentNode) wrap.remove(); }, 1900);
          }, 3500);

        }, idx * 400);
      })(i);
    }
  }

  setTimeout(function(){
    walk();
    setInterval(walk, 5000 + Math.random() * 3000);
  }, 1500);
})();

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

// ── MOBİL NOT SAYFASI ──
app.get('/not', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<meta name="color-scheme" content="light only">
<title>Rena'ya Not Bırak</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Lato:wght@200;300;400&display=swap');
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
html, body {
  width:100%; min-height:100%;
  background:#F9F4EE;
  color-scheme: light only;
}
body {
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  min-height:100vh; padding:32px 20px;
  font-family:'Cormorant Garamond', Georgia, serif;
}
.card {
  width:100%; max-width:400px;
  background:linear-gradient(160deg,#FFFBF6 0%,#FFF6EE 100%);
  border:1px solid rgba(200,168,136,.25);
  padding:38px 28px 34px;
  text-align:center;
  box-shadow:0 8px 40px rgba(160,120,80,.08);
}
.logo {
  font-family:'Cormorant Garamond', Georgia, serif;
  font-style:italic; font-weight:300;
  font-size:46px; color:#7A5535;
  letter-spacing:.14em; margin-bottom:2px;
  display:block;
}
.logo-sub {
  font-family:'Cormorant Garamond', Georgia, serif;
  font-style:italic; font-weight:300;
  font-size:18px; color:#9A7050;
  letter-spacing:.18em; margin-bottom:6px;
  display:block;
}
.year {
  font-family:'Lato', sans-serif; font-weight:200;
  font-size:11px; letter-spacing:.5em;
  color:#B89878; margin-bottom:28px; display:block;
}
.rule {
  width:50px; height:1px;
  background:linear-gradient(to right,transparent,#C8A878,transparent);
  margin:0 auto 28px;
}
label {
  display:block; text-align:left;
  font-family:'Lato', sans-serif; font-weight:300;
  font-size:13px; letter-spacing:.08em;
  color:#8A6040; margin-bottom:8px;
}
input, textarea {
  display:block; width:100%;
  background:transparent; border:none;
  border-bottom:1.5px solid rgba(200,168,136,.4);
  font-family:'Cormorant Garamond', Georgia, serif;
  font-weight:400; font-size:20px; color:#5A3820;
  padding:10px 4px; outline:none;
  transition:border-color .3s;
  margin-bottom:24px; resize:none;
  -webkit-appearance:none; border-radius:0;
}
input::placeholder, textarea::placeholder {
  color:rgba(160,120,80,.35);
  font-style:italic; font-size:18px;
}
input:focus, textarea:focus { border-color:#C8A878; }

.foto-area {
  width:100%; aspect-ratio:4/3;
  border:1.5px dashed rgba(200,168,136,.4);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; margin-bottom:24px; overflow:hidden;
  background:rgba(255,250,244,.6); position:relative;
  border-radius:2px;
}
.foto-hint {
  font-family:'Lato', sans-serif; font-weight:200;
  font-size:12px; letter-spacing:.06em;
  color:rgba(160,120,80,.5); margin-top:8px;
  text-align:center;
}
.foto-icon { font-size:28px; }
.foto-preview {
  width:100%; height:100%; object-fit:cover;
  position:absolute; inset:0; display:none;
}

.btn {
  display:block; width:100%; padding:16px;
  background:linear-gradient(135deg,#D4A878,#A87850);
  border:none;
  font-family:'Lato', sans-serif; font-weight:300;
  font-size:14px; letter-spacing:.15em;
  color:#fff; cursor:pointer;
  transition:opacity .3s;
  -webkit-appearance:none; border-radius:0;
}
.btn:active { opacity:.85; }
.btn:disabled { opacity:.5; }

.err {
  font-family:'Lato', sans-serif; font-size:12px;
  color:#C07060; margin-top:-16px; margin-bottom:16px;
  display:none; text-align:left; letter-spacing:.03em;
}

.success { display:none; padding:16px 0; }
.s-icon { font-size:52px; margin-bottom:16px; display:block; animation:pop .6s cubic-bezier(.22,1,.36,1); }
@keyframes pop { 0%{transform:scale(0);}100%{transform:scale(1);} }
.s-title {
  font-family:'Cormorant Garamond', Georgia, serif;
  font-style:italic; font-weight:300;
  font-size:34px; color:#7A5535; margin-bottom:8px;
  letter-spacing:.05em;
}
.s-sub {
  font-family:'Lato', sans-serif; font-weight:200;
  font-size:12px; letter-spacing:.25em; color:#B89878;
}
.again {
  margin-top:26px; background:transparent;
  border:1px solid rgba(200,168,136,.35);
  font-family:'Lato', sans-serif; font-weight:300;
  font-size:13px; letter-spacing:.08em;
  color:#9A7050; padding:12px 24px; cursor:pointer;
  -webkit-appearance:none; border-radius:0;
}
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

    <label>Fotoğraf <span style="font-weight:200;color:rgba(160,120,80,.4);font-style:italic;">(isteğe bağlı)</span></label>
    <div class="foto-area" id="fotoArea" onclick="document.getElementById('fotoInput').click()">
      <div id="fotoPlaceholder" style="text-align:center;">
        <div class="foto-icon">📸</div>
        <div class="foto-hint">Fotoğraf seç veya çek</div>
      </div>
      <img id="fotoPreview" class="foto-preview" alt=""/>
    </div>
    <input type="file" id="fotoInput" accept="image/*" capture="environment" style="display:none">

    <div class="err" id="err">Lütfen bir şeyler yazın.</div>
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
document.getElementById('fotoInput').addEventListener('change', function(){
  var file = this.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    document.getElementById('fotoPreview').src = e.target.result;
    document.getElementById('fotoPreview').style.display = 'block';
    document.getElementById('fotoPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

var btn = document.getElementById('sendBtn');
btn.addEventListener('click', async function(){
  var isim  = document.getElementById('isim').value.trim();
  var mesaj = document.getElementById('mesaj').value.trim();
  var foto  = document.getElementById('fotoInput').files[0];
  if(!isim && !mesaj && !foto){ document.getElementById('err').style.display='block'; return; }
  document.getElementById('err').style.display = 'none';
  btn.disabled = true; btn.textContent = 'Gönderiliyor…';
  try {
    var fd = new FormData();
    if(isim)  fd.append('isim', isim);
    if(mesaj) fd.append('mesaj', mesaj);
    if(foto)  fd.append('foto', foto);
    var r = await fetch('/api/not', { method:'POST', body:fd });
    if(r.ok){
      document.getElementById('form').style.display    = 'none';
      document.getElementById('success').style.display = 'block';
    } else {
      btn.disabled = false; btn.textContent = 'Ekrana Gönder ♡';
    }
  } catch(e){
    btn.disabled = false; btn.textContent = 'Bağlantı hatası — tekrar dene';
  }
});

document.getElementById('anotherBtn').addEventListener('click', function(){
  document.getElementById('isim').value  = '';
  document.getElementById('mesaj').value = '';
  document.getElementById('fotoInput').value = '';
  document.getElementById('fotoPreview').style.display = 'none';
  document.getElementById('fotoPlaceholder').style.display = 'block';
  document.getElementById('success').style.display = 'none';
  document.getElementById('form').style.display    = 'block';
  btn.disabled = false; btn.textContent = 'Ekrana Gönder ♡';
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
