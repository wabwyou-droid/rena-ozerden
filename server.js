const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const QRCode    = require('qrcode');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
const PORT   = process.env.PORT || 3000;

// Public URL (Railway bunu otomatik set eder, yoksa localhost)
const PUBLIC_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL || `http://localhost:${PORT}`;

const DILEK_URL = `${PUBLIC_URL}/dilek`;

// Dilekleri bellekte tut (sunucu yeniden başlarsa sıfırlanır — yeterli)
const dilekler = [];

function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
}

wss.on('connection', ws => {
  // Yeni TV bağlanınca mevcut dilekleri gönder
  if (dilekler.length) ws.send(JSON.stringify({ type: 'init', dilekler }));
});

app.use(express.json());

app.post('/api/dilek', (req, res) => {
  const { isim, mesaj } = req.body || {};
  if (!isim && !mesaj) return res.status(400).json({ ok: false });
  const d = {
    id:    Date.now(),
    isim:  String(isim  || 'Misafir').slice(0, 40),
    mesaj: String(mesaj || '♡').slice(0, 160),
    saat:  new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit' })
  };
  dilekler.push(d);
  broadcast({ type: 'dilek', dilek: d });
  res.json({ ok: true });
});

// ── TV EKRANI ── //
app.get('/', async (req, res) => {
  const qr = await QRCode.toDataURL(DILEK_URL, {
    width: 180, margin: 1,
    color: { dark: '#8A6A40', light: '#F5F0E8' }
  });

  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rena Özerden</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400&family=Lato:wght@100;200;300&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html{width:100%;height:100%;background:#0e0b08;}
body{width:100vw;height:100vh;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#0e0b08;}
.canvas{position:relative;width:100vw;height:56.25vw;max-height:100vh;max-width:177.78vh;overflow:hidden;background:#F5F0E8;cursor:crosshair;}
.canvas::after{content:'';position:absolute;inset:0;z-index:50;pointer-events:none;opacity:.022;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px;}
.canvas>*{position:relative;z-index:2;}
.bg-pulse{position:absolute;inset:0;z-index:0;background:#F5F0E8;animation:bgWarm 20s ease-in-out infinite;}
@keyframes bgWarm{0%,100%{background:#F5F0E8;}50%{background:#F0EAE0;}}
.ambient{position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse 55% 45% at 75% 50%,rgba(180,140,90,.07) 0%,transparent 70%),
             radial-gradient(ellipse 40% 60% at 25% 50%,rgba(160,120,80,.05) 0%,transparent 70%);
  animation:ambientShift 22s ease-in-out infinite;}
@keyframes ambientShift{0%,100%{opacity:1;}50%{opacity:.6;}}
#particles{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;}
.pt{position:absolute;border-radius:50%;background:rgba(180,140,80,.5);animation:ptFloat linear infinite;}
@keyframes ptFloat{0%{transform:translateY(0) translateX(0) scale(1);opacity:0;}10%{opacity:.9;}50%{transform:translateY(var(--py)) translateX(var(--px)) scale(var(--ps));}90%{opacity:.5;}100%{transform:translateY(calc(var(--py)*2)) translateX(calc(var(--px)*.7)) scale(.4);opacity:0;}}
#flowers{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;}
.flower-burst{position:absolute;pointer-events:none;}
.petal{position:absolute;width:0;height:0;border-left:var(--pw) solid transparent;border-right:var(--pw) solid transparent;border-bottom:var(--ph) solid var(--pc);transform-origin:50% 100%;border-radius:50% 50% 0 0;animation:petalBoom 1.4s cubic-bezier(.22,1,.36,1) forwards;}
@keyframes petalBoom{0%{transform:rotate(var(--pr)) translateY(0) scale(0);opacity:1;}60%{transform:rotate(var(--pr)) translateY(var(--pd)) scale(1.1);opacity:.9;}100%{transform:rotate(var(--pr)) translateY(calc(var(--pd)*1.6)) scale(.6);opacity:0;}}
.center-dot{position:absolute;width:8px;height:8px;border-radius:50%;background:#F0C060;transform:translate(-50%,-50%);animation:dotPop .8s ease forwards;}
@keyframes dotPop{0%{transform:translate(-50%,-50%) scale(0);opacity:1;}50%{transform:translate(-50%,-50%) scale(1.5);}100%{transform:translate(-50%,-50%) scale(.5);opacity:0;}}
.layout{position:absolute;inset:0;z-index:2;display:grid;grid-template-columns:1fr 1px 1.08fr;align-items:center;padding:0 7vw;}
.left-col{display:flex;align-items:center;justify-content:flex-end;padding-right:4.5vw;opacity:0;animation:fadeIn 2s ease forwards .3s;}
.botanical{width:min(30vw,55vh);}
.draw-path{fill:none;stroke:#9A7A50;stroke-linecap:round;stroke-linejoin:round;}
.sw1{stroke-width:.7;}.sw2{stroke-width:.5;}.sw3{stroke-width:.35;}
.d1{stroke-dasharray:900;stroke-dashoffset:900;animation:draw 5s ease forwards .8s;}
.d2{stroke-dasharray:700;stroke-dashoffset:700;animation:draw 4s ease forwards 1.9s;}
.d3{stroke-dasharray:600;stroke-dashoffset:600;animation:draw 3.5s ease forwards 2.6s;}
.d4{stroke-dasharray:500;stroke-dashoffset:500;animation:draw 3s ease forwards 3.2s;}
.d5{stroke-dasharray:400;stroke-dashoffset:400;animation:draw 2.5s ease forwards 3.7s;}
.d6{stroke-dasharray:300;stroke-dashoffset:300;animation:draw 2s ease forwards 4.1s;}
.d7{stroke-dasharray:200;stroke-dashoffset:200;animation:draw 1.5s ease forwards 4.4s;}
.d8{stroke-dasharray:150;stroke-dashoffset:150;animation:draw 1.2s ease forwards 4.7s;}
@keyframes draw{to{stroke-dashoffset:0;}}
.lf{opacity:0;}
.lf1{animation:lfade 3s ease forwards 5s;}.lf2{animation:lfade 3s ease forwards 5.2s;}
.lf3{animation:lfade 3s ease forwards 5.4s;}.lf4{animation:lfade 3s ease forwards 5.6s;}
.lf5{animation:lfade 3s ease forwards 5.8s;}.lf6{animation:lfade 3s ease forwards 5.9s;}
.lf7{animation:lfade 3s ease forwards 6s;}.lf8{animation:lfade 3s ease forwards 6.1s;}
@keyframes lfade{to{opacity:1;}}
.bg-inner{transform-origin:200px 400px;animation:sway 18s ease-in-out infinite 9s;}
@keyframes sway{0%,100%{transform:rotate(0deg) translateY(0);}25%{transform:rotate(.6deg) translateY(-4px);}75%{transform:rotate(-.5deg) translateY(3px);}}
.divider-v{height:0;width:1px;align-self:center;background:linear-gradient(to bottom,transparent,#B89060 25%,#B89060 75%,transparent);animation:growLine 2.5s ease forwards 6s,divPulse 12s ease-in-out infinite 12s;}
@keyframes growLine{to{height:42%;opacity:.45;}}
@keyframes divPulse{0%,100%{opacity:.45;}50%{opacity:.18;}}
.right-col{padding-left:5.5vw;display:flex;flex-direction:column;justify-content:center;}
.name-rena{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(58px,9vw,140px);line-height:.88;color:#8A6A40;letter-spacing:.04em;opacity:0;clip-path:inset(0 100% 0 0);animation:revealName 1.8s cubic-bezier(.76,0,.24,1) forwards 6.6s,nameBreath 14s ease-in-out infinite 13s;margin-bottom:.5vw;}
@keyframes revealName{0%{clip-path:inset(0 100% 0 0);opacity:1;}100%{clip-path:inset(0 0% 0 0);opacity:1;}}
@keyframes nameBreath{0%,100%{letter-spacing:.04em;}50%{letter-spacing:.08em;}}
.name-ozerden{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(14px,2vw,32px);letter-spacing:.52em;text-transform:uppercase;color:#8A6A40;opacity:0;animation:fadeUp 2s ease forwards 7.8s,subBreath 14s ease-in-out infinite 14s;margin-bottom:2.8vw;}
@keyframes subBreath{0%,100%{letter-spacing:.52em;}50%{letter-spacing:.62em;opacity:.75;}}
.rule{width:0;height:1px;background:linear-gradient(to right,#B89060,transparent);opacity:.5;margin-bottom:2.5vw;animation:growH 2s ease forwards 7.4s;}
@keyframes growH{to{width:min(7vw,96px);}}
.label-year{font-family:'Cormorant Garamond',serif;font-weight:300;font-size:clamp(9px,.9vw,13px);letter-spacing:.6em;text-transform:uppercase;color:#B89060;opacity:0;animation:fadeUp 2s ease forwards 8s;margin-bottom:3vw;}
.label-msg{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(12px,1.3vw,20px);color:#9A8060;letter-spacing:.05em;line-height:2;opacity:0;animation:fadeUp 2s ease forwards 8.6s;}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.corner{position:absolute;z-index:3;width:3vw;height:3vw;opacity:0;animation:fadeIn 1.5s ease forwards 8.8s,cornerBreath 12s ease-in-out infinite 12s;}
.corner.tl{top:3vw;left:3vw;border-top:1px solid #B89060;border-left:1px solid #B89060;}
.corner.tr{top:3vw;right:3vw;border-top:1px solid #B89060;border-right:1px solid #B89060;}
.corner.bl{bottom:3vw;left:3vw;border-bottom:1px solid #B89060;border-left:1px solid #B89060;}
.corner.br{bottom:3vw;right:3vw;border-bottom:1px solid #B89060;border-right:1px solid #B89060;}
@keyframes cornerBreath{0%,100%{opacity:1;border-color:#B89060;}50%{opacity:.3;border-color:#D4AA78;}}
#wishes{position:absolute;inset:0;z-index:20;pointer-events:none;overflow:hidden;}
.wish-card{position:absolute;background:rgba(255,252,246,.92);border:1px solid rgba(184,144,96,.28);border-radius:2px;padding:1.2vw 1.6vw;max-width:22vw;box-shadow:0 4px 24px rgba(160,120,60,.1);backdrop-filter:blur(4px);animation:wishAppear 1.4s cubic-bezier(.22,1,.36,1) forwards,wishDrift var(--dd) ease-in-out infinite var(--ddelay);pointer-events:none;opacity:0;}
@keyframes wishAppear{0%{opacity:0;transform:translateY(12px) rotate(var(--rot)) scale(.88);}100%{opacity:1;transform:translateY(0) rotate(var(--rot)) scale(1);}}
@keyframes wishDrift{0%{transform:translate(0,0) rotate(var(--rot));}25%{transform:translate(var(--dx1),var(--dy1)) rotate(calc(var(--rot) + var(--dr1)));}50%{transform:translate(var(--dx2),var(--dy2)) rotate(calc(var(--rot) - var(--dr2)));}75%{transform:translate(var(--dx3),var(--dy3)) rotate(calc(var(--rot) + var(--dr3)));}100%{transform:translate(0,0) rotate(var(--rot));}}
.wish-name{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:clamp(10px,1.1vw,16px);color:#9A7A50;letter-spacing:.08em;margin-bottom:.4vw;}
.wish-text{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(9px,.95vw,14px);color:#7A6040;line-height:1.6;}
.wish-heart{font-size:.7vw;color:#C4956A;margin-top:.5vw;opacity:.6;}
/* QR */
.qr-panel{position:absolute;bottom:3.2vw;left:4vw;z-index:40;display:flex;align-items:center;gap:1.2vw;opacity:0;animation:fadeIn 2s ease forwards 10s;}
.qr-wrap{background:#F5F0E8;padding:6px;border:1px solid rgba(184,144,96,.3);}
.qr-wrap img{display:block;width:min(5.5vw,70px);height:min(5.5vw,70px);}
.qr-label{font-family:'Lato',sans-serif;font-weight:100;font-size:clamp(6px,.65vw,9px);letter-spacing:.35em;text-transform:uppercase;color:rgba(184,144,96,.6);line-height:2;}
/* Counter */
.counter{position:absolute;bottom:3.8vw;right:4vw;z-index:40;text-align:right;opacity:0;animation:fadeIn 2s ease forwards 10s;}
.live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#C4956A;animation:livePulse 2s ease-in-out infinite;margin-right:.5vw;vertical-align:middle;}
@keyframes livePulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.3;transform:scale(.6);}}
.counter-text{font-family:'Lato',sans-serif;font-weight:100;font-size:clamp(7px,.75vw,10px);letter-spacing:.4em;text-transform:uppercase;color:rgba(184,144,96,.55);}
/* Toast */
.toast{position:absolute;top:5vw;left:50%;transform:translateX(-50%);z-index:60;white-space:nowrap;background:rgba(255,252,246,.95);border:1px solid rgba(184,144,96,.28);padding:.7vw 2vw;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(10px,1.1vw,16px);color:#8A6A40;letter-spacing:.05em;animation:toastAnim 4s ease forwards;pointer-events:none;}
@keyframes toastAnim{0%{opacity:0;transform:translateX(-50%) translateY(-8px);}12%{opacity:1;transform:translateX(-50%) translateY(0);}78%{opacity:1;}100%{opacity:0;}}
</style>
</head>
<body>
<div class="canvas" id="canvas">
  <div class="bg-pulse"></div>
  <div class="ambient"></div>
  <div id="particles"></div>
  <div id="flowers"></div>
  <div id="wishes"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div class="layout">
    <div class="left-col">
      <div class="botanical">
        <svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg">
          <g class="bg-inner">
            <path class="lf lf1" d="M200,330 Q155,275 115,290 Q155,300 200,330Z" fill="#B8A070" opacity=".14"/>
            <path class="lf lf2" d="M200,330 Q145,350 130,385 Q165,360 200,330Z" fill="#B8A070" opacity=".14"/>
            <path class="lf lf3" d="M200,330 Q248,275 285,290 Q248,300 200,330Z" fill="#B8A070" opacity=".14"/>
            <path class="lf lf4" d="M200,330 Q255,350 270,385 Q235,360 200,330Z" fill="#B8A070" opacity=".14"/>
            <path class="lf lf5" d="M178,250 Q135,205 108,218 Q138,225 178,250Z" fill="#B8A070" opacity=".11"/>
            <path class="lf lf6" d="M222,250 Q265,205 292,218 Q262,225 222,250Z" fill="#B8A070" opacity=".11"/>
            <path class="lf lf7" d="M185,168 Q155,132 138,143 Q162,150 185,168Z" fill="#B8A070" opacity=".10"/>
            <path class="lf lf8" d="M215,168 Q245,132 262,143 Q238,150 215,168Z" fill="#B8A070" opacity=".10"/>
            <path class="draw-path sw1 d1" d="M200,490 Q200,410 200,330 Q200,245 200,165 Q200,120 200,85"/>
            <path class="draw-path sw1 d2" d="M200,390 Q168,360 142,344 Q122,332 114,337 M142,344 Q132,366 126,382 Q120,392 122,400"/>
            <path class="draw-path sw1 d2" d="M200,390 Q232,360 258,344 Q278,332 286,337 M258,344 Q268,366 274,382 Q280,392 278,400"/>
            <path class="draw-path sw1 d3" d="M196,305 Q164,276 138,262 Q116,250 108,256 M138,262 Q126,282 120,296"/>
            <path class="draw-path sw1 d3" d="M204,305 Q236,276 262,262 Q284,250 292,256 M262,262 Q274,282 280,296"/>
            <path class="draw-path sw2 d4" d="M193,222 Q164,198 144,186 Q128,178 122,184 M144,186 Q136,202 132,214"/>
            <path class="draw-path sw2 d4" d="M207,222 Q236,198 256,186 Q272,178 278,184 M256,186 Q264,202 268,214"/>
            <path class="draw-path sw2 d5" d="M196,155 Q174,130 158,120 Q146,112 144,118 M158,120 Q152,134 150,145"/>
            <path class="draw-path sw2 d5" d="M204,155 Q226,130 242,120 Q254,112 256,118 M242,120 Q248,134 250,145"/>
            <path class="draw-path sw2 d6" d="M200,85 Q190,68 184,58 Q191,68 200,74 M200,85 Q210,68 216,58 Q209,68 200,74 M200,74 Q193,58 189,46 Q196,58 200,62 M200,74 Q207,58 211,46 Q204,58 200,62 M200,62 Q200,46 200,36"/>
            <path class="draw-path sw3 d7" d="M126,348 Q114,340 107,333 Q116,337 126,348 M126,348 Q118,357 112,363 Q118,354 126,348 M274,348 Q286,340 293,333 Q284,337 274,348 M274,348 Q282,357 288,363 Q282,354 274,348"/>
            <path class="draw-path sw3 d8" d="M118,256 Q106,248 100,242 Q108,246 118,256 M118,256 Q110,264 104,270 Q110,261 118,256 M282,256 Q294,248 300,242 Q292,246 282,256 M282,256 Q290,264 296,270 Q290,261 282,256"/>
            <circle class="lf lf1" cx="114" cy="337" r="2.5" fill="#9A7A50" opacity=".75"/>
            <circle class="lf lf2" cx="286" cy="337" r="2.5" fill="#9A7A50" opacity=".75"/>
            <circle class="lf lf3" cx="108" cy="256" r="2" fill="#9A7A50" opacity=".65"/>
            <circle class="lf lf4" cx="292" cy="256" r="2" fill="#9A7A50" opacity=".65"/>
            <circle class="lf lf5" cx="122" cy="184" r="1.8" fill="#9A7A50" opacity=".6"/>
            <circle class="lf lf6" cx="278" cy="184" r="1.8" fill="#9A7A50" opacity=".6"/>
            <circle class="lf lf7" cx="144" cy="118" r="1.5" fill="#9A7A50" opacity=".55"/>
            <circle class="lf lf8" cx="256" cy="118" r="1.5" fill="#9A7A50" opacity=".55"/>
            <circle class="lf lf8" cx="200" cy="36" r="3" fill="#9A7A50" opacity=".7"/>
          </g>
        </svg>
      </div>
    </div>
    <div class="divider-v"></div>
    <div class="right-col">
      <div class="name-rena">Rena</div>
      <div class="name-ozerden">Özerden</div>
      <div class="rule"></div>
      <div class="label-year">2026</div>
      <div class="label-msg">Seni çok seviyoruz.</div>
    </div>
  </div>
  <div class="qr-panel">
    <div class="qr-wrap"><img src="${qr}" alt="QR"></div>
    <div class="qr-label">QR tara<br>&amp; dilek<br>bırak ♡</div>
  </div>
  <div class="counter">
    <span class="live-dot"></span>
    <span class="counter-text" id="ct">0 dilek</span>
  </div>
</div>
<script>
// Particles
(function(){
  const c=document.getElementById('particles');
  for(let i=0;i<28;i++){
    const el=document.createElement('div');el.className='pt';
    const s=1.5+Math.random()*3;
    el.style.cssText='left:'+(10+Math.random()*80)+'%;top:'+(15+Math.random()*65)+'%;width:'+s+'px;height:'+s+'px;--px:'+((Math.random()-.5)*80)+'px;--py:'+(-40-Math.random()*80)+'px;--ps:'+(.4+Math.random()*.8)+';animation-duration:'+(12+Math.random()*18)+'s;animation-delay:'+(Math.random()*-30)+'s;box-shadow:0 0 '+(s*3)+'px rgba(180,140,80,.35);';
    c.appendChild(el);
  }
})();

const PCOLS=['#E8B8A0','#D4956A','#C8A878','#F0D0A8','#E0C090','#D8A870','#F5DDB8'];
function bloom(x,y){
  const b=document.createElement('div');b.className='flower-burst';b.style.cssText='left:'+x+'px;top:'+y+'px;position:absolute;';
  for(let i=0;i<10;i++){
    const p=document.createElement('div');p.className='petal';
    const a=36*i+(Math.random()-.5)*15,w=5+Math.random()*5,h=14+Math.random()*10;
    p.style.cssText='left:-'+(w/2)+'px;top:-'+h+'px;--pw:'+(w/2)+'px;--ph:'+h+'px;--pc:'+PCOLS[i%7]+';--pr:'+a+'deg;--pd:-'+(22+Math.random()*18)+'px;animation-delay:'+(Math.random()*.1)+'s;';
    b.appendChild(p);
  }
  const d=document.createElement('div');d.className='center-dot';b.appendChild(d);
  document.getElementById('flowers').appendChild(b);
  setTimeout(()=>b.remove(),1800);
}
document.getElementById('canvas').addEventListener('click',e=>{
  const c=document.getElementById('canvas'),r=c.getBoundingClientRect();
  bloom((e.clientX-r.left)*(c.offsetWidth/r.width),(e.clientY-r.top)*(c.offsetHeight/r.height));
});

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
let count=0;
function spawnCard(d){
  const el=document.createElement('div');el.className='wish-card';
  const side=Math.random()>.5,left=side?56+Math.random()*24:6+Math.random()*22,top=12+Math.random()*60;
  const rot=(Math.random()-.5)*4;
  el.style.cssText='left:'+left+'%;top:'+top+'%;--rot:'+rot+'deg;--dx1:'+((Math.random()-.5)*18)+'px;--dy1:'+((Math.random()-.5)*14)+'px;--dx2:'+((Math.random()-.5)*16)+'px;--dy2:'+((Math.random()-.5)*20)+'px;--dx3:'+((Math.random()-.5)*12)+'px;--dy3:'+((Math.random()-.5)*16)+'px;--dr1:'+(Math.random()*1.5).toFixed(2)+'deg;--dr2:'+(Math.random()*1.2).toFixed(2)+'deg;--dr3:'+(Math.random()*.9).toFixed(2)+'deg;--dd:'+(14+Math.random()*12).toFixed(1)+'s;--ddelay:1.2s;';
  el.innerHTML='<div class="wish-name">'+esc(d.isim)+'</div><div class="wish-text">'+esc(d.mesaj)+'</div><div class="wish-heart">— ♡ —</div>';
  document.getElementById('wishes').appendChild(el);
}
function toast(isim){
  const t=document.createElement('div');t.className='toast';t.textContent=isim+' bir dilek bıraktı ♡';
  document.getElementById('canvas').appendChild(t);setTimeout(()=>t.remove(),4100);
}

// WebSocket — auto reconnect
function connect(){
  const proto=location.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(proto+'//'+location.host);
  ws.onmessage=e=>{
    const msg=JSON.parse(e.data);
    if(msg.type==='init'){msg.dilekler.forEach(d=>{spawnCard(d);count++;});document.getElementById('ct').textContent=count+' dilek';}
    else if(msg.type==='dilek'){
      spawnCard(msg.dilek);count++;
      document.getElementById('ct').textContent=count+' dilek';
      toast(msg.dilek.isim);
      const c=document.getElementById('canvas');
      bloom(c.offsetWidth*.72,c.offsetHeight*.45);
    }
  };
  ws.onclose=()=>setTimeout(connect,3000); // auto reconnect
}
connect();
</script>
</body>
</html>`);
});

// ── MOBİL DİLEK SAYFASI ── //
app.get('/dilek', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Rena için Dilek ♡</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300;1,400&family=Lato:wght@100;200;300;400&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;min-height:100%;background:#F5F0E8;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px 24px;}
.card{width:100%;max-width:420px;background:#FEFCF8;border:1px solid rgba(184,144,96,.2);padding:40px 32px 36px;text-align:center;box-shadow:0 8px 40px rgba(120,90,40,.08);}
.logo{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:40px;color:#8A6A40;letter-spacing:.05em;margin-bottom:4px;}
.sub{font-family:'Lato',sans-serif;font-weight:200;font-size:11px;letter-spacing:.3em;color:#C4A878;margin-bottom:32px;}
.rule{width:40px;height:1px;background:rgba(184,144,96,.35);margin:0 auto 32px;}
label{display:block;text-align:left;font-family:'Lato',sans-serif;font-weight:300;font-size:12px;letter-spacing:.06em;color:#8A6A40;margin-bottom:10px;}
input,textarea{width:100%;background:transparent;border:none;border-bottom:1.5px solid rgba(184,144,96,.4);font-family:'Cormorant Garamond',serif;font-weight:400;font-size:20px;color:#3A2810;padding:10px 4px;outline:none;transition:border-color .3s;margin-bottom:28px;resize:none;-webkit-appearance:none;border-radius:0;}
input::placeholder,textarea::placeholder{color:rgba(140,100,60,.4);font-style:italic;font-size:18px;}
input:focus,textarea:focus{border-color:#B89060;}
.btn{width:100%;padding:16px;background:#B89060;border:none;font-family:'Lato',sans-serif;font-weight:300;font-size:14px;letter-spacing:.12em;color:#fff;cursor:pointer;transition:all .3s;-webkit-appearance:none;border-radius:0;}
.btn:active,.btn:hover{background:#A07848;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.success{display:none;padding:16px 0;}
.s-icon{font-size:48px;margin-bottom:18px;animation:pop .6s cubic-bezier(.22,1,.36,1);}
@keyframes pop{0%{transform:scale(0);}100%{transform:scale(1);}}
.s-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:30px;color:#8A6A40;margin-bottom:8px;}
.s-sub{font-family:'Lato',sans-serif;font-weight:200;font-size:12px;letter-spacing:.12em;color:#C4A878;}
.again{margin-top:28px;background:transparent;border:1px solid rgba(184,144,96,.3);font-family:'Lato',sans-serif;font-weight:300;font-size:13px;letter-spacing:.06em;color:#B89060;padding:12px 24px;cursor:pointer;-webkit-appearance:none;border-radius:0;}
.err{font-family:'Lato',sans-serif;font-weight:300;font-size:13px;color:#C47060;letter-spacing:.02em;margin-top:-16px;margin-bottom:16px;display:none;text-align:left;}
</style>
</head>
<body>
<div class="card">
  <div class="logo">Rena</div>
  <div class="sub">Özerden · 2026</div>
  <div class="rule"></div>
  <div id="form">
    <label>Adınız</label>
    <input type="text" id="isim" placeholder="Adınızı yazın…" maxlength="40" autocomplete="off" autocorrect="off">
    <label>Dileğiniz</label>
    <textarea id="mesaj" rows="4" placeholder="Rena'ya bir dilek bırakın…" maxlength="160"></textarea>
    <div class="err" id="err">Lütfen bir şeyler yazın.</div>
    <button class="btn" id="sendBtn">Ekrana Gönder  ♡</button>
  </div>
  <div class="success" id="success">
    <div class="s-icon">🌸</div>
    <div class="s-title">Dileğin uçtu!</div>
    <div class="s-sub">TV ekranında süzülüyor</div>
    <button class="again" id="anotherBtn">Bir dilek daha bırak</button>
  </div>
</div>
<script>
const btn=document.getElementById('sendBtn');
btn.addEventListener('click',async()=>{
  const isim=document.getElementById('isim').value.trim();
  const mesaj=document.getElementById('mesaj').value.trim();
  if(!isim&&!mesaj){document.getElementById('err').style.display='block';return;}
  document.getElementById('err').style.display='none';
  btn.disabled=true;btn.textContent='Gönderiliyor…';
  try{
    const r=await fetch('/api/dilek',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({isim,mesaj})});
    if(r.ok){document.getElementById('form').style.display='none';document.getElementById('success').style.display='block';}
    else{btn.disabled=false;btn.textContent='Ekrana Gönder  ♡';}
  }catch{btn.disabled=false;btn.textContent='Bağlantı hatası — tekrar dene';}
});
document.getElementById('anotherBtn').addEventListener('click',()=>{
  document.getElementById('isim').value='';document.getElementById('mesaj').value='';
  document.getElementById('success').style.display='none';document.getElementById('form').style.display='block';
  btn.disabled=false;btn.textContent='Ekrana Gönder  ♡';
  document.getElementById('isim').focus();
});
</script>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n✨  Rena Özerden — Canlı Dilek Sistemi\n');
  console.log('📺  TV  →  http://localhost:' + PORT);
  console.log('📱  QR  →  ' + DILEK_URL);
  console.log('\nCtrl+C ile durdur\n');
});
