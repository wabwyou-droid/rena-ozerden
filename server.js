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

// PostgreSQL bağlantısı
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

// Tablo oluştur
async function initDB() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notlar (
      id BIGINT PRIMARY KEY,
      isim TEXT,
      mesaj TEXT,
      foto TEXT,
      saat TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('DB hazır');
}
initDB();

// Bellekte tutmak için (DB yoksa fallback)
const dilekler = [];

// DB'den yükle
async function loadFromDB() {
  if (!pool) return;
  try {
    const res = await pool.query('SELECT * FROM notlar ORDER BY created_at ASC');
    dilekler.length = 0;
    res.rows.forEach(r => dilekler.push({ id: r.id, isim: r.isim, mesaj: r.mesaj, foto: r.foto, saat: r.saat }));
    console.log('DB yüklendi:', dilekler.length, 'not');
  } catch(e) { console.error('DB load error:', e.message); }
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

app.post('/api/not', upload.single('foto'), async (req, res) => {
  const isim  = (req.body && req.body.isim  ? String(req.body.isim).slice(0,40)  : '');
  const mesaj = (req.body && req.body.mesaj ? String(req.body.mesaj).slice(0,160) : '');
  if (!isim && !mesaj && !req.file && !(req.body && req.body.foto)) return res.status(400).json({ ok: false });

  let fotoBase64 = null;
  if (req.body && req.body.foto && req.body.foto.startsWith('data:image')) {
    // Client-side compressed base64
    fotoBase64 = req.body.foto.slice(0, 200000); // max ~150KB
  } else if (req.file) {
    fotoBase64 = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
  }

  const d = {
    id:    Date.now(),
    isim:  isim  || 'Misafir',
    mesaj: mesaj || '',
    foto:  fotoBase64,
    saat:  new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  };
  dilekler.push(d);
  // DB'ye kaydet
  if (pool) {
    pool.query(
      'INSERT INTO notlar (id, isim, mesaj, foto, saat) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
      [d.id, d.isim, d.mesaj, d.foto, d.saat]
    ).catch(e => console.error('DB insert error:', e.message));
  }
  broadcast({ type: 'dilek', dilek: d });
  res.json({ ok: true });
});

// ── TV EKRANI ──
app.get('/', async (req, res) => {
  const notUrl = NOT_URL;
  const QRCodeLib = require('qrcode');
  const qrDataUrl = await QRCodeLib.toDataURL(notUrl, {
    width: 240, margin: 2,
    color: { dark: '#1A0A00', light: '#FFFFFF' }
  });
  const qrImg = '<img src="' + qrDataUrl + '" style="display:block;width:min(16vw,200px);height:min(16vw,200px);" alt="QR"/>';

  const style    = "\n@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Lato:wght@100;200;300&display=swap');\n*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}\nhtml,body{width:100%;height:100%;overflow:hidden;background:#F5F0E8;color-scheme:light only;}\nbody{display:flex;align-items:center;justify-content:center;background:#F5F0E8;}\n\n.canvas{position:relative;width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;overflow:hidden;background:#FAF6F0;}\n.bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 100% 100% at 20% 50%,#FFF8F2 0%,#F5EDE0 100%);}\n.grain{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.018;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\");background-size:200px;}\n.canvas>*{position:relative;z-index:2;}\n\n/* 3-COLUMN */\n.layout{position:absolute;inset:0;z-index:5;display:grid;grid-template-columns:33.33% 66.67%;}\n\n/* LEFT */\n.left-col{display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:2.5vw 2vw 2vw 2.5vw;border-right:1px solid rgba(200,168,136,.15);}\n.title-block{text-align:center;}\n.title-rena{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(26px,5vw,78px);color:#7A5535;letter-spacing:.14em;line-height:1;display:block;opacity:0;animation:fadeUp 2s ease forwards .3s;}\n.title-ozerden{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(26px,5vw,78px);color:#7A5535;letter-spacing:.14em;line-height:1;display:block;opacity:0;animation:fadeUp 2s ease forwards .6s;}\n.title-line{width:0;height:1px;background:linear-gradient(to right,transparent,#C8A878,transparent);margin:.6vw auto;opacity:.5;animation:lineGrow 2s ease forwards 1s;}\n@keyframes lineGrow{to{width:min(10vw,120px);}}\n\n/* BLOOMING FLOWER */\n.flower-wrap{width:92%;opacity:0;animation:fadeUp 2s ease forwards .9s;}\n\n/* Petal animation \u2014 blooming from center */\n/* BLOOMING FLOWER \u2014 grows from roots, heartbeat rhythm, slow and elegant */\n.bloom-sway{\n  transform-origin:50% 98%;\n  animation:fadeUp 2s ease forwards .9s;\n}\n\n/* Outer petals \u2014 bloom from root up */\n.bloom-petal{\n  transform-origin: 50% 100%;\n  animation: petalGrow 18s cubic-bezier(0.25,0.46,0.45,0.94) infinite;\n  animation-delay: var(--bloom-del, 0s);\n}\n@keyframes petalGrow{\n  0%   { transform:rotate(var(--base-rot)) scaleY(0) scaleX(0); opacity:0; }\n  8%   { transform:rotate(var(--base-rot)) scaleY(1.12) scaleX(1.08); opacity:1; }\n  14%  { transform:rotate(var(--base-rot)) scaleY(0.96) scaleX(0.98); opacity:0.95; }\n  18%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:1; }\n  /* hold open with gentle heartbeat */\n  52%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:1; }\n  56%  { transform:rotate(var(--base-rot)) scaleY(1.04) scaleX(1.03); opacity:1; }\n  60%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:1; }\n  /* close slowly */\n  82%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:0.9; }\n  96%  { transform:rotate(var(--base-rot)) scaleY(0.05) scaleX(0.1); opacity:0; }\n  100% { transform:rotate(var(--base-rot)) scaleY(0) scaleX(0); opacity:0; }\n}\n\n/* Inner petals \u2014 slightly delayed */\n.bloom-inner{\n  transform-origin: 50% 100%;\n  animation: innerGrow 18s cubic-bezier(0.25,0.46,0.45,0.94) infinite;\n  animation-delay: var(--bloom-del, 0.3s);\n}\n@keyframes innerGrow{\n  0%   { transform:rotate(var(--base-rot)) scaleY(0) scaleX(0); opacity:0; }\n  10%  { transform:rotate(var(--base-rot)) scaleY(1.1) scaleX(1.06); opacity:1; }\n  16%  { transform:rotate(var(--base-rot)) scaleY(0.97) scaleX(0.99); opacity:0.95; }\n  20%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:1; }\n  52%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:1; }\n  56%  { transform:rotate(var(--base-rot)) scaleY(1.05) scaleX(1.04); opacity:1; }\n  60%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:1; }\n  84%  { transform:rotate(var(--base-rot)) scaleY(1.0) scaleX(1.0); opacity:0.85; }\n  97%  { transform:rotate(var(--base-rot)) scaleY(0.04) scaleX(0.08); opacity:0; }\n  100% { transform:rotate(var(--base-rot)) scaleY(0) scaleX(0); opacity:0; }\n}\n\n/* Center \u2014 last to open, first to show heartbeat */\n.bloom-center{\n  animation: centerGrow 18s ease-in-out infinite 0.8s;\n}\n@keyframes centerGrow{\n  0%   { transform:scale(0); opacity:0; }\n  12%  { transform:scale(1.2); opacity:1; }\n  18%  { transform:scale(0.94); opacity:0.95; }\n  22%  { transform:scale(1.0); opacity:1; }\n  /* heartbeat pulses while open */\n  45%  { transform:scale(1.0); opacity:1; }\n  48%  { transform:scale(1.08); opacity:1; }\n  51%  { transform:scale(0.97); opacity:1; }\n  54%  { transform:scale(1.04); opacity:1; }\n  57%  { transform:scale(1.0); opacity:1; }\n  82%  { transform:scale(1.0); opacity:0.9; }\n  97%  { transform:scale(0.05); opacity:0; }\n  100% { transform:scale(0); opacity:0; }\n}\n\n/* QR */\n.qr-block{text-align:center;opacity:0;animation:fadeUp 2s ease forwards 1.4s;}\n.qr-wrap{display:inline-flex;flex-direction:column;align-items:center;gap:.5vw;background:rgba(255,250,244,.92);border:1px solid rgba(200,168,136,.25);padding:.8vw 1vw .6vw;box-shadow:0 4px 20px rgba(160,120,80,.1);}\n.qr-bow{font-size:clamp(12px,1.5vw,22px);line-height:1;margin-bottom:.1vw;}\n.qr-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:clamp(18px,2.6vw,40px);color:#7A5535;letter-spacing:.04em;line-height:1.35;}\n.qr-heart{font-size:clamp(8px,.9vw,13px);color:#C87888;margin-top:.2vw;opacity:.8;}\n.qr-frame{display:inline-block;background:#fff;padding:7px;border:1px solid rgba(200,168,136,.25);}\n.qr-frame img{display:block !important;width:min(16vw,200px) !important;height:min(16vw,200px) !important;}\n\n/* RIGHT */\n.right-col{position:relative;overflow:hidden;}\n.col-line{position:absolute;top:0;bottom:0;width:1px;left:50%;background:linear-gradient(to bottom,transparent,rgba(200,168,136,.08) 20%,rgba(200,168,136,.08) 80%,transparent);z-index:1;pointer-events:none;}\n\n/* SNOW \u2014 all columns */\n#snow{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;}\n.sp{position:absolute;top:-5vw;opacity:0;animation:spFall var(--dur) ease-in-out infinite var(--del);}\n@keyframes spFall{0%{opacity:0;transform:translateY(0) rotate(0deg) translateX(0);}8%{opacity:var(--op);}85%{opacity:var(--op);}100%{opacity:0;transform:translateY(115vh) rotate(var(--spin)) translateX(var(--sway));}}\n\n/* SPARKLES */\n#sparkles{position:absolute;inset:0;z-index:2;pointer-events:none;}\n.sparkle{position:absolute;animation:twinkle var(--dur) ease-in-out infinite var(--del);opacity:0;}\n@keyframes twinkle{0%,100%{opacity:0;transform:scale(0);}50%{opacity:var(--op);transform:scale(1) rotate(90deg);}}\n\n/* PETALS */\n#petals{position:absolute;inset:0;z-index:4;pointer-events:none;}\n.burst{position:absolute;}\n.petal{position:absolute;border-radius:50%;animation:petalOut var(--pd,1.4s) ease-out forwards;}\n@keyframes petalOut{0%{transform:translate(0,0);opacity:1;}100%{transform:translate(var(--tx),var(--ty)) scale(.2);opacity:0;}}\n\n/* NOTES */\n#notes{position:absolute;z-index:10;pointer-events:none;overflow:hidden;top:0;bottom:0;left:33.33%;right:0;}\n.nc{\n  position:absolute;\n  background:rgba(255,253,250,.97);\n  border:1px solid rgba(200,165,140,.28);\n  padding:.8vw 1vw;\n  width:15vw;\n  max-width:15vw;\n  overflow:hidden;\n  box-sizing:border-box;\n  box-shadow:0 4px 20px rgba(140,100,70,.1);\n  animation:ncFall var(--fall-dur) linear forwards;\n  opacity:0;\n}\n@keyframes ncFall{\n  0%  {opacity:0;transform:translateY(-140px) rotate(var(--r));}\n  4%  {opacity:1;}\n  92% {opacity:1;transform:translateY(var(--fall-dist)) rotate(var(--r));}\n  100%{opacity:0;transform:translateY(var(--fall-dist)) rotate(var(--r));}\n}\n.nc-foto{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;margin-bottom:.5vw;border-radius:1px;}\n.nc-name{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(14px,1.7vw,27px);color:#5A3518;letter-spacing:.02em;margin-bottom:.4vw;word-break:break-word;overflow-wrap:break-word;}\n.nc-msg{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:clamp(13px,1.45vw,23px);color:#6A4525;line-height:1.5;word-break:break-word;overflow-wrap:break-word;}\n\n/* TOAST */\n.toast{position:fixed;top:3vw;left:50%;transform:translateX(-50%);z-index:60;white-space:nowrap;background:rgba(255,252,248,.97);border:1px solid rgba(200,168,136,.3);padding:.5vw 1.8vw;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(10px,1vw,16px);color:#8A6040;animation:toastAnim 4s ease forwards;pointer-events:none;}\n@keyframes toastAnim{0%{opacity:0;transform:translateX(-50%) translateY(-8px);}10%{opacity:1;transform:translateX(-50%) translateY(0);}78%{opacity:1;}100%{opacity:0;}}\n\n/* COUNTER */\n.counter{position:absolute;bottom:1.8vw;right:1.5vw;z-index:20;display:flex;align-items:center;gap:.4vw;opacity:0;animation:fadeUp 2s ease forwards 2s;}\n.ldot{width:5px;height:5px;border-radius:50%;background:#C8A878;flex-shrink:0;animation:ldotPulse 3s ease-in-out infinite;}\n@keyframes ldotPulse{0%,100%{opacity:1;}50%{opacity:.3;}}\n.ctxt{font-family:'Lato',sans-serif;font-weight:200;font-size:clamp(7px,.7vw,10px);letter-spacing:.3em;color:rgba(168,128,96,.6);}\n\n@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}\n";
  const bodyHtml = "<div class=\"canvas\" id=\"canvas\">\n  <div class=\"bg\"></div>\n  <div class=\"grain\"></div>\n  <div id=\"snow\"></div>\n  <div id=\"sparkles\"></div>\n  <div id=\"petals\"></div>\n  <div id=\"notes\"></div>\n\n  <div class=\"layout\">\n    <!-- LEFT -->\n    <div class=\"left-col\">\n      <div class=\"title-block\">\n        <span class=\"title-rena\">Rena</span>\n        <div class=\"title-line\"></div>\n        <span class=\"title-ozerden\">\u00d6zerden</span>\n      </div>\n\n      <!-- BLOOMING FLOWER SVG -->\n      <div class=\"flower-wrap\">\n        <div class=\"bloom-sway\">\n        <svg viewBox=\"0 0 300 200\" xmlns=\"http://www.w3.org/2000/svg\">\n          <defs>\n            <radialGradient id=\"rp1\" cx=\"50%\" cy=\"20%\" r=\"70%\">\n              <stop offset=\"0%\" stop-color=\"#FEE0E8\"/>\n              <stop offset=\"50%\" stop-color=\"#F5B0C0\"/>\n              <stop offset=\"100%\" stop-color=\"#D88898\"/>\n            </radialGradient>\n            <radialGradient id=\"rp2\" cx=\"50%\" cy=\"20%\" r=\"70%\">\n              <stop offset=\"0%\" stop-color=\"#FEE8EE\"/>\n              <stop offset=\"50%\" stop-color=\"#ECA8BC\"/>\n              <stop offset=\"100%\" stop-color=\"#CC8090\"/>\n            </radialGradient>\n            <radialGradient id=\"rp3\" cx=\"50%\" cy=\"20%\" r=\"60%\">\n              <stop offset=\"0%\" stop-color=\"#FFF0F4\"/>\n              <stop offset=\"50%\" stop-color=\"#F8C0CC\"/>\n              <stop offset=\"100%\" stop-color=\"#E090A0\"/>\n            </radialGradient>\n            <radialGradient id=\"rcg\" cx=\"45%\" cy=\"35%\" r=\"60%\">\n              <stop offset=\"0%\" stop-color=\"#FFF0E0\"/>\n              <stop offset=\"100%\" stop-color=\"#E8C090\"/>\n            </radialGradient>\n            <radialGradient id=\"rlg\" cx=\"30%\" cy=\"30%\" r=\"70%\">\n              <stop offset=\"0%\" stop-color=\"#D0DDB0\"/>\n              <stop offset=\"100%\" stop-color=\"#8AAA68\"/>\n            </radialGradient>\n          </defs>\n\n          <!-- Stem -->\n          <path d=\"M150,195 Q148,165 150,140 Q152,115 150,95\" stroke=\"#9AB878\" stroke-width=\"3\" fill=\"none\" stroke-linecap=\"round\" style=\"opacity:0;animation:fadeUp 1s ease forwards 0.5s;\"/>\n\n          <!-- Horizontal branch left -->\n          <path d=\"M150,155 Q128,151 108,149 Q90,148 72,144\" stroke=\"#9AB878\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" style=\"opacity:0;animation:fadeUp 1.5s ease forwards 0.8s;\"/>\n          <!-- Left leaf -->\n          <path d=\"M90,148 Q78,135 70,122 Q85,130 95,143Z\" fill=\"url(#rlg)\" opacity=\".8\" style=\"opacity:0;animation:fadeUp 2s ease forwards 1s;\"/>\n<!-- Horizontal branch right -->\n          <path d=\"M150,138 Q172,133 192,130 Q210,128 228,124\" stroke=\"#9AB878\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" style=\"opacity:0;animation:fadeUp 1.5s ease forwards 1s;\"/>\n          <!-- Right leaf -->\n          <path d=\"M210,130 Q222,117 230,103 Q218,115 205,126Z\" fill=\"url(#rlg)\" opacity=\".75\" style=\"opacity:0;animation:fadeUp 2s ease forwards 1.2s;\"/>\n          <!-- Right small bud -->\n          <g transform=\"translate(228,112)\" style=\"opacity:0;animation:fadeUp 2s ease forwards 1.8s;\">\n            <ellipse cx=\"0\" cy=\"-8\" rx=\"4\" ry=\"6.5\" fill=\"url(#rp3)\" opacity=\".8\" transform=\"rotate(0,0,0)\"/>\n            <ellipse cx=\"0\" cy=\"-8\" rx=\"4\" ry=\"6.5\" fill=\"url(#rp2)\" opacity=\".8\" transform=\"rotate(72,0,0)\"/>\n            <ellipse cx=\"0\" cy=\"-8\" rx=\"4\" ry=\"6.5\" fill=\"url(#rp3)\" opacity=\".8\" transform=\"rotate(144,0,0)\"/>\n            <ellipse cx=\"0\" cy=\"-8\" rx=\"4\" ry=\"6.5\" fill=\"url(#rp2)\" opacity=\".8\" transform=\"rotate(216,0,0)\"/>\n            <ellipse cx=\"0\" cy=\"-8\" rx=\"4\" ry=\"6.5\" fill=\"url(#rp3)\" opacity=\".8\" transform=\"rotate(288,0,0)\"/>\n            <circle cx=\"0\" cy=\"0\" r=\"5\" fill=\"url(#rcg)\"/>\n          </g>\n\n          <!-- MAIN FLOWER \u2014 blooming petals -->\n          <g transform=\"translate(150,75)\">\n            <!-- Outer petals \u2014 bloom first, slowest -->\n            <g class=\"bloom-petal\" style=\"--base-rot:0deg;--bloom-del:0s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp1)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:45deg;--bloom-del:0.15s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp2)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:90deg;--bloom-del:0.3s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp1)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:135deg;--bloom-del:0.45s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp2)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:180deg;--bloom-del:0.6s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp1)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:225deg;--bloom-del:0.75s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp2)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:270deg;--bloom-del:0.9s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp1)\" opacity=\".72\"/></g>\n            <g class=\"bloom-petal\" style=\"--base-rot:315deg;--bloom-del:1.05s;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-26\" rx=\"11\" ry=\"20\" fill=\"url(#rp2)\" opacity=\".72\"/></g>\n            <!-- Mid petals -->\n            <g class=\"bloom-inner\" style=\"--base-rot:22.5deg; transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp3)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:67.5deg; transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp2)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:112.5deg;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp3)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:157.5deg;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp2)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:202.5deg;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp3)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:247.5deg;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp2)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:292.5deg;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp3)\" opacity=\".85\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:337.5deg;transform-origin:0px 0px;\"><ellipse cx=\"0\" cy=\"-20\" rx=\"8.5\" ry=\"16\" fill=\"url(#rp2)\" opacity=\".85\"/></g>\n            <!-- Inner petals -->\n            <g class=\"bloom-inner\" style=\"--base-rot:0deg;  transform-origin:0px 0px;animation-delay:2.2s !important;\"><ellipse cx=\"0\" cy=\"-14\" rx=\"6\" ry=\"11\" fill=\"url(#rp3)\" opacity=\".92\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:60deg; transform-origin:0px 0px;animation-delay:2.3s !important;\"><ellipse cx=\"0\" cy=\"-14\" rx=\"6\" ry=\"11\" fill=\"url(#rp3)\" opacity=\".92\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:120deg;transform-origin:0px 0px;animation-delay:2.4s !important;\"><ellipse cx=\"0\" cy=\"-14\" rx=\"6\" ry=\"11\" fill=\"url(#rp3)\" opacity=\".92\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:180deg;transform-origin:0px 0px;animation-delay:2.5s !important;\"><ellipse cx=\"0\" cy=\"-14\" rx=\"6\" ry=\"11\" fill=\"url(#rp3)\" opacity=\".92\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:240deg;transform-origin:0px 0px;animation-delay:2.6s !important;\"><ellipse cx=\"0\" cy=\"-14\" rx=\"6\" ry=\"11\" fill=\"url(#rp3)\" opacity=\".92\"/></g>\n            <g class=\"bloom-inner\" style=\"--base-rot:300deg;transform-origin:0px 0px;animation-delay:2.7s !important;\"><ellipse cx=\"0\" cy=\"-14\" rx=\"6\" ry=\"11\" fill=\"url(#rp3)\" opacity=\".92\"/></g>\n            <!-- Center -->\n            <g class=\"bloom-center\">\n              <circle cx=\"0\" cy=\"0\" r=\"16\" fill=\"url(#rcg)\"/>\n              <circle cx=\"0\" cy=\"0\" r=\"10\" fill=\"#F5DCC0\" opacity=\".9\"/>\n              <circle cx=\"-3\" cy=\"-3\" r=\"4\" fill=\"rgba(255,248,235,.65)\"/>\n              <!-- Stamens -->\n              <g stroke=\"#C8986A\" stroke-width=\".9\" opacity=\".75\">\n                <line x1=\"0\"  y1=\"-9\"  x2=\"0\"  y2=\"-14\"/><circle cx=\"0\"   cy=\"-15\" r=\"1.8\" fill=\"#D4A870\"/>\n                <line x1=\"7\"  y1=\"-6\"  x2=\"10\" y2=\"-11\"/><circle cx=\"11\"  cy=\"-12\" r=\"1.5\" fill=\"#D4A870\"/>\n                <line x1=\"-7\" y1=\"-6\"  x2=\"-10\"y2=\"-11\"/><circle cx=\"-11\" cy=\"-12\" r=\"1.5\" fill=\"#D4A870\"/>\n                <line x1=\"9\"  y1=\"2\"   x2=\"13\" y2=\"5\"  /><circle cx=\"14\"  cy=\"6\"   r=\"1.3\" fill=\"#D4A870\"/>\n                <line x1=\"-9\" y1=\"2\"   x2=\"-13\"y2=\"5\"  /><circle cx=\"-14\" cy=\"6\"   r=\"1.3\" fill=\"#D4A870\"/>\n              </g>\n            </g>\n          </g>\n\n          <!-- Decorative dots on stem -->\n          <circle cx=\"108\" cy=\"148\" r=\"2.5\" fill=\"#D4A878\" opacity=\".4\" style=\"opacity:0;animation:fadeUp 1s ease forwards 2s;\"/>\n          <circle cx=\"175\" cy=\"133\" r=\"2\" fill=\"#D4A878\" opacity=\".35\" style=\"opacity:0;animation:fadeUp 1s ease forwards 2.2s;\"/>\n        </svg>\n        </div>\n      </div>\n\n      <!-- QR -->\n      <div class=\"qr-block\">\n        <div class=\"qr-wrap\">\n          <div class=\"qr-bow\">\ud83c\udf80</div>\n          <div class=\"qr-title\">Rena'ya<br>bir not b\u0131rak</div>\n          <div class=\"qr-frame\" id=\"qrBox\"></div>\n          <div class=\"qr-heart\">\u2661 &nbsp; \u2661 &nbsp; \u2661</div>\n        </div>\n      </div>\n    </div>\n\n    <!-- RIGHT -->\n    <div class=\"right-col\" id=\"rightCol\">\n      <div class=\"col-line\"></div>\n    </div>\n  </div>\n\n  <div class=\"counter\">\n    <div class=\"ldot\"></div>\n    <div class=\"ctxt\" id=\"ct\">0 not</div>\n  </div>\n</div>\n\n<!-- QR \u2014 canvas only, no img duplicate -->\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js\"></script>\n<script>\n(function(){\n  var box = document.getElementById('qrBox');\n  if(!box) return;\n  var url = location.protocol+'//'+location.host+'/not';\n  // useSVG:false forces canvas only (no img tag)\n  new QRCode(box, {\n    text: url, width:150, height:150,\n    colorDark:'#1A0A00', colorLight:'#FFFFFF',\n    correctLevel: QRCode.CorrectLevel.H,\n    useSVG: false\n  });\n  // Hide any img tags qrcodejs might create\n  setTimeout(function(){\n    var imgs = box.querySelectorAll('img');\n    imgs.forEach(function(img){ img.style.display='none'; });\n    var canvas = box.querySelector('canvas');\n    if(canvas){\n      canvas.style.display='block';\n      canvas.style.width='min(12vw,150px)';\n      canvas.style.height='min(12vw,150px)';\n    }\n  }, 400);\n})();\n\n// \u2500\u2500 FALLING ITEMS \u2014 all columns \u2500\u2500\n(function(){\n  var s = document.getElementById('snow');\n  function pacifierSVG(sz,op){\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\" width=\"'+sz+'\" height=\"'+sz+'\" style=\"display:block;\">'+\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"rgba(232,180,190,'+op+')\" />'+\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1\"/>'+\n      '<ellipse cx=\"20\" cy=\"12\" rx=\"4.5\" ry=\"6\" fill=\"rgba(220,160,150,'+(op*1.1)+')\" />'+\n      '<circle cx=\"20\" cy=\"33\" r=\"4\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1.8\"/>'+\n      '</svg>';\n  }\n  function bottleSVG(sz,op){\n    var w=Math.round(sz*.6);\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 42\" width=\"'+w+'\" height=\"'+sz+'\" style=\"display:block;\">'+\n      '<ellipse cx=\"12\" cy=\"4\" rx=\"3\" ry=\"3.5\" fill=\"rgba(200,160,140,'+op+')\" />'+\n      '<rect x=\"8\" y=\"6\" width=\"8\" height=\"4\" rx=\"2\" fill=\"rgba(220,175,165,'+op+')\" />'+\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"rgba(245,225,225,'+(op*.85)+')\" />'+\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"none\" stroke=\"rgba(210,170,165,'+op+')\" stroke-width=\"1\"/>'+\n      '</svg>';\n  }\n  function flowerSVG(sz,op){\n    var c='rgba(210,175,165,'+op+')';\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"'+sz+'\" height=\"'+sz+'\" style=\"display:block;\">'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(0,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(60,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(120,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(180,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(240,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(300,10,10)\"/>'+\n      '<circle cx=\"10\" cy=\"10\" r=\"3.5\" fill=\"rgba(245,225,215,'+op+')\" />'+\n      '</svg>';\n  }\n  var types=['pacifier','bottle','flower','pacifier','bottle','flower','pacifier','bottle'];\n  for(var i=0;i<30;i++){\n    var el=document.createElement('div'); el.className='sp';\n    var type=types[i%types.length];\n    var sz=8+Math.random()*6, op=(0.2+Math.random()*.28).toFixed(2);\n    var inner=type==='pacifier'?pacifierSVG(sz,op):type==='bottle'?bottleSVG(sz,op):flowerSVG(sz,op);\n    el.innerHTML=inner;\n    // Distribute across full width\n    el.style.cssText='left:'+(Math.random()*100)+'%;--dur:'+(11+Math.random()*14)+'s;--del:-'+(Math.random()*22)+'s;--op:1;--spin:'+((Math.random()-.5)*260)+'deg;--sway:'+((Math.random()-.5)*5)+'vw;';\n    s.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 SPARKLES \u2500\u2500\n(function(){\n  var sp=document.getElementById('sparkles');\n  for(var i=0;i<16;i++){\n    var el=document.createElement('div');el.className='sparkle';\n    var sz=.25+Math.random()*.55;\n    el.style.cssText='left:'+(Math.random()*95)+'%;top:'+(5+Math.random()*90)+'%;--dur:'+(3+Math.random()*4)+'s;--del:-'+(Math.random()*6)+'s;--op:'+(0.2+Math.random()*.3)+';';\n    el.innerHTML='<svg width=\"'+(sz*10)+'px\" height=\"'+(sz*10)+'px\" viewBox=\"0 0 12 12\"><path d=\"M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z\" fill=\"rgba(190,155,110,'+(0.28+Math.random()*.28)+')\"/></svg>';\n    sp.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 CLICK BLOOM \u2500\u2500\nvar PCOLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8'];\nfunction bloom(x,y){\n  var c=document.getElementById('canvas');\n  var b=document.createElement('div');b.className='burst';b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;z-index:4;';\n  for(var i=0;i<14;i++){\n    var p=document.createElement('div');p.className='petal';\n    var ang=(Math.PI*2/14)*i,dist=20+Math.random()*25,sz=3+Math.random()*4;\n    p.style.cssText='width:'+sz+'px;height:'+sz+'px;background:'+PCOLS[i%5]+';left:0;top:0;--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;--pd:'+(0.9+Math.random()*.5)+'s;animation-delay:'+(Math.random()*.06)+'s;';\n    b.appendChild(p);\n  }\n  c.appendChild(b);setTimeout(function(){if(b.parentNode)b.remove();},1600);\n}\ndocument.getElementById('canvas').addEventListener('click',function(e){\n  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();\n  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));\n});\n\n// \u2500\u2500 NOTES \u2014 6 columns, no overlap \u2500\u2500\nvar count=0;\nfunction esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}\n\nvar _cols=[\n  {left:2,  active:false},\n  {left:18, active:false},\n  {left:34, active:false},\n  {left:50, active:false},\n  {left:66, active:false},\n  {left:82, active:false},\n];\nvar _noteQueue=[];\n\nfunction getFreeCol(){\n  var free=_cols.filter(function(c){return !c.active;});\n  if(!free.length) return null;\n  return free[Math.floor(Math.random()*free.length)];\n}\n\nfunction launchNote(isim,mesaj,foto){\n  var col=getFreeCol();\n  if(!col){ _noteQueue.push({isim:isim,mesaj:mesaj,foto:foto}); return; }\n  col.active=true;\n  var el=document.createElement('div');el.className='nc';\n  var rot=(Math.random()-.5)*1.5;\n  var fallDur=10+Math.random()*6;\n  el.style.cssText='left:'+col.left+'%;top:-5%;--r:'+rot+'deg;--fall-dist:115vh;--fall-dur:'+fallDur+'s;';\n  var fHtml=foto?'<img class=\"nc-foto\" src=\"'+foto+'\" alt=\"\"/>':'';\n  el.innerHTML=fHtml+'<div class=\"nc-name\">'+esc(isim)+'</div><div class=\"nc-msg\">'+esc(mesaj)+'</div>';\n  document.getElementById('notes').appendChild(el);\n  setTimeout(function(){\n    if(el.parentNode)el.remove();\n    col.active=false;\n    // Re-queue for infinite loop\n    if(_noteQueue.length<200) _noteQueue.push({isim:isim,mesaj:mesaj,foto:foto});\n    setTimeout(tryQueue,300+Math.random()*800);\n  }, fallDur*1000+200);\n}\n\nfunction tryQueue(){\n  if(!_noteQueue.length) return;\n  var col=getFreeCol();\n  if(!col) return;\n  var next=_noteQueue.shift();\n  launchNote(next.isim,next.mesaj,next.foto);\n}\n\nfunction spawnNote(isim,mesaj,foto){\n  launchNote(isim,mesaj,foto);\n  count++;\n  var ct=document.getElementById('ct');if(ct)ct.textContent=count+' not';\n  var t=document.createElement('div');t.className='toast';\n  t.textContent=esc(isim)+' bir not b\u0131rakt\u0131 \u2661';\n  document.getElementById('canvas').appendChild(t);\n  setTimeout(function(){if(t.parentNode)t.remove();},4200);\n}\n\n// Force visible\nsetTimeout(function(){\n  document.querySelectorAll('.title-rena,.title-ozerden,.flower-wrap,.qr-block,.counter').forEach(function(el){\n    el.style.opacity='1';el.style.transform='translateY(0)';\n  });\n},400);\n\n// \u2500\u2500 HAND PRINTS \u2500\u2500\n(function(){\n  var ov=document.createElement('div');\n  ov.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';\n  document.body.appendChild(ov);\n  function foot(flip){\n    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');\n    s.setAttribute('viewBox','0 0 32 36');s.setAttribute('width','12');s.setAttribute('height','13');\n    var ns='http://www.w3.org/2000/svg';\n    var g=document.createElementNS(ns,'g');\n    if(flip)g.setAttribute('transform','scale(-1,1) translate(-32,0)');\n    var palm=document.createElementNS(ns,'path');\n    palm.setAttribute('d','M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 C6,13 7,12 9,12 C11,12 13,12 15,13 C17,12 19,12 21,13 C23,12 25,13 26,15 C27,17 28,19 28,23 C29,27 28,31 25,32 Z');\n    palm.setAttribute('fill','#C8A090');palm.setAttribute('opacity','0.4');g.appendChild(palm);\n    [{cx:7,cy:8,rx:2.8,ry:3.2},{cx:12,cy:6,rx:2.6,ry:3.4},{cx:18,cy:6,rx:2.6,ry:3.4},{cx:23,cy:7.5,rx:2.4,ry:3.1}].forEach(function(f){\n      var e=document.createElementNS(ns,'ellipse');\n      e.setAttribute('cx',f.cx);e.setAttribute('cy',f.cy);e.setAttribute('rx',f.rx);e.setAttribute('ry',f.ry);\n      e.setAttribute('fill','#C8A090');e.setAttribute('opacity','0.38');g.appendChild(e);\n    });\n    var thumb=document.createElementNS(ns,'ellipse');\n    thumb.setAttribute('cx','3');thumb.setAttribute('cy','18');thumb.setAttribute('rx','2.2');thumb.setAttribute('ry','3.5');\n    thumb.setAttribute('fill','#C8A090');thumb.setAttribute('opacity','0.32');thumb.setAttribute('transform','rotate(-25,3,18)');\n    g.appendChild(thumb);s.appendChild(g);return s;\n  }\n  function walk(){\n    var W=window.innerWidth,H=window.innerHeight;\n    var sx=0.08+Math.random()*0.78,sy=0.12+Math.random()*0.68;\n    var ang=(-15+Math.random()*30)*Math.PI/180,stride=0.05+Math.random()*0.02;\n    for(var i=0;i<5;i++){(function(idx){\n      var right=idx%2===0,perp=ang+Math.PI/2,lat=right?0.022:-0.022;\n      var px=(sx+Math.cos(ang)*stride*idx+Math.cos(perp)*lat)*W;\n      var py=(sy+Math.sin(ang)*stride*idx+Math.sin(perp)*lat)*H;\n      var rot=(ang*180/Math.PI)+(right?8:-8);\n      setTimeout(function(){\n        var wrap=document.createElement('div');\n        wrap.style.cssText='position:absolute;left:'+px+'px;top:'+py+'px;transform:rotate('+rot+'deg);opacity:0;transition:opacity 0.5s ease;';\n        wrap.appendChild(foot(!right));ov.appendChild(wrap);\n        requestAnimationFrame(function(){requestAnimationFrame(function(){wrap.style.opacity='0.55';});});\n        setTimeout(function(){wrap.style.transition='opacity 1.8s ease';wrap.style.opacity='0';setTimeout(function(){if(wrap.parentNode)wrap.remove();},1900);},3500);\n      },idx*400);\n    })(i);}\n  }\n  setTimeout(function(){walk();setInterval(walk,6000+Math.random()*3000);},2000);\n})();\n</script>\n\n<script>\n// \u00c7i\u00e7ek her 15 saniyede bir yeniden a\u00e7\u0131ls\u0131n\nfunction restartBloom() {\n  var petals = document.querySelectorAll('.bloom-petal, .bloom-inner, .bloom-center');\n  petals.forEach(function(el) {\n    el.style.animation = 'none';\n    el.offsetHeight; // reflow\n    el.style.animation = '';\n  });\n}\n// \u0130lk bloom bittikten sonra 15s bekle, sonra d\u00f6ng\u00fc\nsetTimeout(function() {\n  restartBloom();\n  setInterval(restartBloom, 15000);\n}, 15000);\n</script>";
  const jsCode   = "\n(function(){\n  var box = document.getElementById('qrBox');\n  if(!box) return;\n  var url = location.protocol+'//'+location.host+'/not';\n  // useSVG:false forces canvas only (no img tag)\n  new QRCode(box, {\n    text: url, width:150, height:150,\n    colorDark:'#1A0A00', colorLight:'#FFFFFF',\n    correctLevel: QRCode.CorrectLevel.H,\n    useSVG: false\n  });\n  // Hide any img tags qrcodejs might create\n  setTimeout(function(){\n    var imgs = box.querySelectorAll('img');\n    imgs.forEach(function(img){ img.style.display='none'; });\n    var canvas = box.querySelector('canvas');\n    if(canvas){\n      canvas.style.display='block';\n      canvas.style.width='min(12vw,150px)';\n      canvas.style.height='min(12vw,150px)';\n    }\n  }, 400);\n})();\n\n// \u2500\u2500 FALLING ITEMS \u2014 all columns \u2500\u2500\n(function(){\n  var s = document.getElementById('snow');\n  function pacifierSVG(sz,op){\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\" width=\"'+sz+'\" height=\"'+sz+'\" style=\"display:block;\">'+\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"rgba(232,180,190,'+op+')\" />'+\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1\"/>'+\n      '<ellipse cx=\"20\" cy=\"12\" rx=\"4.5\" ry=\"6\" fill=\"rgba(220,160,150,'+(op*1.1)+')\" />'+\n      '<circle cx=\"20\" cy=\"33\" r=\"4\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1.8\"/>'+\n      '</svg>';\n  }\n  function bottleSVG(sz,op){\n    var w=Math.round(sz*.6);\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 42\" width=\"'+w+'\" height=\"'+sz+'\" style=\"display:block;\">'+\n      '<ellipse cx=\"12\" cy=\"4\" rx=\"3\" ry=\"3.5\" fill=\"rgba(200,160,140,'+op+')\" />'+\n      '<rect x=\"8\" y=\"6\" width=\"8\" height=\"4\" rx=\"2\" fill=\"rgba(220,175,165,'+op+')\" />'+\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"rgba(245,225,225,'+(op*.85)+')\" />'+\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"none\" stroke=\"rgba(210,170,165,'+op+')\" stroke-width=\"1\"/>'+\n      '</svg>';\n  }\n  function flowerSVG(sz,op){\n    var c='rgba(210,175,165,'+op+')';\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"'+sz+'\" height=\"'+sz+'\" style=\"display:block;\">'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(0,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(60,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(120,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(180,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(240,10,10)\"/>'+\n      '<ellipse cx=\"10\" cy=\"4\" rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(300,10,10)\"/>'+\n      '<circle cx=\"10\" cy=\"10\" r=\"3.5\" fill=\"rgba(245,225,215,'+op+')\" />'+\n      '</svg>';\n  }\n  var types=['pacifier','bottle','flower','pacifier','bottle','flower','pacifier','bottle'];\n  for(var i=0;i<30;i++){\n    var el=document.createElement('div'); el.className='sp';\n    var type=types[i%types.length];\n    var sz=8+Math.random()*6, op=(0.2+Math.random()*.28).toFixed(2);\n    var inner=type==='pacifier'?pacifierSVG(sz,op):type==='bottle'?bottleSVG(sz,op):flowerSVG(sz,op);\n    el.innerHTML=inner;\n    // Distribute across full width\n    el.style.cssText='left:'+(Math.random()*100)+'%;--dur:'+(11+Math.random()*14)+'s;--del:-'+(Math.random()*22)+'s;--op:1;--spin:'+((Math.random()-.5)*260)+'deg;--sway:'+((Math.random()-.5)*5)+'vw;';\n    s.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 SPARKLES \u2500\u2500\n(function(){\n  var sp=document.getElementById('sparkles');\n  for(var i=0;i<16;i++){\n    var el=document.createElement('div');el.className='sparkle';\n    var sz=.25+Math.random()*.55;\n    el.style.cssText='left:'+(Math.random()*95)+'%;top:'+(5+Math.random()*90)+'%;--dur:'+(3+Math.random()*4)+'s;--del:-'+(Math.random()*6)+'s;--op:'+(0.2+Math.random()*.3)+';';\n    el.innerHTML='<svg width=\"'+(sz*10)+'px\" height=\"'+(sz*10)+'px\" viewBox=\"0 0 12 12\"><path d=\"M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z\" fill=\"rgba(190,155,110,'+(0.28+Math.random()*.28)+')\"/></svg>';\n    sp.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 CLICK BLOOM \u2500\u2500\nvar PCOLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8'];\nfunction bloom(x,y){\n  var c=document.getElementById('canvas');\n  var b=document.createElement('div');b.className='burst';b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;z-index:4;';\n  for(var i=0;i<14;i++){\n    var p=document.createElement('div');p.className='petal';\n    var ang=(Math.PI*2/14)*i,dist=20+Math.random()*25,sz=3+Math.random()*4;\n    p.style.cssText='width:'+sz+'px;height:'+sz+'px;background:'+PCOLS[i%5]+';left:0;top:0;--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;--pd:'+(0.9+Math.random()*.5)+'s;animation-delay:'+(Math.random()*.06)+'s;';\n    b.appendChild(p);\n  }\n  c.appendChild(b);setTimeout(function(){if(b.parentNode)b.remove();},1600);\n}\ndocument.getElementById('canvas').addEventListener('click',function(e){\n  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();\n  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));\n});\n\n// \u2500\u2500 NOTES \u2014 6 columns, no overlap \u2500\u2500\nvar count=0;\nfunction esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}\n\n// 4 columns \u2014 tracks last note bottom position to prevent ANY overlap\nvar _COLS = [\n  {left:1,   lastBottom:-999},\n  {left:26,  lastBottom:-999},\n  {left:51,  lastBottom:-999},\n  {left:76,  lastBottom:-999},\n];\nvar _noteQueue = [];\nvar _NOTE_H_VH = 22; // approximate note height in vh\nvar _NOTE_GAP  = 8;  // minimum gap between notes in vh\n\nfunction getBestCol() {\n  // Pick column where lastBottom is furthest from top (most room)\n  var best = null, bestScore = -Infinity;\n  _COLS.forEach(function(col) {\n    var score = -col.lastBottom; // lower lastBottom = more room = higher score\n    if (score > bestScore) { bestScore = score; best = col; }\n  });\n  return best;\n}\n\nfunction canLaunch(col) {\n  // Can launch if last note is already past the gap threshold\n  return col.lastBottom < (_NOTE_H_VH + _NOTE_GAP);\n}\n\nfunction launchNote(isim, mesaj, foto) {\n  var col = getBestCol();\n  if (!canLaunch(col)) {\n    _noteQueue.push({isim:isim, mesaj:mesaj, foto:foto});\n    return;\n  }\n\n  var el = document.createElement('div'); el.className = 'nc';\n  var fallDur = 16;\n  var startTop = -20; // start above viewport in vh\n\n  el.style.cssText = 'left:' + col.left + '%;top:' + startTop + 'vh;--r:0deg;--fall-dist:130vh;--fall-dur:' + fallDur + 's;';\n\n  var fHtml = foto ? '<img class=\"nc-foto\" src=\"' + foto + '\" alt=\"\"/>' : '';\n  el.innerHTML = fHtml + '<div class=\"nc-name\">' + esc(isim) + '</div><div class=\"nc-msg\">' + esc(mesaj) + '</div>';\n  document.getElementById('notes').appendChild(el);\n\n  // Track position: note starts at startTop, moves at (130vh / fallDur) per second\n  col.lastBottom = startTop + _NOTE_H_VH;\n  var speed = 130 / 16;\n\n  // Update lastBottom progressively\n  var startTime = Date.now();\n  var tracker = setInterval(function() {\n    var elapsed = (Date.now() - startTime) / 1000;\n    col.lastBottom = startTop + _NOTE_H_VH + speed * elapsed;\n    if (col.lastBottom > 110) { clearInterval(tracker); col.lastBottom = -999; }\n  }, 200);\n\n  setTimeout(function() {\n    clearInterval(tracker);\n    col.lastBottom = -999;\n    if (el.parentNode) el.remove();\n    if (_noteQueue.length < 200) _noteQueue.push({isim:isim, mesaj:mesaj, foto:foto});\n    setTimeout(tryQueue, 100);\n  }, fallDur * 1000 + 200);\n}\n\nfunction tryQueue() {\n  if (!_noteQueue.length) return;\n  var col = getBestCol();\n  if (!canLaunch(col)) {\n    setTimeout(tryQueue, 500);\n    return;\n  }\n  var next = _noteQueue.shift();\n  launchNote(next.isim, next.mesaj, next.foto);\n}function spawnNote(isim,mesaj,foto){\n  launchNote(isim,mesaj,foto);\n  count++;\n  var ct=document.getElementById('ct');if(ct)ct.textContent=count+' not';\n  var t=document.createElement('div');t.className='toast';\n  t.textContent=esc(isim)+' bir not b\u0131rakt\u0131 \u2661';\n  document.getElementById('canvas').appendChild(t);\n  setTimeout(function(){if(t.parentNode)t.remove();},4200);\n}\n\n// Force visible\nsetTimeout(function(){\n  document.querySelectorAll('.title-rena,.title-ozerden,.flower-wrap,.qr-block,.counter').forEach(function(el){\n    el.style.opacity='1';el.style.transform='translateY(0)';\n  });\n},400);\n\n// \u2500\u2500 HAND PRINTS \u2500\u2500\n(function(){\n  var ov=document.createElement('div');\n  ov.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';\n  document.body.appendChild(ov);\n  function foot(flip){\n    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');\n    s.setAttribute('viewBox','0 0 32 36');s.setAttribute('width','12');s.setAttribute('height','13');\n    var ns='http://www.w3.org/2000/svg';\n    var g=document.createElementNS(ns,'g');\n    if(flip)g.setAttribute('transform','scale(-1,1) translate(-32,0)');\n    var palm=document.createElementNS(ns,'path');\n    palm.setAttribute('d','M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 C6,13 7,12 9,12 C11,12 13,12 15,13 C17,12 19,12 21,13 C23,12 25,13 26,15 C27,17 28,19 28,23 C29,27 28,31 25,32 Z');\n    palm.setAttribute('fill','#C8A090');palm.setAttribute('opacity','0.4');g.appendChild(palm);\n    [{cx:7,cy:8,rx:2.8,ry:3.2},{cx:12,cy:6,rx:2.6,ry:3.4},{cx:18,cy:6,rx:2.6,ry:3.4},{cx:23,cy:7.5,rx:2.4,ry:3.1}].forEach(function(f){\n      var e=document.createElementNS(ns,'ellipse');\n      e.setAttribute('cx',f.cx);e.setAttribute('cy',f.cy);e.setAttribute('rx',f.rx);e.setAttribute('ry',f.ry);\n      e.setAttribute('fill','#C8A090');e.setAttribute('opacity','0.38');g.appendChild(e);\n    });\n    var thumb=document.createElementNS(ns,'ellipse');\n    thumb.setAttribute('cx','3');thumb.setAttribute('cy','18');thumb.setAttribute('rx','2.2');thumb.setAttribute('ry','3.5');\n    thumb.setAttribute('fill','#C8A090');thumb.setAttribute('opacity','0.32');thumb.setAttribute('transform','rotate(-25,3,18)');\n    g.appendChild(thumb);s.appendChild(g);return s;\n  }\n  function walk(){\n    var W=window.innerWidth,H=window.innerHeight;\n    var sx=0.08+Math.random()*0.78,sy=0.12+Math.random()*0.68;\n    var ang=(-15+Math.random()*30)*Math.PI/180,stride=0.05+Math.random()*0.02;\n    for(var i=0;i<5;i++){(function(idx){\n      var right=idx%2===0,perp=ang+Math.PI/2,lat=right?0.022:-0.022;\n      var px=(sx+Math.cos(ang)*stride*idx+Math.cos(perp)*lat)*W;\n      var py=(sy+Math.sin(ang)*stride*idx+Math.sin(perp)*lat)*H;\n      var rot=(ang*180/Math.PI)+(right?8:-8);\n      setTimeout(function(){\n        var wrap=document.createElement('div');\n        wrap.style.cssText='position:absolute;left:'+px+'px;top:'+py+'px;transform:rotate('+rot+'deg);opacity:0;transition:opacity 0.5s ease;';\n        wrap.appendChild(foot(!right));ov.appendChild(wrap);\n        requestAnimationFrame(function(){requestAnimationFrame(function(){wrap.style.opacity='0.55';});});\n        setTimeout(function(){wrap.style.transition='opacity 1.8s ease';wrap.style.opacity='0';setTimeout(function(){if(wrap.parentNode)wrap.remove();},1900);},3500);\n      },idx*400);\n    })(i);}\n  }\n  setTimeout(function(){walk();setInterval(walk,6000+Math.random()*3000);},2000);\n})();\n\n\n// \u00c7i\u00e7ek her 15 saniyede bir yeniden a\u00e7\u0131ls\u0131n\nfunction restartBloom() {\n  var petals = document.querySelectorAll('.bloom-petal, .bloom-inner, .bloom-center');\n  petals.forEach(function(el) {\n    el.style.animation = 'none';\n    el.offsetHeight; // reflow\n    el.style.animation = '';\n  });\n}\n// \u0130lk bloom bittikten sonra 15s bekle, sonra d\u00f6ng\u00fc\nsetTimeout(function() {\n  restartBloom();\n  setInterval(restartBloom, 15000);\n}, 15000);\n";

  // Inject real QR into placeholder div
  const finalBody = bodyHtml.replace(
    '<div class="qr-frame" id="qrBox"></div>',
    '<div class="qr-frame">' + qrImg + '</div>'
  );

  const wsScript = `<script>
  function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
  function connect(){
    var proto=location.protocol==='https:'?'wss:':'ws:';
    var ws=new WebSocket(proto+'//'+location.host);
    ws.onmessage=function(e){
      try{
        var msg=JSON.parse(e.data);
        if(msg.type==='init'){
          if(!window._noteQueue)window._noteQueue=[];
          msg.dilekler.forEach(function(d){ if(typeof spawnNote==='function') spawnNote(d.isim,d.mesaj,d.foto); });
          if(typeof count!=='undefined') count=msg.dilekler.length;
          var ct=document.getElementById('ct'); if(ct) ct.textContent=msg.dilekler.length+' not';
        } else if(msg.type==='dilek'){
          if(typeof spawnNote==='function') spawnNote(msg.dilek.isim,msg.dilek.mesaj,msg.dilek.foto);
        } else if(msg.type==='clear'){
          var n=document.getElementById('notes'); if(n) n.innerHTML='';
          if(typeof count!=='undefined') count=0;
          var ct=document.getElementById('ct'); if(ct) ct.textContent='0 not';
          window._noteQueue=[];
        }
      }catch(err){ console.log('WS:',err); }
    };
    ws.onclose=function(){ setTimeout(connect,3000); };
  }
  connect();
<\/script>`;

  const html = '<!DOCTYPE html>\n<html lang="tr">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta name="color-scheme" content="light only">\n' +
    '<title>Rena Özerden</title>\n' +
    '<style>' + style + '</style>\n' +
    '</head>\n<body>\n' +
    finalBody + '\n' +
    '<script>' + jsCode + '<\/script>\n' +
    wsScript + '\n' +
    '</body>\n</html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
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
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px 20px;}
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
.err{font-family:'Lato',sans-serif;font-size:12px;color:#C07060;margin-top:-16px;margin-bottom:16px;display:none;text-align:left;}
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
  var file = this.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    // Compress image before preview and upload
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var MAX = 400; // max width/height px
      var w = img.width, h = img.height;
      if (w > h) { if (w > MAX) { h = Math.round(h * MAX/w); w = MAX; } }
      else       { if (h > MAX) { w = Math.round(w * MAX/h); h = MAX; } }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var compressed = canvas.toDataURL('image/jpeg', 0.6);
      document.getElementById('fotoPreview').src = compressed;
      document.getElementById('fotoPreview').style.display = 'block';
      document.getElementById('fotoPlaceholder').style.display = 'none';
      // Store compressed version for upload
      window._compressedFoto = compressed;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});
var btn=document.getElementById('sendBtn');
btn.addEventListener('click',async function(){
  var isim=document.getElementById('isim').value.trim();
  var mesaj=document.getElementById('mesaj').value.trim();
  var foto=document.getElementById('fotoInput').files[0];
  if(!foto){ document.getElementById('err').style.display='block'; document.getElementById('err').textContent='Fotoğraf zorunludur.'; return; }
  if(!isim&&!mesaj){ document.getElementById('err').style.display='block'; document.getElementById('err').textContent='Lütfen bir şeyler yazın.'; return; }
  document.getElementById('err').style.display='none';
  btn.disabled=true;btn.textContent='Gönderiliyor…';
  try{
    var fd=new FormData();
    if(isim) fd.append('isim',isim);
    if(mesaj) fd.append('mesaj',mesaj);
    if(foto) fd.append('foto',foto);
    var r=await fetch('/api/not',{method:'POST',body:fd});
    if(r.ok){document.getElementById('form').style.display='none';document.getElementById('success').style.display='block';}
    else{btn.disabled=false;btn.textContent='Ekrana Gönder ♡';}
  }catch(e){btn.disabled=false;btn.textContent='Bağlantı hatası — tekrar dene';}
});
document.getElementById('anotherBtn').addEventListener('click',function(){
  document.getElementById('isim').value='';document.getElementById('mesaj').value='';
  document.getElementById('fotoInput').value='';
  document.getElementById('fotoPreview').style.display='none';
  document.getElementById('fotoPlaceholder').style.display='block';
  document.getElementById('success').style.display='none';
  document.getElementById('form').style.display='block';
  btn.disabled=false;btn.textContent='Ekrana Gönder ♡';
  document.getElementById('isim').focus();
});
</script>
</body>
</html>`);
});

// ── ADMİN SAYFASI ──
const ADMIN_KEY = process.env.ADMIN_KEY || 'rena2026';

app.get('/admin', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.send('<html><body style="font-family:sans-serif;padding:40px"><h2>Şifre gerekli</h2><form><input name="key" type="password" placeholder="Şifre"/><button>Gir</button></form></body></html>');
  }
  const count = dilekler.length;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: 'Georgia', serif; background: #F9F4EE; padding: 32px 20px; max-width: 600px; margin: 0 auto; }
  h1 { color: #7A5535; font-size: 28px; margin-bottom: 4px; }
  .sub { color: #B89878; font-size: 13px; margin-bottom: 32px; }
  .note { background: #fff; border: 1px solid rgba(200,168,136,.25); padding: 16px 18px; margin-bottom: 12px; border-radius: 2px; }
  .note-name { font-weight: 600; color: #9A7050; font-size: 14px; margin-bottom: 4px; }
  .note-msg { color: #7A5535; font-size: 15px; font-style: italic; }
  .note-time { color: #C8A878; font-size: 11px; margin-top: 6px; }
  .note-foto { width: 80px; height: 80px; object-fit: cover; float: right; border-radius: 2px; margin-left: 12px; }
  .btn-clear { background: #C87060; color: #fff; border: none; padding: 14px 28px; font-size: 14px; cursor: pointer; border-radius: 2px; margin-top: 24px; }
  .btn-clear:hover { background: #A85848; }
  .empty { color: #C8A878; font-style: italic; }
</style>
</head>
<body>
<h1>Rena Özerden</h1>
<div class="sub">Admin Paneli · ${count} not</div>

${dilekler.length === 0 ? '<p class="empty">Henüz not yok.</p>' : dilekler.map(d => `
  <div class="note">
    ${d.foto ? '<img class="note-foto" src="'+d.foto+'" alt=""/>' : ''}
    <div class="note-name">${d.isim}</div>
    <div class="note-msg">${d.mesaj || '—'}</div>
    <div class="note-time">${d.saat}</div>
  </div>
`).join('')}

${dilekler.length > 0 ? `
<form method="POST" action="/admin/clear?key=${ADMIN_KEY}" onsubmit="return confirm('Tüm notlar silinecek. Emin misin?')">
  <button class="btn-clear" type="submit">Tüm Notları Sil (${count} not)</button>
</form>` : ''}
</body>
</html>`);
});

app.post('/admin/clear', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send('Yetkisiz');
  dilekler.length = 0;
  if (pool) {
    await pool.query('DELETE FROM notlar').catch(e => console.error(e.message));
  }
  broadcast({ type: 'clear' });
  res.redirect('/admin?key=' + ADMIN_KEY);
});

// Ping endpoint — UptimeRobot için
app.get('/ping', (req, res) => res.send('ok'));

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n✨  Rena Özerden\n');
  console.log('📺  TV  →  http://localhost:' + PORT);
  console.log('📱  Not →  ' + NOT_URL + '\n');
});
