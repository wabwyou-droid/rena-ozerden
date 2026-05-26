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
  if (!isim && !mesaj && !req.file) return res.status(400).json({ ok: false });

  let fotoBase64 = null;
  if (req.file) {
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
    width: 120, margin: 1,
    color: { dark: '#1A0A00', light: '#FFFFFF' }
  });
  const qrImgTag = '<img src="' + qrDataUrl + '" style="display:block;width:min(4.5vw,58px);height:min(4.5vw,58px);" alt="QR"/>';

  const style    = "\n@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Lato:wght@100;200;300&display=swap');\n\n*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }\nhtml {\n  width:100%; height:100%;\n  color-scheme: light only;\n  background:#F7F0E8;\n}\nbody {\n  width:100vw; height:100vh; overflow:hidden;\n  display:flex; align-items:center; justify-content:center;\n  background:#F7F0E8;\n  color-scheme: light only;\n}\n\n/* \u2500\u2500 CANVAS 16:9 \u2500\u2500 */\n.canvas {\n  position:relative;\n  width:100vw; height:56.25vw;\n  max-height:100vh; max-width:177.78vh;\n  overflow:hidden; cursor:crosshair;\n  background:#F9F4EE;\n}\n\n/* \u2500\u2500 BG TEXTURE \u2500\u2500 */\n.bg {\n  position:absolute; inset:0; z-index:0;\n  background: radial-gradient(ellipse 80% 70% at 50% 50%, #FFFBF6 0%, #F5EDE2 60%, #EDE0D4 100%);\n  animation: bgBreath 20s ease-in-out infinite;\n}\n@keyframes bgBreath {\n  0%,100% { background:radial-gradient(ellipse 80% 70% at 50% 50%, #FFFBF6 0%, #F5EDE2 60%, #EDE0D4 100%); }\n  50%     { background:radial-gradient(ellipse 80% 70% at 50% 50%, #FFFDF8 0%, #F8F0E6 60%, #EFE3D8 100%); }\n}\n\n/* Fine grain */\n.grain {\n  position:absolute; inset:0; z-index:1; pointer-events:none; opacity:.025;\n  background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\");\n  background-size:200px;\n}\n\n.canvas > * { position:relative; z-index:2; }\n\n/* \u2500\u2500 FALLING PETALS \u2500\u2500 */\n#snow { position:absolute; inset:0; z-index:3; pointer-events:none; overflow:hidden; }\n.sp {\n  position:absolute; top:-5vw;\n  opacity:0;\n  animation: spFall var(--dur) ease-in-out infinite var(--del);\n}\n@keyframes spFall {\n  0%   { opacity:0; transform:translateY(0) rotate(0deg) translateX(0); }\n  8%   { opacity:var(--op); }\n  85%  { opacity:var(--op); }\n  100% { opacity:0; transform:translateY(115vh) rotate(var(--spin)) translateX(var(--sway)); }\n}\n\n/* \u2500\u2500 CLICK BURST \u2500\u2500 */\n#petals { position:absolute; inset:0; z-index:4; pointer-events:none; overflow:hidden; }\n.burst  { position:absolute; pointer-events:none; }\n.petal  {\n  position:absolute; border-radius:50%;\n  animation: petalOut var(--dur,1.4s) ease-out forwards;\n}\n@keyframes petalOut {\n  0%   { transform:translate(0,0) scale(1); opacity:1; }\n  100% { transform:translate(var(--tx),var(--ty)) scale(.2); opacity:0; }\n}\n\n/* \u2500\u2500 SPARKLES \u2500\u2500 */\n#sparkles { position:absolute; inset:0; z-index:2; pointer-events:none; overflow:hidden; }\n.sparkle {\n  position:absolute;\n  animation: twinkle var(--dur) ease-in-out infinite var(--del);\n  opacity:0;\n}\n@keyframes twinkle {\n  0%,100% { opacity:0; transform:scale(0) rotate(0deg); }\n  40%,60% { opacity:var(--op); transform:scale(1) rotate(90deg); }\n}\n\n/* \u2500\u2500 NOTE CARDS \u2500\u2500 */\n#notes { position:absolute; inset:0; z-index:20; pointer-events:none; overflow:hidden; }\n.nc {\n  position:absolute;\n  background:rgba(255,252,248,.95);\n  border:1px solid rgba(210,175,155,.3);\n  padding:.4vw .65vw; max-width:13vw;\n  box-shadow:0 4px 24px rgba(160,120,90,.08);\n  animation: ncFall var(--fall-dur) linear forwards;\n  opacity:0;\n}\n@keyframes ncFall {\n  0%   { opacity:0; transform:translateY(-120px) rotate(var(--r)); }\n  5%   { opacity:1; }\n  90%  { opacity:1; transform:translateY(var(--fall-dist)) rotate(var(--r)); }\n  100% { opacity:0; transform:translateY(var(--fall-dist)) rotate(var(--r)); }\n}\n.nc-foto { width:100%; aspect-ratio:1; object-fit:cover; display:block; margin-bottom:.5vw; border-radius:1px; }\n.nc-name {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-weight:400; font-size:clamp(6px,.7vw,10px);\n  color:#9A7055; letter-spacing:.06em; margin-bottom:.15vw;\n}\n.nc-msg {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-weight:300;\n  font-size:clamp(5px,.62vw,9px); color:#B8906A; line-height:1.55;\n}\n.nc-heart { font-size:.6vw; color:#DDB898; margin-top:.15vw; opacity:.7; }\n\n/* \u2500\u2500 MAIN LAYOUT \u2500\u2500 */\n.layout {\n  position:absolute; inset:0; z-index:5;\n  display:grid;\n  grid-template-columns: 1.1fr 1px 1fr;\n  align-items:center;\n  padding:0 7vw;\n}\n\n/* \u2500\u2500 LEFT: Flower + title \u2500\u2500 */\n.left-col {\n  display:flex; flex-direction:column;\n  align-items:center; justify-content:center;\n  padding-right:4vw; gap:0;\n}\n\n/* Flower */\n.flower-wrap {\n  width:min(34vw,56vh);\n  opacity:0; animation:fadeUp 2.5s ease forwards .3s;\n  filter:drop-shadow(0 8px 24px rgba(180,130,100,.14));\n}\n.flower-wrap svg {\n  animation:flowerSway 14s ease-in-out infinite 4s;\n  transform-origin:50% 95%;\n}\n@keyframes flowerSway {\n  0%,100% { transform:rotate(0deg) translateY(0); }\n  30%     { transform:rotate(1.2deg) translateY(-.3vw); }\n  70%     { transform:rotate(-1deg) translateY(.2vw); }\n}\n\n/* Title */\n.title-rena {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-weight:300;\n  font-size:clamp(36px,6.5vw,104px);\n  color:#8A6040; letter-spacing:.18em; line-height:1;\n  margin-top:-1vw; margin-bottom:.3vw;\n  opacity:0; animation:fadeUp 2s ease forwards 1.4s, renaBreath 12s ease-in-out infinite 8s;\n}\n@keyframes renaBreath {\n  0%,100% { letter-spacing:.18em; }\n  50%     { letter-spacing:.24em; }\n}\n.title-ozerden {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-weight:300;\n  font-size:clamp(36px,6.5vw,104px);\n  letter-spacing:.18em;\n  color:#8A6040; margin-bottom:0;\n  opacity:0; animation:fadeUp 2s ease forwards 1.9s;\n}\n.title-line {\n  width:0; height:1px;\n  background:linear-gradient(to right,transparent,#C8A888,transparent);\n  margin:.8vw 0; opacity:.6;\n  animation:lineGrow 2s ease forwards 2.4s;\n}\n@keyframes lineGrow { to { width:min(8vw,100px); } }\n.title-year {\n  font-family:'Lato',sans-serif; font-weight:300;\n  font-size:clamp(11px,1.05vw,16px); letter-spacing:.5em;\n  color:#8A6845; opacity:0; animation:fadeUp 2s ease forwards 2.8s;\n}\n\n/* \u2500\u2500 DIVIDER \u2500\u2500 */\n.div-v {\n  height:0; width:1px; align-self:center;\n  background:linear-gradient(to bottom,transparent,#C8A888 25%,#C8A888 75%,transparent);\n  opacity:.4; animation:divGrow 2.2s ease forwards 3.2s;\n}\n@keyframes divGrow { to { height:45%; } }\n\n/* \u2500\u2500 RIGHT: Typography \u2500\u2500 */\n.right-col {\n  padding-left:5vw;\n  display:flex; flex-direction:column; justify-content:center;\n}\n\n.r-top {\n  font-family:'Lato',sans-serif; font-weight:300;\n  font-size:clamp(12px,1.2vw,20px); letter-spacing:.3em;\n  color:#8A6040; opacity:0; animation:fadeUp 2s ease forwards 3.6s;\n  margin-bottom:.8vw;\n}\n.r-main {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-weight:300;\n  font-size:clamp(22px,3.8vw,62px);\n  line-height:1.1; color:#7A5535;\n  letter-spacing:.02em;\n  opacity:0; animation:fadeUp 2.2s ease forwards 4.1s, mainGlow 14s ease-in-out infinite 10s;\n  margin-bottom:.8vw;\n  text-shadow:0 2px 30px rgba(160,110,70,.12);\n  white-space:nowrap;\n}\n@keyframes mainGlow {\n  0%,100% { text-shadow:0 2px 30px rgba(160,110,70,.12); }\n  50%     { text-shadow:0 2px 50px rgba(160,110,70,.28), 0 0 80px rgba(180,130,80,.1); }\n}\n.r-line {\n  width:0; height:1px;\n  background:linear-gradient(to right,#C8A888,transparent);\n  opacity:.45; margin-bottom:1.8vw;\n  animation:lineGrow2 1.8s ease forwards 5s;\n}\n@keyframes lineGrow2 { to { width:min(5vw,64px); } }\n.r-sub {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-weight:300;\n  font-size:clamp(10px,1.1vw,18px); line-height:2;\n  color:#A88060; letter-spacing:.06em;\n  opacity:0; animation:fadeUp 2s ease forwards 5.4s;\n}\n\n/* \u2500\u2500 QR \u2500\u2500 */\n.qr-panel {\n  position:absolute; bottom:2vw; left:2.5vw; z-index:25;\n  display:flex; flex-direction:column; align-items:center; gap:.3vw;\n  opacity:0; animation:fadeUp 2s ease forwards 6.5s;\n  background:rgba(249,244,238,.9);\n  padding:.5vw .6vw .4vw;\n  backdrop-filter:blur(8px);\n  border:1px solid rgba(200,168,136,.25);\n  box-shadow:0 2px 16px rgba(160,120,80,.08);\n}\n.qr-top-deco {\n  animation: footprintBounce 4s ease-in-out infinite;\n}\n@keyframes footprintBounce {\n  0%,100% { transform:translateY(0); }\n  50%     { transform:translateY(-2px); }\n}\n.qr-frame {\n  background:#fff; padding:4px;\n  border:1px solid rgba(200,168,136,.25);\n}\n.qr-frame img { display:block; width:min(5.5vw,70px); height:min(5.5vw,70px); }\n.qr-lbl {\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-weight:300;\n  font-size:clamp(6px,.65vw,9px); letter-spacing:.06em;\n  color:rgba(168,118,96,.7); text-align:center; line-height:1.5;\n}\n\n/* \u2500\u2500 COUNTER \u2500\u2500 */\n.counter {\n  position:absolute; bottom:2.5vw; right:2.5vw; z-index:10;\n  display:flex; align-items:center; gap:.5vw;\n  opacity:0; animation:fadeUp 2s ease forwards 6.5s;\n}\n.ldot {\n  width:5px; height:5px; border-radius:50%;\n  background:#D4B090; flex-shrink:0;\n  animation:ldotPulse 3s ease-in-out infinite;\n}\n@keyframes ldotPulse { 0%,100%{opacity:1;transform:scale(1);} 50%{opacity:.3;transform:scale(.5);} }\n.ctxt {\n  font-family:'Lato',sans-serif; font-weight:100;\n  font-size:clamp(6px,.65vw,9px); letter-spacing:.3em;\n  color:rgba(168,128,96,.5);\n}\n\n/* \u2500\u2500 DEMO BTN \u2500\u2500 */\n\n\n/* \u2500\u2500 TOAST \u2500\u2500 */\n.toast {\n  position:absolute; top:5vw; left:50%; z-index:60;\n  transform:translateX(-50%); white-space:nowrap;\n  background:rgba(255,252,248,.96);\n  border:1px solid rgba(200,168,136,.28);\n  padding:.55vw 1.8vw;\n  font-family:'Cormorant Garamond',Georgia,serif;\n  font-style:italic; font-size:clamp(10px,1.05vw,16px);\n  color:#9A7050; letter-spacing:.04em;\n  box-shadow:0 2px 16px rgba(160,120,80,.07);\n  animation:toastAnim 4s ease forwards; pointer-events:none;\n}\n@keyframes toastAnim {\n  0%  { opacity:0; transform:translateX(-50%) translateY(-8px); }\n  10% { opacity:1; transform:translateX(-50%) translateY(0); }\n  78% { opacity:1; }\n  100%{ opacity:0; }\n}\n\n@keyframes fadeUp {\n  from { opacity:0; transform:translateY(10px); }\n  to   { opacity:1; transform:translateY(0); }\n}\n\n\n#footprints { position:absolute; inset:0; z-index:3; pointer-events:none; overflow:hidden; }\n.fp {\n  position:absolute;\n  font-size: clamp(14px, 1.8vw, 26px);\n  opacity:0;\n  animation: fpStep var(--dur) ease forwards var(--del);\n  transform: rotate(var(--rot));\n}\n@keyframes fpStep {\n  0%   { opacity:0;    transform:rotate(var(--rot)) scale(.6); }\n  15%  { opacity:.75;  transform:rotate(var(--rot)) scale(1); }\n  70%  { opacity:.65;  transform:rotate(var(--rot)) scale(1); }\n  100% { opacity:0;    transform:rotate(var(--rot)) scale(.8); }\n}\n\n\n";
  const bodyHtml = "<div class=\"canvas\" id=\"canvas\">\n  <div class=\"bg\"></div>\n  <div class=\"grain\"></div>\n  <div id=\"snow\"></div>\n  <div id=\"sparkles\"></div>\n  <div id=\"petals\"></div>\n  <div id=\"notes\"></div>\n\n  <div class=\"layout\">\n\n    <!-- LEFT -->\n    <div class=\"left-col\">\n\n      <!-- Large tulip / peony illustration -->\n      <div class=\"flower-wrap\">\n        <svg viewBox=\"0 0 380 420\" xmlns=\"http://www.w3.org/2000/svg\">\n          <defs>\n            <radialGradient id=\"p1\" cx=\"45%\" cy=\"30%\" r=\"65%\">\n              <stop offset=\"0%\" stop-color=\"#FDEAEA\"/>\n              <stop offset=\"40%\" stop-color=\"#F2C0C0\"/>\n              <stop offset=\"100%\" stop-color=\"#D99090\"/>\n            </radialGradient>\n            <radialGradient id=\"p2\" cx=\"55%\" cy=\"30%\" r=\"65%\">\n              <stop offset=\"0%\" stop-color=\"#FDEEF0\"/>\n              <stop offset=\"40%\" stop-color=\"#EDB8C0\"/>\n              <stop offset=\"100%\" stop-color=\"#D08898\"/>\n            </radialGradient>\n            <radialGradient id=\"p3\" cx=\"50%\" cy=\"25%\" r=\"60%\">\n              <stop offset=\"0%\" stop-color=\"#FFF0F0\"/>\n              <stop offset=\"50%\" stop-color=\"#F0C8CC\"/>\n              <stop offset=\"100%\" stop-color=\"#C88890\"/>\n            </radialGradient>\n            <radialGradient id=\"p4\" cx=\"50%\" cy=\"25%\" r=\"60%\">\n              <stop offset=\"0%\" stop-color=\"#FDE8EE\"/>\n              <stop offset=\"50%\" stop-color=\"#E8B0BC\"/>\n              <stop offset=\"100%\" stop-color=\"#C07888\"/>\n            </radialGradient>\n            <radialGradient id=\"leafG\" cx=\"30%\" cy=\"30%\" r=\"70%\">\n              <stop offset=\"0%\" stop-color=\"#C8D8A8\"/>\n              <stop offset=\"100%\" stop-color=\"#8AAA68\"/>\n            </radialGradient>\n            <radialGradient id=\"centerG\" cx=\"45%\" cy=\"35%\" r=\"60%\">\n              <stop offset=\"0%\" stop-color=\"#FFEEDD\"/>\n              <stop offset=\"100%\" stop-color=\"#E0B890\"/>\n            </radialGradient>\n            <filter id=\"petalBlur\"><feGaussianBlur stdDeviation=\".4\"/></filter>\n          </defs>\n\n          <!-- Stem -->\n          <path d=\"M190,400 Q188,340 190,280 Q192,240 190,200\" stroke=\"#9AB878\" stroke-width=\"4\" fill=\"none\" stroke-linecap=\"round\"/>\n\n          <!-- Left leaf -->\n          <path d=\"M185,320 Q150,290 120,298 Q145,310 182,328Z\" fill=\"url(#leafG)\" opacity=\".85\"/>\n          <path d=\"M185,320 Q152,296 124,300\" stroke=\"#8AAA68\" stroke-width=\".8\" fill=\"none\" opacity=\".5\"/>\n\n          <!-- Right leaf -->\n          <path d=\"M195,295 Q230,265 260,272 Q235,283 197,302Z\" fill=\"url(#leafG)\" opacity=\".8\"/>\n          <path d=\"M195,295 Q228,268 258,274\" stroke=\"#8AAA68\" stroke-width=\".8\" fill=\"none\" opacity=\".5\"/>\n\n          <!-- Small left leaf -->\n          <path d=\"M186,260 Q158,240 140,248 Q160,254 185,268Z\" fill=\"url(#leafG)\" opacity=\".65\"/>\n\n          <!-- Outer petals \u2014 bottom layer -->\n          <!-- Petal BL -->\n          <path d=\"M190,195 Q148,155 138,105 Q132,70 155,55 Q175,42 190,75 Q190,130 190,195Z\" fill=\"url(#p1)\" opacity=\".75\"/>\n          <!-- Petal BR -->\n          <path d=\"M190,195 Q232,155 242,105 Q248,70 225,55 Q205,42 190,75 Q190,130 190,195Z\" fill=\"url(#p2)\" opacity=\".75\"/>\n          <!-- Petal far left -->\n          <path d=\"M190,195 Q130,175 100,135 Q75,98 90,72 Q108,48 140,75 Q165,100 190,195Z\" fill=\"url(#p1)\" opacity=\".7\"/>\n          <!-- Petal far right -->\n          <path d=\"M190,195 Q250,175 280,135 Q305,98 290,72 Q272,48 240,75 Q215,100 190,195Z\" fill=\"url(#p2)\" opacity=\".7\"/>\n\n          <!-- Middle petals -->\n          <!-- ML -->\n          <path d=\"M190,188 Q155,148 150,100 Q148,65 170,52 Q188,42 190,80 Q190,135 190,188Z\" fill=\"url(#p3)\" opacity=\".88\"/>\n          <!-- MR -->\n          <path d=\"M190,188 Q225,148 230,100 Q232,65 210,52 Q192,42 190,80 Q190,135 190,188Z\" fill=\"url(#p4)\" opacity=\".88\"/>\n          <!-- ML2 -->\n          <path d=\"M190,185 Q148,160 138,118 Q132,85 158,70 Q178,58 190,95 Q190,140 190,185Z\" fill=\"url(#p3)\" opacity=\".82\"/>\n          <!-- MR2 -->\n          <path d=\"M190,185 Q232,160 242,118 Q248,85 222,70 Q202,58 190,95 Q190,140 190,185Z\" fill=\"url(#p4)\" opacity=\".82\"/>\n\n          <!-- Inner petals -->\n          <path d=\"M190,178 Q162,148 160,108 Q158,78 178,66 Q190,60 190,90 Q190,136 190,178Z\" fill=\"url(#p3)\"/>\n          <path d=\"M190,178 Q218,148 220,108 Q222,78 202,66 Q190,60 190,90 Q190,136 190,178Z\" fill=\"url(#p4)\"/>\n          <path d=\"M190,172 Q168,145 168,110 Q168,84 184,75 Q190,72 190,96 Q190,136 190,172Z\" fill=\"url(#p3)\" opacity=\".9\"/>\n          <path d=\"M190,172 Q212,145 212,110 Q212,84 196,75 Q190,72 190,96 Q190,136 190,172Z\" fill=\"url(#p4)\" opacity=\".9\"/>\n\n          <!-- Petal veins / highlights -->\n          <path d=\"M182,180 Q176,148 174,118 Q172,92 180,78\" stroke=\"rgba(255,235,235,.5)\" stroke-width=\"1\" fill=\"none\" stroke-linecap=\"round\"/>\n          <path d=\"M198,180 Q204,148 206,118 Q208,92 200,78\" stroke=\"rgba(255,235,235,.5)\" stroke-width=\"1\" fill=\"none\" stroke-linecap=\"round\"/>\n\n          <!-- Center -->\n          <circle cx=\"190\" cy=\"160\" r=\"22\" fill=\"url(#centerG)\"/>\n          <circle cx=\"190\" cy=\"160\" r=\"14\" fill=\"#F5DCC0\" opacity=\".8\"/>\n          <circle cx=\"188\" cy=\"157\" r=\"6\"  fill=\"rgba(255,245,235,.7)\"/>\n\n          <!-- Stamens -->\n          <g stroke=\"#C8986A\" stroke-width=\".9\" stroke-linecap=\"round\" opacity=\".7\">\n            <line x1=\"190\" y1=\"152\" x2=\"190\" y2=\"144\"/><circle cx=\"190\" cy=\"142\" r=\"2\" fill=\"#D4A870\"/>\n            <line x1=\"183\" y1=\"154\" x2=\"179\" y2=\"147\"/><circle cx=\"178\" cy=\"145\" r=\"1.8\" fill=\"#D4A870\"/>\n            <line x1=\"197\" y1=\"154\" x2=\"201\" y2=\"147\"/><circle cx=\"202\" cy=\"145\" r=\"1.8\" fill=\"#D4A870\"/>\n            <line x1=\"186\" y1=\"151\" x2=\"183\" y2=\"143\"/><circle cx=\"182\" cy=\"141\" r=\"1.5\" fill=\"#D4A870\"/>\n            <line x1=\"194\" y1=\"151\" x2=\"197\" y2=\"143\"/><circle cx=\"198\" cy=\"141\" r=\"1.5\" fill=\"#D4A870\"/>\n          </g>\n\n          <!-- Small bud left -->\n          <path d=\"M155,230 Q148,215 150,205 Q155,198 160,205 Q163,215 155,230Z\" fill=\"#EDB8C0\" opacity=\".7\"/>\n          <path d=\"M155,230 Q150,218 152,207\" stroke=\"#9AB878\" stroke-width=\"1.5\" fill=\"none\"/>\n          <line x1=\"155\" y1=\"230\" x2=\"155\" y2=\"260\" stroke=\"#9AB878\" stroke-width=\"2.5\"/>\n\n          <!-- Small bud right -->\n          <path d=\"M225,245 Q218,230 220,220 Q225,213 230,220 Q233,230 225,245Z\" fill=\"#F2C0C8\" opacity=\".65\"/>\n          <line x1=\"225\" y1=\"245\" x2=\"225\" y2=\"270\" stroke=\"#9AB878\" stroke-width=\"2\"/>\n\n        </svg>\n      </div>\n\n      <div class=\"title-rena\">Rena</div>\n      <div class=\"title-ozerden\">\u00d6zerden</div>\n      <div class=\"title-line\"></div>\n      <div class=\"title-year\">2 0 2 6</div>\n    </div>\n\n    <!-- DIVIDER -->\n    <div class=\"div-v\"></div>\n\n    <!-- RIGHT -->\n    <div class=\"right-col\">\n      \n      <div class=\"r-main\">Ho&#x15F; Geldin Rena</div>\n    </div>\n\n  </div>\n\n  <!-- QR cute baby themed -->\n  <div class=\"qr-panel\">\n\n\n    <!-- QR frame with bow on top -->\n    <div style=\"position:relative;\">\n      <!-- Tiny bow -->\n      <svg style=\"position:absolute;top:-1.4vw;left:50%;transform:translateX(-50%);width:min(4vw,48px);z-index:2;\" viewBox=\"0 0 48 20\" xmlns=\"http://www.w3.org/2000/svg\">\n        <path d=\"M24,12 Q14,4 6,6 Q2,8 4,12 Q6,16 14,14 Q20,12 24,12Z\" fill=\"#E8B8C8\" opacity=\".85\"/>\n        <path d=\"M24,12 Q34,4 42,6 Q46,8 44,12 Q42,16 34,14 Q28,12 24,12Z\" fill=\"#DDA8BC\" opacity=\".85\"/>\n        <ellipse cx=\"24\" cy=\"12\" rx=\"4\" ry=\"3.5\" fill=\"#C8889C\"/>\n        <ellipse cx=\"23\" cy=\"11\" rx=\"1.8\" ry=\"1.4\" fill=\"rgba(255,230,238,.5)\"/>\n      </svg>\n      <div class=\"qr-frame\" id=\"qrBox\"></div>\n    </div>\n\n    <!-- Bottom label -->\n    <div class=\"qr-lbl\">\n      Rena'ya not b\u0131rak \u2661\n    </div>\n  </div>\n\n  <div class=\"counter\">\n    <div class=\"ldot\"></div>\n    <div class=\"ctxt\" id=\"ct\">0 not</div>\n  </div>\n\n</div>\n\n<script>\n// \u2500\u2500 FALLING ITEMS: emzik + biberon + k\u00fc\u00e7\u00fck \u00e7i\u00e7ek \u2500\u2500\n(function(){\n  var s = document.getElementById('snow');\n\n  // Pacifier SVG\n  function pacifierSVG(size, op) {\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\" width=\"'+size+'\" height=\"'+size+'\" style=\"display:block;\">' +\n      // Shield / guard\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"rgba(232,180,190,'+op+')\" />' +\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1\"/>' +\n      // Button holes\n      '<circle cx=\"15\" cy=\"22\" r=\"2\" fill=\"rgba(255,245,245,0.6)\"/>' +\n      '<circle cx=\"25\" cy=\"22\" r=\"2\" fill=\"rgba(255,245,245,0.6)\"/>' +\n      // Nipple\n      '<ellipse cx=\"20\" cy=\"12\" rx=\"4.5\" ry=\"6\" fill=\"rgba(220,160,150,'+op*1.1+')\" />' +\n      // Ring\n      '<circle cx=\"20\" cy=\"33\" r=\"4\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1.8\"/>' +\n      '</svg>';\n  }\n\n  // Baby bottle SVG\n  function bottleSVG(size, op) {\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 42\" width=\"'+Math.round(size*.6)+'\" height=\"'+size+'\" style=\"display:block;\">' +\n      // Nipple tip\n      '<ellipse cx=\"12\" cy=\"4\"  rx=\"3\"   ry=\"3.5\" fill=\"rgba(200,160,140,'+op+')\" />' +\n      // Collar\n      '<rect x=\"8\" y=\"6\" width=\"8\" height=\"4\" rx=\"2\" fill=\"rgba(220,175,165,'+op+')\" />' +\n      // Bottle body\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"rgba(245,225,225,'+op*0.85+')\" />' +\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"none\" stroke=\"rgba(210,170,165,'+op+')\" stroke-width=\"1\"/>' +\n      // Milk level\n      '<path d=\"M4,28 C4,28 8,26 12,27 C16,28 20,26 20,26 L20,34 C20,37 17,38 12,38 C7,38 4,37 4,34 Z\" fill=\"rgba(255,240,240,'+op*0.7+')\" />' +\n      // Measurement lines\n      '<line x1=\"5\" y1=\"20\" x2=\"8\"  y2=\"20\" stroke=\"rgba(200,160,155,'+op*0.5+')\" stroke-width=\".7\"/>' +\n      '<line x1=\"5\" y1=\"24\" x2=\"8\"  y2=\"24\" stroke=\"rgba(200,160,155,'+op*0.5+')\" stroke-width=\".7\"/>' +\n      '<line x1=\"5\" y1=\"28\" x2=\"8\"  y2=\"28\" stroke=\"rgba(200,160,155,'+op*0.5+')\" stroke-width=\".7\"/>' +\n      '</svg>';\n  }\n\n  // Small flower (kept for variety)\n  function flowerSVG(size, op) {\n    var c = 'rgba(210,175,165,'+op+')';\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"'+size+'\" height=\"'+size+'\" style=\"display:block;\">' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(0,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(60,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(120,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(180,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(240,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(300,10,10)\"/>' +\n      '<circle cx=\"10\" cy=\"10\" r=\"3.5\" fill=\"rgba(245,225,215,'+op+')\" />' +\n      '</svg>';\n  }\n\n  var types = ['pacifier','bottle','flower','pacifier','bottle','flower','pacifier'];\n\n  for (var i = 0; i < 26; i++) {\n    var el  = document.createElement('div');\n    el.className = 'sp';\n    var type = types[i % types.length];\n    var sz   = 9 + Math.random() * 7;\n    var op   = (0.25 + Math.random() * 0.3).toFixed(2);\n    var dur  = 11 + Math.random() * 14;\n    var del  = -(Math.random() * 20);\n    var spin = (Math.random() - .5) * 280;\n    var sway = (Math.random() - .5) * 6;\n\n    var inner = type === 'pacifier' ? pacifierSVG(sz, op) :\n                type === 'bottle'   ? bottleSVG(sz, op)   : flowerSVG(sz, op);\n\n    el.innerHTML = inner;\n    el.style.cssText =\n      'left:' + (Math.random() * 105 - 2) + '%;' +\n      '--dur:' + dur + 's;' +\n      '--del:' + del + 's;' +\n      '--op:1;' +\n      '--spin:' + spin + 'deg;' +\n      '--sway:' + sway + 'vw;';\n    s.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 SPARKLES \u2500\u2500\n(function(){\n  var sp=document.getElementById('sparkles');\n  for(var i=0;i<18;i++){\n    var el=document.createElement('div'); el.className='sparkle';\n    var sz=.3+Math.random()*.7;\n    el.style.cssText=\n      'left:'+(5+Math.random()*90)+'%;top:'+(5+Math.random()*90)+'%;'+\n      '--dur:'+(3+Math.random()*4)+'s;'+\n      '--del:-'+(Math.random()*6)+'s;'+\n      '--op:'+(0.3+Math.random()*.4)+';';\n    el.innerHTML='<svg width=\"'+(sz*12)+'px\" height=\"'+(sz*12)+'px\" viewBox=\"0 0 12 12\"><path d=\"M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z\" fill=\"rgba(190,155,110,'+(0.35+Math.random()*.3)+')\"/></svg>';\n    sp.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 CLICK BLOOM \u2500\u2500\nvar COLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8','#F5E0E0'];\nfunction bloom(x,y){\n  var b=document.createElement('div');b.className='burst';\n  b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;';\n  for(var i=0;i<16;i++){\n    var p=document.createElement('div');p.className='petal';\n    var ang=(Math.PI*2/16)*i,dist=25+Math.random()*30,s=4+Math.random()*5;\n    p.style.cssText='width:'+s+'px;height:'+s+'px;background:'+COLS[i%6]+';left:0;top:0;'+\n      '--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;'+\n      '--dur:'+(1+Math.random()*.5)+'s;'+\n      'animation-delay:'+(Math.random()*.08)+'s;';\n    b.appendChild(p);\n  }\n  document.getElementById('petals').appendChild(b);\n  setTimeout(function(){if(b.parentNode)b.remove();},1800);\n}\ndocument.getElementById('canvas').addEventListener('click',function(e){\n\n  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();\n  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));\n});\n\n// \u2500\u2500 NOTES \u2014 falling stream \u2500\u2500\nvar count = 0;\n\n// Column system: divide right half into 5 columns\nvar _cols = [\n  { left: 56, active: false },\n  { left: 64, active: false },\n  { left: 72, active: false },\n  { left: 80, active: false },\n];\n// Queue for notes waiting to fall\nvar _noteQueue = [];\nvar _fallInterval = null;\n\nfunction getFreeCol() {\n  var free = _cols.filter(function(c){ return !c.active; });\n  if (!free.length) return null;\n  return free[Math.floor(Math.random() * free.length)];\n}\n\nfunction launchNote(isim, mesaj, foto) {\n  var col = getFreeCol();\n  if (!col) {\n    _noteQueue.push({isim:isim, mesaj:mesaj, foto:foto});\n    return;\n  }\n\n  col.active = true;\n  var el = document.createElement('div');\n  el.className = 'nc';\n  var rot = (Math.random() - .5) * 2.5;\n  var fallDur = 9 + Math.random() * 7;\n\n  el.style.cssText =\n    'left:' + col.left + '%;' +\n    'top:-5%;' +\n    '--r:' + rot + 'deg;' +\n    '--fall-dist:115vh;' +\n    '--fall-dur:' + fallDur + 's;';\n\n  var fHtml = foto ? '<img class=\"nc-foto\" src=\"' + foto + '\" alt=\"\"/>' : '';\n  el.innerHTML = fHtml +\n    '<div class=\"nc-name\">' + esc(isim) + '</div>' +\n    '<div class=\"nc-msg\">' + esc(mesaj) + '</div>' +\n    '<div class=\"nc-heart\">\u2661</div>';\n\n  document.getElementById('notes').appendChild(el);\n\n  // When done \u2014 free column, relaunch same note from top (infinite loop)\n  setTimeout(function() {\n    if (el.parentNode) el.remove();\n    col.active = false;\n    // Re-queue this note to fall again\n    _noteQueue.push({isim:isim, mesaj:mesaj, foto:foto});\n    // Process queue\n    setTimeout(tryQueue, 300 + Math.random() * 800);\n  }, fallDur * 1000 + 200);\n}\n\nfunction tryQueue() {\n  if (_noteQueue.length === 0) return;\n  var col = getFreeCol();\n  if (!col) return;\n  var next = _noteQueue.shift();\n  launchNote(next.isim, next.mesaj, next.foto);\n}\n\nfunction spawnNote(isim, mesaj, foto) {\n  launchNote(isim, mesaj, foto);\n  count++; document.getElementById('ct').textContent = count + ' not';\n  var t=document.createElement('div');t.className='toast';\n  t.textContent=isim+' bir not b\u0131rakt\u0131 \u2661';\n  document.getElementById('canvas').appendChild(t);\n  setTimeout(function(){if(t.parentNode)t.remove();},4200);\n  var c=document.getElementById('canvas');bloom(c.offsetWidth*.7,c.offsetHeight*.44);\n}\n\n// \u2500\u2500 DEMO \u2500\u2500\nvar demos=[\n  {isim:'Ay\u015fe Han\u0131m',   mesaj:'Rena\\'ya uzun ve sa\u011fl\u0131kl\u0131 bir \u00f6m\u00fcr diliyorum \ud83c\udf38'},\n  {isim:'Mehmet Bey',   mesaj:'Ho\u015f geldin d\u00fcnyaya k\u00fc\u00e7\u00fck prenses!'},\n  {isim:'Zeynep & Can', mesaj:'Sen bizim en b\u00fcy\u00fck sevincimizsin \u2661'},\n  {isim:'Selin',        mesaj:'Y\u00fcz\u00fcn hep g\u00fcls\u00fcn can\u0131m Rena'},\n  {isim:'B\u00fcy\u00fckanne',    mesaj:'Torunum, g\u00f6z\u00fcm\u00fcn nuru. Ho\u015f geldin!'},\n];\nvar di=0;\ndocument.getElementById('demoBtn').addEventListener('click',function(e){\n  e.stopPropagation();\n  var n=demos[di%demos.length]; di++;\n  spawnNote(n.isim,n.mesaj,null);\n});\n\n\n\n// Force all visible after 400ms\nsetTimeout(function(){\n  var sel='.title-rena,.title-ozerden,.title-year,.r-top,.r-main,.r-sub,.r-line,.flower-wrap,.left-col,.qr-panel,.counter,.demo-btn,.div-v';\n  document.querySelectorAll(sel).forEach(function(el){\n    el.style.opacity='1';\n    el.style.transform='translateY(0)';\n  });\n},400);\n\n\n\n</script>";
  const jsCode   = "\n// \u2500\u2500 FALLING ITEMS: emzik + biberon + k\u00fc\u00e7\u00fck \u00e7i\u00e7ek \u2500\u2500\n(function(){\n  var s = document.getElementById('snow');\n\n  // Pacifier SVG\n  function pacifierSVG(size, op) {\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\" width=\"'+size+'\" height=\"'+size+'\" style=\"display:block;\">' +\n      // Shield / guard\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"rgba(232,180,190,'+op+')\" />' +\n      '<ellipse cx=\"20\" cy=\"22\" rx=\"14\" ry=\"10\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1\"/>' +\n      // Button holes\n      '<circle cx=\"15\" cy=\"22\" r=\"2\" fill=\"rgba(255,245,245,0.6)\"/>' +\n      '<circle cx=\"25\" cy=\"22\" r=\"2\" fill=\"rgba(255,245,245,0.6)\"/>' +\n      // Nipple\n      '<ellipse cx=\"20\" cy=\"12\" rx=\"4.5\" ry=\"6\" fill=\"rgba(220,160,150,'+op*1.1+')\" />' +\n      // Ring\n      '<circle cx=\"20\" cy=\"33\" r=\"4\" fill=\"none\" stroke=\"rgba(210,150,160,'+op+')\" stroke-width=\"1.8\"/>' +\n      '</svg>';\n  }\n\n  // Baby bottle SVG\n  function bottleSVG(size, op) {\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 42\" width=\"'+Math.round(size*.6)+'\" height=\"'+size+'\" style=\"display:block;\">' +\n      // Nipple tip\n      '<ellipse cx=\"12\" cy=\"4\"  rx=\"3\"   ry=\"3.5\" fill=\"rgba(200,160,140,'+op+')\" />' +\n      // Collar\n      '<rect x=\"8\" y=\"6\" width=\"8\" height=\"4\" rx=\"2\" fill=\"rgba(220,175,165,'+op+')\" />' +\n      // Bottle body\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"rgba(245,225,225,'+op*0.85+')\" />' +\n      '<path d=\"M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z\" fill=\"none\" stroke=\"rgba(210,170,165,'+op+')\" stroke-width=\"1\"/>' +\n      // Milk level\n      '<path d=\"M4,28 C4,28 8,26 12,27 C16,28 20,26 20,26 L20,34 C20,37 17,38 12,38 C7,38 4,37 4,34 Z\" fill=\"rgba(255,240,240,'+op*0.7+')\" />' +\n      // Measurement lines\n      '<line x1=\"5\" y1=\"20\" x2=\"8\"  y2=\"20\" stroke=\"rgba(200,160,155,'+op*0.5+')\" stroke-width=\".7\"/>' +\n      '<line x1=\"5\" y1=\"24\" x2=\"8\"  y2=\"24\" stroke=\"rgba(200,160,155,'+op*0.5+')\" stroke-width=\".7\"/>' +\n      '<line x1=\"5\" y1=\"28\" x2=\"8\"  y2=\"28\" stroke=\"rgba(200,160,155,'+op*0.5+')\" stroke-width=\".7\"/>' +\n      '</svg>';\n  }\n\n  // Small flower (kept for variety)\n  function flowerSVG(size, op) {\n    var c = 'rgba(210,175,165,'+op+')';\n    return '<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" width=\"'+size+'\" height=\"'+size+'\" style=\"display:block;\">' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(0,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(60,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(120,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(180,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(240,10,10)\"/>' +\n      '<ellipse cx=\"10\" cy=\"4\"  rx=\"3\" ry=\"4.5\" fill=\"'+c+'\" transform=\"rotate(300,10,10)\"/>' +\n      '<circle cx=\"10\" cy=\"10\" r=\"3.5\" fill=\"rgba(245,225,215,'+op+')\" />' +\n      '</svg>';\n  }\n\n  var types = ['pacifier','bottle','flower','pacifier','bottle','flower','pacifier'];\n\n  for (var i = 0; i < 26; i++) {\n    var el  = document.createElement('div');\n    el.className = 'sp';\n    var type = types[i % types.length];\n    var sz   = 9 + Math.random() * 7;\n    var op   = (0.25 + Math.random() * 0.3).toFixed(2);\n    var dur  = 11 + Math.random() * 14;\n    var del  = -(Math.random() * 20);\n    var spin = (Math.random() - .5) * 280;\n    var sway = (Math.random() - .5) * 6;\n\n    var inner = type === 'pacifier' ? pacifierSVG(sz, op) :\n                type === 'bottle'   ? bottleSVG(sz, op)   : flowerSVG(sz, op);\n\n    el.innerHTML = inner;\n    el.style.cssText =\n      'left:' + (Math.random() * 105 - 2) + '%;' +\n      '--dur:' + dur + 's;' +\n      '--del:' + del + 's;' +\n      '--op:1;' +\n      '--spin:' + spin + 'deg;' +\n      '--sway:' + sway + 'vw;';\n    s.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 SPARKLES \u2500\u2500\n(function(){\n  var sp=document.getElementById('sparkles');\n  for(var i=0;i<18;i++){\n    var el=document.createElement('div'); el.className='sparkle';\n    var sz=.3+Math.random()*.7;\n    el.style.cssText=\n      'left:'+(5+Math.random()*90)+'%;top:'+(5+Math.random()*90)+'%;'+\n      '--dur:'+(3+Math.random()*4)+'s;'+\n      '--del:-'+(Math.random()*6)+'s;'+\n      '--op:'+(0.3+Math.random()*.4)+';';\n    el.innerHTML='<svg width=\"'+(sz*12)+'px\" height=\"'+(sz*12)+'px\" viewBox=\"0 0 12 12\"><path d=\"M6 0L6.8 5.2L12 6L6.8 6.8L6 12L5.2 6.8L0 6L5.2 5.2Z\" fill=\"rgba(190,155,110,'+(0.35+Math.random()*.3)+')\"/></svg>';\n    sp.appendChild(el);\n  }\n})();\n\n// \u2500\u2500 CLICK BLOOM \u2500\u2500\nvar COLS=['#F2C8C8','#E8B0B8','#F8D8D8','#EEC0C4','#DDA8A8','#F5E0E0'];\nfunction bloom(x,y){\n  var b=document.createElement('div');b.className='burst';\n  b.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;';\n  for(var i=0;i<16;i++){\n    var p=document.createElement('div');p.className='petal';\n    var ang=(Math.PI*2/16)*i,dist=25+Math.random()*30,s=4+Math.random()*5;\n    p.style.cssText='width:'+s+'px;height:'+s+'px;background:'+COLS[i%6]+';left:0;top:0;'+\n      '--tx:'+(Math.cos(ang)*dist)+'px;--ty:'+(Math.sin(ang)*dist)+'px;'+\n      '--dur:'+(1+Math.random()*.5)+'s;'+\n      'animation-delay:'+(Math.random()*.08)+'s;';\n    b.appendChild(p);\n  }\n  document.getElementById('petals').appendChild(b);\n  setTimeout(function(){if(b.parentNode)b.remove();},1800);\n}\ndocument.getElementById('canvas').addEventListener('click',function(e){\n\n  var c=document.getElementById('canvas'),r=c.getBoundingClientRect();\n  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));\n});\n\n// \u2500\u2500 NOTES \u2014 falling stream \u2500\u2500\nvar count = 0;\n\n// Column system: divide right half into 5 columns\nvar _cols = [\n  { left: 56, active: false },\n  { left: 64, active: false },\n  { left: 72, active: false },\n  { left: 80, active: false },\n];\n// Queue for notes waiting to fall\nvar _noteQueue = [];\nvar _fallInterval = null;\n\nfunction getFreeCol() {\n  var free = _cols.filter(function(c){ return !c.active; });\n  if (!free.length) return null;\n  return free[Math.floor(Math.random() * free.length)];\n}\n\nfunction launchNote(isim, mesaj, foto) {\n  var col = getFreeCol();\n  if (!col) {\n    _noteQueue.push({isim:isim, mesaj:mesaj, foto:foto});\n    return;\n  }\n\n  col.active = true;\n  var el = document.createElement('div');\n  el.className = 'nc';\n  var rot = (Math.random() - .5) * 2.5;\n  var fallDur = 9 + Math.random() * 7;\n\n  el.style.cssText =\n    'left:' + col.left + '%;' +\n    'top:-5%;' +\n    '--r:' + rot + 'deg;' +\n    '--fall-dist:115vh;' +\n    '--fall-dur:' + fallDur + 's;';\n\n  var fHtml = foto ? '<img class=\"nc-foto\" src=\"' + foto + '\" alt=\"\"/>' : '';\n  el.innerHTML = fHtml +\n    '<div class=\"nc-name\">' + esc(isim) + '</div>' +\n    '<div class=\"nc-msg\">' + esc(mesaj) + '</div>' +\n    '<div class=\"nc-heart\">\u2661</div>';\n\n  document.getElementById('notes').appendChild(el);\n\n  // When done \u2014 free column, relaunch same note from top (infinite loop)\n  setTimeout(function() {\n    if (el.parentNode) el.remove();\n    col.active = false;\n    // Re-queue this note to fall again\n    _noteQueue.push({isim:isim, mesaj:mesaj, foto:foto});\n    // Process queue\n    setTimeout(tryQueue, 300 + Math.random() * 800);\n  }, fallDur * 1000 + 200);\n}\n\nfunction tryQueue() {\n  if (_noteQueue.length === 0) return;\n  var col = getFreeCol();\n  if (!col) return;\n  var next = _noteQueue.shift();\n  launchNote(next.isim, next.mesaj, next.foto);\n}\n\nfunction spawnNote(isim, mesaj, foto) {\n  launchNote(isim, mesaj, foto);\n  count++; document.getElementById('ct').textContent = count + ' not';\n  var t=document.createElement('div');t.className='toast';\n  t.textContent=isim+' bir not b\u0131rakt\u0131 \u2661';\n  document.getElementById('canvas').appendChild(t);\n  setTimeout(function(){if(t.parentNode)t.remove();},4200);\n  var c=document.getElementById('canvas');bloom(c.offsetWidth*.7,c.offsetHeight*.44);\n}\n\n// \u2500\u2500 DEMO \u2500\u2500\nvar demos=[\n  {isim:'Ay\u015fe Han\u0131m',   mesaj:'Rena\\'ya uzun ve sa\u011fl\u0131kl\u0131 bir \u00f6m\u00fcr diliyorum \ud83c\udf38'},\n  {isim:'Mehmet Bey',   mesaj:'Ho\u015f geldin d\u00fcnyaya k\u00fc\u00e7\u00fck prenses!'},\n  {isim:'Zeynep & Can', mesaj:'Sen bizim en b\u00fcy\u00fck sevincimizsin \u2661'},\n  {isim:'Selin',        mesaj:'Y\u00fcz\u00fcn hep g\u00fcls\u00fcn can\u0131m Rena'},\n  {isim:'B\u00fcy\u00fckanne',    mesaj:'Torunum, g\u00f6z\u00fcm\u00fcn nuru. Ho\u015f geldin!'},\n];\nvar di=0;\ndocument.getElementById('demoBtn').addEventListener('click',function(e){\n  e.stopPropagation();\n  var n=demos[di%demos.length]; di++;\n  spawnNote(n.isim,n.mesaj,null);\n});\n\n\n\n// Force all visible after 400ms\nsetTimeout(function(){\n  var sel='.title-rena,.title-ozerden,.title-year,.r-top,.r-main,.r-sub,.r-line,.flower-wrap,.left-col,.qr-panel,.counter,.demo-btn,.div-v';\n  document.querySelectorAll(sel).forEach(function(el){\n    el.style.opacity='1';\n    el.style.transform='translateY(0)';\n  });\n},400);\n\n\n\n\n\n(function() {\n  function foot(flip) {\n    var s = document.createElementNS('http://www.w3.org/2000/svg','svg');\n    s.setAttribute('viewBox','0 0 32 36');\n    s.setAttribute('width','12');\n    s.setAttribute('height','13');\n    var ns = 'http://www.w3.org/2000/svg';\n    var g = document.createElementNS(ns,'g');\n    if(flip) g.setAttribute('transform','scale(-1,1) translate(-32,0)');\n\n    // Palm \u2014 chubby baby palm shape\n    var palm = document.createElementNS(ns,'path');\n    palm.setAttribute('d',\n      'M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 ' +\n      'C6,13 7,12 9,12 C11,12 13,12 15,13 ' +\n      'C17,12 19,12 21,13 C23,12 25,13 26,15 ' +\n      'C27,17 28,19 28,23 C29,27 28,31 25,32 Z'\n    );\n    palm.setAttribute('fill','#C8A090');\n    palm.setAttribute('opacity','0.42');\n    g.appendChild(palm);\n\n    // Palm crease line\n    var crease = document.createElementNS(ns,'path');\n    crease.setAttribute('d','M5,22 C10,20 18,20 27,22');\n    crease.setAttribute('stroke','#B08070');\n    crease.setAttribute('stroke-width','0.7');\n    crease.setAttribute('fill','none');\n    crease.setAttribute('opacity','0.18');\n    g.appendChild(crease);\n\n    // Fingers \u2014 4 chubby baby fingers (thumb hidden when crawling)\n    var fingers = [\n      {cx:7,  cy:8,  rx:2.8, ry:3.2},\n      {cx:12, cy:6,  rx:2.6, ry:3.4},\n      {cx:18, cy:6,  rx:2.6, ry:3.4},\n      {cx:23, cy:7.5,rx:2.4, ry:3.1},\n    ];\n    fingers.forEach(function(f) {\n      // Finger body\n      var e = document.createElementNS(ns,'ellipse');\n      e.setAttribute('cx', f.cx); e.setAttribute('cy', f.cy);\n      e.setAttribute('rx', f.rx); e.setAttribute('ry', f.ry);\n      e.setAttribute('fill','#C8A090');\n      e.setAttribute('opacity','0.40');\n      g.appendChild(e);\n      // Knuckle crease\n      var k = document.createElementNS(ns,'path');\n      k.setAttribute('d','M'+(f.cx-f.rx*.6)+','+(f.cy+f.ry*.2)+' Q'+f.cx+','+(f.cy+f.ry*.4)+' '+(f.cx+f.rx*.6)+','+(f.cy+f.ry*.2));\n      k.setAttribute('stroke','#B08070');\n      k.setAttribute('stroke-width','0.5');\n      k.setAttribute('fill','none');\n      k.setAttribute('opacity','0.2');\n      g.appendChild(k);\n      // Tiny nail\n      var n = document.createElementNS(ns,'ellipse');\n      n.setAttribute('cx', f.cx); n.setAttribute('cy', f.cy - f.ry*0.55);\n      n.setAttribute('rx', f.rx*0.6); n.setAttribute('ry', f.ry*0.28);\n      n.setAttribute('fill','rgba(255,240,235,0.4)');\n      g.appendChild(n);\n    });\n\n    // Thumb \u2014 peeking from side\n    var thumb = document.createElementNS(ns,'ellipse');\n    thumb.setAttribute('cx','3'); thumb.setAttribute('cy','18');\n    thumb.setAttribute('rx','2.2'); thumb.setAttribute('ry','3.5');\n    thumb.setAttribute('fill','#C8A090');\n    thumb.setAttribute('opacity','0.35');\n    thumb.setAttribute('transform','rotate(-25,3,18)');\n    g.appendChild(thumb);\n\n    s.appendChild(g);\n    return s;\n  }\n\n  function walk() {\n    var ov = document.getElementById('fp-overlay');\n    var W  = window.innerWidth;\n    var H  = window.innerHeight;\n\n    // Start position and direction\n    var sx  = 0.08 + Math.random() * 0.78;\n    var sy  = 0.12 + Math.random() * 0.68;\n    var ang = (-15 + Math.random() * 30) * Math.PI / 180;\n    var stride = 0.05 + Math.random() * 0.02;\n\n    for (var i = 0; i < 5; i++) {\n      (function(idx) {\n        var right = idx % 2 === 0;\n        var perp  = ang + Math.PI / 2;\n        var lat   = right ? 0.022 : -0.022;\n        var px    = (sx + Math.cos(ang) * stride * idx + Math.cos(perp) * lat) * W;\n        var py    = (sy + Math.sin(ang) * stride * idx + Math.sin(perp) * lat) * H;\n        var rot   = (ang * 180 / Math.PI) + (right ? 8 : -8);\n\n        setTimeout(function() {\n          var wrap = document.createElement('div');\n          wrap.style.cssText =\n            'position:absolute;' +\n            'left:' + px + 'px;' +\n            'top:'  + py + 'px;' +\n            'transform:rotate(' + rot + 'deg);' +\n            'opacity:0;' +\n            'transition:opacity 0.5s ease;';\n          wrap.appendChild(foot(!right));\n          ov.appendChild(wrap);\n\n          requestAnimationFrame(function(){ requestAnimationFrame(function(){\n            wrap.style.opacity = '0.65';\n          }); });\n\n          setTimeout(function(){\n            wrap.style.transition = 'opacity 1.8s ease';\n            wrap.style.opacity = '0';\n            setTimeout(function(){ if(wrap.parentNode) wrap.remove(); }, 1900);\n          }, 3500);\n\n        }, idx * 400);\n      })(i);\n    }\n  }\n\n  setTimeout(function(){\n    walk();\n    setInterval(walk, 5000 + Math.random() * 3000);\n  }, 1500);\n})();\n\n\n(function(){\n  var target = document.getElementById('qrBox');\n  if (!target) return;\n  // Use current host /not as the URL\n  var url = location.protocol + '//' + location.host + '/not';\n  new QRCode(target, {\n    text: url,\n    width: 80, height: 80,\n    colorDark: '#1A0A00',\n    colorLight: '#FFFFFF',\n    correctLevel: QRCode.CorrectLevel.H\n  });\n  setTimeout(function(){\n    var img = target.querySelector('img') || target.querySelector('canvas');\n    if (img) { img.style.display='block'; img.style.width='min(4.5vw,58px)'; img.style.height='min(4.5vw,58px)'; }\n  }, 300);\n})();\n";
  const fpBlock  = "<!-- FOOTPRINT OVERLAY - fixed, outside canvas -->\n<div id=\"fp-overlay\" style=\"position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;\"></div>\n\n<script>\n(function() {\n  function foot(flip) {\n    var s = document.createElementNS('http://www.w3.org/2000/svg','svg');\n    s.setAttribute('viewBox','0 0 32 36');\n    s.setAttribute('width','12');\n    s.setAttribute('height','13');\n    var ns = 'http://www.w3.org/2000/svg';\n    var g = document.createElementNS(ns,'g');\n    if(flip) g.setAttribute('transform','scale(-1,1) translate(-32,0)');\n\n    // Palm \u2014 chubby baby palm shape\n    var palm = document.createElementNS(ns,'path');\n    palm.setAttribute('d',\n      'M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 ' +\n      'C6,13 7,12 9,12 C11,12 13,12 15,13 ' +\n      'C17,12 19,12 21,13 C23,12 25,13 26,15 ' +\n      'C27,17 28,19 28,23 C29,27 28,31 25,32 Z'\n    );\n    palm.setAttribute('fill','#C8A090');\n    palm.setAttribute('opacity','0.42');\n    g.appendChild(palm);\n\n    // Palm crease line\n    var crease = document.createElementNS(ns,'path');\n    crease.setAttribute('d','M5,22 C10,20 18,20 27,22');\n    crease.setAttribute('stroke','#B08070');\n    crease.setAttribute('stroke-width','0.7');\n    crease.setAttribute('fill','none');\n    crease.setAttribute('opacity','0.18');\n    g.appendChild(crease);\n\n    // Fingers \u2014 4 chubby baby fingers (thumb hidden when crawling)\n    var fingers = [\n      {cx:7,  cy:8,  rx:2.8, ry:3.2},\n      {cx:12, cy:6,  rx:2.6, ry:3.4},\n      {cx:18, cy:6,  rx:2.6, ry:3.4},\n      {cx:23, cy:7.5,rx:2.4, ry:3.1},\n    ];\n    fingers.forEach(function(f) {\n      // Finger body\n      var e = document.createElementNS(ns,'ellipse');\n      e.setAttribute('cx', f.cx); e.setAttribute('cy', f.cy);\n      e.setAttribute('rx', f.rx); e.setAttribute('ry', f.ry);\n      e.setAttribute('fill','#C8A090');\n      e.setAttribute('opacity','0.40');\n      g.appendChild(e);\n      // Knuckle crease\n      var k = document.createElementNS(ns,'path');\n      k.setAttribute('d','M'+(f.cx-f.rx*.6)+','+(f.cy+f.ry*.2)+' Q'+f.cx+','+(f.cy+f.ry*.4)+' '+(f.cx+f.rx*.6)+','+(f.cy+f.ry*.2));\n      k.setAttribute('stroke','#B08070');\n      k.setAttribute('stroke-width','0.5');\n      k.setAttribute('fill','none');\n      k.setAttribute('opacity','0.2');\n      g.appendChild(k);\n      // Tiny nail\n      var n = document.createElementNS(ns,'ellipse');\n      n.setAttribute('cx', f.cx); n.setAttribute('cy', f.cy - f.ry*0.55);\n      n.setAttribute('rx', f.rx*0.6); n.setAttribute('ry', f.ry*0.28);\n      n.setAttribute('fill','rgba(255,240,235,0.4)');\n      g.appendChild(n);\n    });\n\n    // Thumb \u2014 peeking from side\n    var thumb = document.createElementNS(ns,'ellipse');\n    thumb.setAttribute('cx','3'); thumb.setAttribute('cy','18');\n    thumb.setAttribute('rx','2.2'); thumb.setAttribute('ry','3.5');\n    thumb.setAttribute('fill','#C8A090');\n    thumb.setAttribute('opacity','0.35');\n    thumb.setAttribute('transform','rotate(-25,3,18)');\n    g.appendChild(thumb);\n\n    s.appendChild(g);\n    return s;\n  }\n\n  function walk() {\n    var ov = document.getElementById('fp-overlay');\n    var W  = window.innerWidth;\n    var H  = window.innerHeight;\n\n    // Start position and direction\n    var sx  = 0.08 + Math.random() * 0.78;\n    var sy  = 0.12 + Math.random() * 0.68;\n    var ang = (-15 + Math.random() * 30) * Math.PI / 180;\n    var stride = 0.05 + Math.random() * 0.02;\n\n    for (var i = 0; i < 5; i++) {\n      (function(idx) {\n        var right = idx % 2 === 0;\n        var perp  = ang + Math.PI / 2;\n        var lat   = right ? 0.022 : -0.022;\n        var px    = (sx + Math.cos(ang) * stride * idx + Math.cos(perp) * lat) * W;\n        var py    = (sy + Math.sin(ang) * stride * idx + Math.sin(perp) * lat) * H;\n        var rot   = (ang * 180 / Math.PI) + (right ? 8 : -8);\n\n        setTimeout(function() {\n          var wrap = document.createElement('div');\n          wrap.style.cssText =\n            'position:absolute;' +\n            'left:' + px + 'px;' +\n            'top:'  + py + 'px;' +\n            'transform:rotate(' + rot + 'deg);' +\n            'opacity:0;' +\n            'transition:opacity 0.5s ease;';\n          wrap.appendChild(foot(!right));\n          ov.appendChild(wrap);\n\n          requestAnimationFrame(function(){ requestAnimationFrame(function(){\n            wrap.style.opacity = '0.65';\n          }); });\n\n          setTimeout(function(){\n            wrap.style.transition = 'opacity 1.8s ease';\n            wrap.style.opacity = '0';\n            setTimeout(function(){ if(wrap.parentNode) wrap.remove(); }, 1900);\n          }, 3500);\n\n        }, idx * 400);\n      })(i);\n    }\n  }\n\n  setTimeout(function(){\n    walk();\n    setInterval(walk, 5000 + Math.random() * 3000);\n  }, 1500);\n})();\n</script>\n\n\n";

  const wsScript = `<script>
  // Safe esc function for WebSocket context
  function esc(str){ var d=document.createElement('div'); d.textContent=str||''; return d.innerHTML; }

  function connect(){
    var proto=location.protocol==='https:'?'wss:':'ws:';
    var ws=new WebSocket(proto+'//'+location.host);
    ws.onmessage=function(e){
      try {
        var msg=JSON.parse(e.data);
        if(msg.type==='init'){
          if(!window._gUsed)window._gUsed=[];
          if(!window._noteQueue)window._noteQueue=[];
          msg.dilekler.forEach(function(d){ if(typeof spawnNote==='function') spawnNote(d.isim,d.mesaj,d.foto); });
          if(typeof count!=='undefined'){ count=msg.dilekler.length; }
          var ct=document.getElementById('ct'); if(ct) ct.textContent=(msg.dilekler.length)+' not';
        } else if(msg.type==='dilek'){
          if(typeof spawnNote==='function') spawnNote(msg.dilek.isim,msg.dilek.mesaj,msg.dilek.foto);
        } else if(msg.type==='clear'){
          var n=document.getElementById('notes'); if(n) n.innerHTML='';
          if(typeof count!=='undefined') count=0;
          var ct=document.getElementById('ct'); if(ct) ct.textContent='0 not';
          window._gUsed=[]; window._noteQueue=[];
        }
      } catch(err){ console.log('WS error:',err); }
    };
    ws.onclose=function(){ setTimeout(connect,3000); };
  }
  connect();
<\/script>`;

  let html = '<!DOCTYPE html>\n<html lang="tr">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta name="color-scheme" content="light only">\n' +
    '<title>Rena Özerden</title>\n' +
    '<style>' + style + '</style>\n' +
    '</head>\n<body>\n' +
    bodyHtml + '\n' +
    '<script>' + jsCode + '<\/script>\n' +
    wsScript + '\n' +
    fpBlock +
    '</body>\n</html>';

  // Inject real QR into qrBox div
  html = html.replace('<div class=\"qr-frame\" id=\"qrBox\"></div>',
    '<div class=\"qr-frame\" id=\"qrBox\">' + qrImgTag + '</div>');

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
  var file=this.files[0]; if(!file) return;
  var reader=new FileReader();
  reader.onload=function(e){ document.getElementById('fotoPreview').src=e.target.result; document.getElementById('fotoPreview').style.display='block'; document.getElementById('fotoPlaceholder').style.display='none'; };
  reader.readAsDataURL(file);
});
var btn=document.getElementById('sendBtn');
btn.addEventListener('click',async function(){
  var isim=document.getElementById('isim').value.trim();
  var mesaj=document.getElementById('mesaj').value.trim();
  var foto=document.getElementById('fotoInput').files[0];
  if(!isim&&!mesaj&&!foto){document.getElementById('err').style.display='block';return;}
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

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n✨  Rena Özerden\n');
  console.log('📺  TV  →  http://localhost:' + PORT);
  console.log('📱  Not →  ' + NOT_URL + '\n');
});
