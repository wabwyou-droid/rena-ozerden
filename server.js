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


  13% {opacity:0.8;transform:scale(1);}
  85% {opacity:0.8;transform:scale(1);}
  96% {opacity:0;transform:scale(0.2);}
  100%{opacity:0;transform:scale(0);}
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
/* ── DALİ ÇİÇEK ANİMASYONU ── */
/* Stem — sinüs gibi büyür */
#dStem{transform-origin:50% 100%;animation:dStemRise 26s cubic-bezier(.4,0,.1,1) infinite;}
@keyframes dStemRise{0%,2%{opacity:0;transform:scaleY(0);}10%{opacity:1;transform:scaleY(1);}80%{opacity:1;}94%{opacity:0;transform:scaleY(.1);}100%{opacity:0;transform:scaleY(0);}}
/* Sol yaprak — tabandan büyür, damlalar gecikmeli */
#dLeafL{transform-origin:100% 50%;animation:dLeafGrow 26s ease-in-out infinite 1.2s;opacity:0;}
@keyframes dLeafGrow{0%,2%{opacity:0;transform:scaleX(0);}9%{opacity:1;transform:scaleX(1);}80%{opacity:1;}94%{opacity:0;}100%{opacity:0;transform:scaleX(0);}}
/* Yüzen serbest taç — sallanarak gelir */
#dFloatPetal{animation:dFloat 26s ease-in-out infinite 2s;opacity:0;}
@keyframes dFloat{
  0%,3%{opacity:0;transform:translate(0,20px) rotate(-15deg);}
  10%{opacity:.75;transform:translate(0,0) rotate(0deg);}
  40%{transform:translate(3px,-4px) rotate(2deg);}
  60%{transform:translate(-3px,2px) rotate(-2deg);}
  80%{opacity:.75;transform:translate(0,0) rotate(0deg);}
  94%{opacity:0;transform:translate(10px,-15px) rotate(20deg);}
  100%{opacity:0;}
}
/* Ana çiçek — her taç kökünden büyür */
#dp_1{transform-origin:0% 100%;animation:dPetal 26s cubic-bezier(.3,0,.1,1) infinite 3.2s;opacity:0;}
#dp_2{transform-origin:0% 50%;animation:dPetal 26s cubic-bezier(.3,0,.1,1) infinite 3.7s;opacity:0;}
#dp_3{transform-origin:50% 0%;animation:dPetal 26s cubic-bezier(.3,0,.1,1) infinite 4.2s;opacity:0;}
#dp_4{transform-origin:100% 50%;animation:dPetal 26s cubic-bezier(.3,0,.1,1) infinite 4.7s;opacity:0;}
#dp_5{transform-origin:100% 100%;animation:dPetal 26s cubic-bezier(.3,0,.1,1) infinite 5.2s;opacity:0;}
@keyframes dPetal{
  0%,1%{opacity:0;transform:scale(0) rotate(-20deg);}
  7%{opacity:1;transform:scale(1.1) rotate(3deg);}
  11%{opacity:1;transform:scale(.97) rotate(-1deg);}
  14%{opacity:1;transform:scale(1) rotate(0deg);}
  55%{transform:scale(1) rotate(0deg);}
  59%{transform:scale(1.05) rotate(2deg);}
  63%{transform:scale(.98) rotate(0deg);}
  80%{opacity:1;}93%{opacity:0;transform:scale(.1) rotate(15deg);}100%{opacity:0;}
}
/* Damla animasyonları — yer çekimine karşı aşağı akar */
#drip1,#drip2,#drip3{opacity:0;animation:dDrip 26s ease-in-out infinite;}
#drip1{animation-delay:5.5s;}#drip2{animation-delay:5.8s;}#drip3{animation-delay:6.1s;}
@keyframes dDrip{
  0%,10%{opacity:0;transform:scaleY(0);transform-origin:50% 0%;}
  16%{opacity:.7;transform:scaleY(1);}
  70%{opacity:.6;}80%{opacity:0;}100%{opacity:0;}
}
/* İç taçlar */
#dip1,#dip2,#dip3,#dip4,#dip5{opacity:0;}
#dip1{animation:dInner 26s ease infinite 6.0s;}
#dip2{animation:dInner 26s ease infinite 6.3s;}
#dip3{animation:dInner 26s ease infinite 6.6s;}
#dip4{animation:dInner 26s ease infinite 6.9s;}
#dip5{animation:dInner 26s ease infinite 7.2s;}
@keyframes dInner{
  0%,1%{opacity:0;transform:scale(0);}6%{opacity:.9;transform:scale(1.08);}10%{opacity:.9;transform:scale(1);}
  60%{transform:scale(1);}64%{transform:scale(1.06);}68%{transform:scale(1);}
  80%{opacity:.9;}93%{opacity:0;transform:scale(0);}100%{opacity:0;}
}
/* Merkez — "göz" açılır son */
#daliFlower ellipse:nth-of-type(1){animation:dCenter 26s ease-in-out infinite 7.8s;opacity:0;}
@keyframes dCenter{
  0%,1%{opacity:0;transform:scale(0) rotate(-12deg);}
  6%{opacity:1;transform:scale(1.2) rotate(-12deg);}
  10%{opacity:1;transform:scale(.96) rotate(-12deg);}
  13%{opacity:1;transform:scale(1) rotate(-12deg);}
  /* Göz kırpar */
  50%{transform:scale(1) rotate(-12deg);}
  53%{transform:scaleY(.1) rotate(-12deg);}
  56%{transform:scale(1) rotate(-12deg);}
  80%{opacity:1;}93%{opacity:0;transform:scale(0);}100%{opacity:0;}
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
        <svg id="daliFlower" viewBox="0 0 280 340" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;overflow:visible;">
          <defs>
            <radialGradient id="dp1" cx="30%" cy="15%" r="75%">
              <stop offset="0%" stop-color="#FEE8F4"/>
              <stop offset="40%" stop-color="#F0A0CC"/>
              <stop offset="100%" stop-color="#C0558A"/>
            </radialGradient>
            <radialGradient id="dp2" cx="70%" cy="15%" r="75%">
              <stop offset="0%" stop-color="#FDF0F8"/>
              <stop offset="40%" stop-color="#E890C0"/>
              <stop offset="100%" stop-color="#AA4578"/>
            </radialGradient>
            <radialGradient id="dp3" cx="50%" cy="10%" r="70%">
              <stop offset="0%" stop-color="#FFF4FA"/>
              <stop offset="50%" stop-color="#F8C0DC"/>
              <stop offset="100%" stop-color="#D870A8"/>
            </radialGradient>
            <radialGradient id="dcg" cx="40%" cy="30%" r="65%">
              <stop offset="0%" stop-color="#FFFBE8"/>
              <stop offset="50%" stop-color="#F5D890"/>
              <stop offset="100%" stop-color="#C89040"/>
            </radialGradient>
            <radialGradient id="dlg" cx="30%" cy="25%" r="70%">
              <stop offset="0%" stop-color="#D8EAB0"/>
              <stop offset="100%" stop-color="#6A9838"/>
            </radialGradient>
            <filter id="dMelt">
              <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" result="noise" seed="2"/>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G"/>
            </filter>
            <filter id="dGlow">
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="dDrop">
              <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="rgba(160,60,100,.2)"/>
            </filter>
          </defs>

          <!-- SURREAL STEM — impossibly thin, curves against gravity -->
          <g id="dStem">
            <path d="M140,318 C142,290 130,265 145,240 C158,217 132,200 148,178 C162,158 138,148 140,130"
              stroke="#7AAA40" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <!-- Shadow of stem that goes the wrong way -->
            <path d="M143,318 C150,295 138,270 150,248 C160,228 140,210 152,192"
              stroke="rgba(160,100,160,.15)" stroke-width="2" fill="none" stroke-linecap="round"/>
          </g>

          <!-- LEAF — melting downward, Dali style -->
          <g id="dLeafL">
            <path d="M142,248 C118,244 98,248 84,240
                     C70,232 66,218 74,208
                     C82,198 96,200 108,210
                     C118,218 120,232 128,240
                     C134,246 140,246 142,248Z"
              fill="url(#dlg)" filter="url(#dDrop)"/>
            <!-- Dripping tip -->
            <path d="M74,210 Q68,225 66,238 Q68,240 72,234 Q74,224 76,215Z"
              fill="#88B848" opacity=".6"/>
            <path d="M84,240 Q76,255 74,268 Q77,270 80,262 Q82,252 86,244Z"
              fill="#7AAA40" opacity=".5"/>
            <!-- Leaf vein -->
            <path d="M142,248 C125,238 105,228 88,220" stroke="rgba(255,255,255,.4)" stroke-width="1" fill="none"/>
          </g>

          <!-- FLOATING DETACHED PETAL — Dali signature -->
          <g id="dFloatPetal">
            <path d="M218,185 C228,170 232,150 224,138
                     C216,126 204,128 198,140
                     C192,152 196,170 206,180
                     C210,184 215,186 218,185Z"
              fill="url(#dp2)" opacity=".75" filter="url(#dMelt)"/>
            <!-- Shadow below floating petal — impossible -->
            <path d="M205,192 C210,196 218,196 222,192"
              stroke="rgba(180,80,120,.2)" stroke-width="2" fill="none"/>
          </g>

          <!-- MAIN FLOWER — surreal proportions, melting at tips -->
          <g id="dFlower" transform="translate(140,118)">

            <!-- PETAL 1 — elongated impossibly, melting tip drips -->
            <path id="dp_1" d="M0,0
              C-6,-12 -10,-35 -8,-60
              C-6,-82 2,-95 10,-90
              C18,-84 16,-65 10,-42
              C6,-22 2,-8 0,0Z"
              fill="url(#dp1)" filter="url(#dDrop)"/>
            <!-- Drip from tip -->
            <path id="drip1" d="M2,-90 C3,-96 4,-106 3,-118 Q2,-122 1,-118 Q2,-108 1,-96 Q0,-90 2,-90Z"
              fill="url(#dp1)" opacity=".7"/>

            <!-- PETAL 2 — wider, baroque -->
            <path id="dp_2" d="M0,0
              C10,-4 32,-8 52,2
              C70,12 74,28 62,36
              C50,44 28,30 10,14
              C4,8 1,3 0,0Z"
              fill="url(#dp2)" filter="url(#dDrop)"/>
            <path id="drip2" d="M62,36 C70,44 80,56 78,68 Q76,72 74,68 Q72,58 64,46 Q62,40 62,36Z"
              fill="url(#dp2)" opacity=".65"/>

            <!-- PETAL 3 — drooping low, gravity-defying -->
            <path id="dp_3" d="M0,0
              C4,10 8,32 4,56
              C0,78 -12,86 -20,76
              C-28,66 -22,44 -12,22
              C-8,12 -3,4 0,0Z"
              fill="url(#dp3)" filter="url(#dDrop)"/>
            <path id="drip3" d="M-20,76 C-24,86 -26,100 -22,112 Q-20,116 -18,112 Q-18,100 -16,88 Q-18,80 -20,76Z"
              fill="url(#dp3)" opacity=".6"/>

            <!-- PETAL 4 — stretches left, gossamer thin at base -->
            <path id="dp_4" d="M0,0
              C-4,4 -22,10 -44,6
              C-64,2 -72,-10 -62,-20
              C-52,-30 -32,-20 -14,-10
              C-6,-6 -2,-2 0,0Z"
              fill="url(#dp1)" filter="url(#dDrop)" opacity=".88"/>

            <!-- PETAL 5 — tilted, asymmetric Dali twist -->
            <path id="dp_5" d="M0,0
              C-8,-6 -24,-22 -28,-48
              C-32,-70 -22,-84 -10,-80
              C2,-76 4,-55 2,-28
              C2,-16 1,-6 0,0Z"
              fill="url(#dp2)" filter="url(#dDrop)" opacity=".86"/>

            <!-- INNER ring — short, club-shaped -->
            <path id="dip1" d="M0,0 C-2,-6 -4,-18 0,-28 C4,-36 10,-36 12,-28 C14,-20 8,-8 0,0Z" fill="url(#dp3)" opacity=".9"/>
            <path id="dip2" d="M0,0 C6,-2 16,-2 22,4 C28,10 26,18 18,20 C10,22 4,12 0,0Z" fill="url(#dp1)" opacity=".9"/>
            <path id="dip3" d="M0,0 C2,6 2,16 -4,22 C-10,28 -18,26 -20,18 C-22,10 -14,2 0,0Z" fill="url(#dp2)" opacity=".88"/>
            <path id="dip4" d="M0,0 C-6,2 -16,0 -20,-6 C-24,-12 -20,-20 -12,-20 C-6,-20 -2,-10 0,0Z" fill="url(#dp3)" opacity=".88"/>
            <path id="dip5" d="M0,0 C-2,-6 -2,-16 4,-20 C10,-24 18,-20 18,-12 C18,-4 8,0 0,0Z" fill="url(#dp1)" opacity=".86"/>

            <!-- CENTER — egg-shaped, off-center, Dali surreal -->
            <ellipse cx="2" cy="-2" rx="16" ry="20" fill="url(#dcg)" filter="url(#dGlow)" transform="rotate(-12,2,-2)"/>
            <ellipse cx="0" cy="-3" rx="10" ry="13" fill="#F8E898" opacity=".88" transform="rotate(-12,0,-3)"/>
            <!-- Surreal eye in center -->
            <ellipse cx="2" cy="-2" rx="5" ry="6" fill="#E8D060" transform="rotate(-12,2,-2)"/>
            <ellipse cx="2" cy="-2" rx="3" ry="3.5" fill="#5A3020" opacity=".8" transform="rotate(-12,2,-2)"/>
            <circle cx="1" cy="-3" r="1.2" fill="rgba(255,255,255,.7)"/>
            <!-- Stamens — extra long, swaying -->
            <g stroke="#D09030" stroke-width="1.2" stroke-linecap="round" opacity=".85">
              <path d="M0,-14 C2,-18 1,-24 0,-28"/><circle cx="0" cy="-29" r="2.5" fill="#E8B040"/>
              <path d="M10,-8 C14,-12 18,-16 20,-20"/><circle cx="21" cy="-21" r="2" fill="#E8B040"/>
              <path d="M12,4 C16,6 20,10 22,14"/><circle cx="23" cy="15" r="2" fill="#DCA040"/>
              <path d="M4,12 C4,16 3,22 2,26"/><circle cx="2" cy="27" r="2" fill="#E8B040"/>
              <path d="M-8,10 C-12,12 -16,16 -18,20"/><circle cx="-19" cy="21" r="2" fill="#DCA040"/>
              <path d="M-12,0 C-16,-2 -20,-4 -24,-6"/><circle cx="-25" cy="-7" r="2" fill="#E8B040"/>
              <path d="M-10,-10 C-14,-14 -16,-20 -16,-26"/><circle cx="-16" cy="-27" r="1.8" fill="#DCA040"/>
            </g>
          </g>
        </svg>
      </div>

      <div class="qr-block">      <div class="qr-block">      <div class="qr-block">
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

// SPITZ DOG running + paw prints
(function(){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(ov);

  // Paw print SVG (dog paw, not hand)
  function paw(flip){
    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('viewBox','0 0 28 30');s.setAttribute('width','14');s.setAttribute('height','15');
    var ns='http://www.w3.org/2000/svg';
    var g=document.createElementNS(ns,'g');
    if(flip)g.setAttribute('transform','scale(-1,1) translate(-28,0)');
    // Main pad
    var pad=document.createElementNS(ns,'ellipse');
    pad.setAttribute('cx','14');pad.setAttribute('cy','20');pad.setAttribute('rx','8');pad.setAttribute('ry','7');
    pad.setAttribute('fill','#C8A090');pad.setAttribute('opacity','0.45');g.appendChild(pad);
    // 4 toe beans
    var toes=[{cx:7,cy:11,rx:3.2,ry:2.8},{cx:12,cy:8.5,rx:3,ry:2.6},{cx:17.5,cy:8.5,rx:3,ry:2.6},{cx:22.5,cy:11,rx:3,ry:2.7}];
    toes.forEach(function(t){
      var e=document.createElementNS(ns,'ellipse');
      e.setAttribute('cx',t.cx);e.setAttribute('cy',t.cy);e.setAttribute('rx',t.rx);e.setAttribute('ry',t.ry);
      e.setAttribute('fill','#C8A090');e.setAttribute('opacity','0.38');g.appendChild(e);
    });
    s.appendChild(g);return s;
  }

// Also keep paw prints walking (instead of hand prints)
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
