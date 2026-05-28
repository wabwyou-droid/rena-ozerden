<!DOCTYPE html>
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

/* 3-COLUMN */
.layout{position:absolute;inset:0;z-index:5;display:grid;grid-template-columns:33.33% 66.67%;}

/* LEFT */
.left-col{display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:2.5vw 2vw 2vw 2.5vw;border-right:1px solid rgba(200,168,136,.15);}
.title-block{text-align:center;}
.title-rena{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(26px,5vw,78px);color:#7A5535;letter-spacing:.14em;line-height:1;display:block;opacity:0;animation:fadeUp 2s ease forwards .3s;}
.title-ozerden{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:clamp(26px,5vw,78px);color:#7A5535;letter-spacing:.14em;line-height:1;display:block;opacity:0;animation:fadeUp 2s ease forwards .6s;}
.title-line{width:0;height:1px;background:linear-gradient(to right,transparent,#C8A878,transparent);margin:.6vw auto;opacity:.5;animation:lineGrow 2s ease forwards 1s;}
@keyframes lineGrow{to{width:min(10vw,120px);}}

/* BLOOMING FLOWER */
.flower-wrap{width:92%;opacity:0;animation:fadeUp 2s ease forwards .9s;}

/* Petal animation — blooming from center */
.bloom-petal{
  transform-origin: 50% 100%;
  animation: petalBloom var(--bloom-dur,4s) cubic-bezier(0.34,1.56,0.64,1) both;
  animation-delay: var(--bloom-del,0s);
}
@keyframes petalBloom{
  0%  { transform: rotate(var(--base-rot)) scaleY(0.05) scaleX(0.3); opacity:0; }
  30% { opacity:1; }
  100%{ transform: rotate(var(--base-rot)) scaleY(1) scaleX(1); opacity:1; }
}
.bloom-inner{
  transform-origin:50% 100%;
  animation:innerBloom 3s cubic-bezier(0.34,1.4,0.64,1) both 1.8s;
}
@keyframes innerBloom{
  0%  { transform:rotate(var(--base-rot)) scaleY(0.1) scaleX(0.4); opacity:0; }
  100%{ transform:rotate(var(--base-rot)) scaleY(1) scaleX(1); opacity:1; }
}
.bloom-center{
  animation: centerPop 1s cubic-bezier(0.34,1.6,0.64,1) both 3.2s;
}
@keyframes centerPop{
  0%  { transform:scale(0); opacity:0; }
  100%{ transform:scale(1); opacity:1; }
}
/* After bloom — gentle sway */
.bloom-sway{
  transform-origin:50% 95%;
  animation:fadeUp 2s ease forwards .9s, flowerSway 14s ease-in-out infinite 6s;
}
@keyframes flowerSway{0%,100%{transform:rotate(0deg);}33%{transform:rotate(.6deg);}66%{transform:rotate(-.5deg);}}

/* QR */
.qr-block{text-align:center;opacity:0;animation:fadeUp 2s ease forwards 1.4s;}
.qr-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:clamp(11px,1.5vw,22px);color:#7A5535;letter-spacing:.04em;margin-bottom:.8vw;line-height:1.4;}
.qr-frame{display:inline-block;background:#fff;padding:6px;border:1px solid rgba(200,168,136,.3);box-shadow:0 2px 16px rgba(160,120,80,.1);}
/* Hide duplicate — qrcodejs makes canvas + img, show only canvas */
.qr-frame canvas{display:block !important;width:min(12vw,150px) !important;height:min(12vw,150px) !important;}
.qr-frame img{display:none !important;}

/* RIGHT */
.right-col{position:relative;overflow:hidden;}
.col-line{position:absolute;top:0;bottom:0;width:1px;left:50%;background:linear-gradient(to bottom,transparent,rgba(200,168,136,.08) 20%,rgba(200,168,136,.08) 80%,transparent);z-index:1;pointer-events:none;}

/* SNOW — all columns */
#snow{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden;}
.sp{position:absolute;top:-5vw;opacity:0;animation:spFall var(--dur) ease-in-out infinite var(--del);}
@keyframes spFall{0%{opacity:0;transform:translateY(0) rotate(0deg) translateX(0);}8%{opacity:var(--op);}85%{opacity:var(--op);}100%{opacity:0;transform:translateY(115vh) rotate(var(--spin)) translateX(var(--sway));}}

/* SPARKLES */
#sparkles{position:absolute;inset:0;z-index:2;pointer-events:none;}
.sparkle{position:absolute;animation:twinkle var(--dur) ease-in-out infinite var(--del);opacity:0;}
@keyframes twinkle{0%,100%{opacity:0;transform:scale(0);}50%{opacity:var(--op);transform:scale(1) rotate(90deg);}}

/* PETALS */
#petals{position:absolute;inset:0;z-index:4;pointer-events:none;}
.burst{position:absolute;}
.petal{position:absolute;border-radius:50%;animation:petalOut var(--pd,1.4s) ease-out forwards;}
@keyframes petalOut{0%{transform:translate(0,0);opacity:1;}100%{transform:translate(var(--tx),var(--ty)) scale(.2);opacity:0;}}

/* NOTES */
#notes{position:absolute;z-index:10;pointer-events:none;overflow:hidden;top:0;bottom:0;left:33.33%;right:0;}
.nc{
  position:absolute;
  background:rgba(255,253,250,.97);
  border:1px solid rgba(200,165,140,.28);
  padding:.65vw .9vw;
  width:28vw;
  box-shadow:0 4px 20px rgba(140,100,70,.1);
  animation:ncFall var(--fall-dur) linear forwards;
  opacity:0;
}
@keyframes ncFall{
  0%  {opacity:0;transform:translateY(-140px) rotate(var(--r));}
  4%  {opacity:1;}
  92% {opacity:1;transform:translateY(var(--fall-dist)) rotate(var(--r));}
  100%{opacity:0;transform:translateY(var(--fall-dist)) rotate(var(--r));}
}
.nc-foto{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;margin-bottom:.5vw;border-radius:1px;}
.nc-name{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:clamp(12px,1.25vw,20px);color:#5A3518;letter-spacing:.02em;margin-bottom:.3vw;}
.nc-msg{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:400;font-size:clamp(11px,1.1vw,18px);color:#6A4525;line-height:1.5;}

/* TOAST */
.toast{position:fixed;top:3vw;left:50%;transform:translateX(-50%);z-index:60;white-space:nowrap;background:rgba(255,252,248,.97);border:1px solid rgba(200,168,136,.3);padding:.5vw 1.8vw;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(10px,1vw,16px);color:#8A6040;animation:toastAnim 4s ease forwards;pointer-events:none;}
@keyframes toastAnim{0%{opacity:0;transform:translateX(-50%) translateY(-8px);}10%{opacity:1;transform:translateX(-50%) translateY(0);}78%{opacity:1;}100%{opacity:0;}}

/* COUNTER */
.counter{position:absolute;bottom:1.8vw;right:1.5vw;z-index:20;display:flex;align-items:center;gap:.4vw;opacity:0;animation:fadeUp 2s ease forwards 2s;}
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
    <!-- LEFT -->
    <div class="left-col">
      <div class="title-block">
        <span class="title-rena">Rena</span>
        <div class="title-line"></div>
        <span class="title-ozerden">Özerden</span>
      </div>

      <!-- BLOOMING FLOWER SVG -->
      <div class="flower-wrap">
        <div class="bloom-sway">
        <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="rp1" cx="50%" cy="20%" r="70%">
              <stop offset="0%" stop-color="#FEE0E8"/>
              <stop offset="50%" stop-color="#F5B0C0"/>
              <stop offset="100%" stop-color="#D88898"/>
            </radialGradient>
            <radialGradient id="rp2" cx="50%" cy="20%" r="70%">
              <stop offset="0%" stop-color="#FEE8EE"/>
              <stop offset="50%" stop-color="#ECA8BC"/>
              <stop offset="100%" stop-color="#CC8090"/>
            </radialGradient>
            <radialGradient id="rp3" cx="50%" cy="20%" r="60%">
              <stop offset="0%" stop-color="#FFF0F4"/>
              <stop offset="50%" stop-color="#F8C0CC"/>
              <stop offset="100%" stop-color="#E090A0"/>
            </radialGradient>
            <radialGradient id="rcg" cx="45%" cy="35%" r="60%">
              <stop offset="0%" stop-color="#FFF0E0"/>
              <stop offset="100%" stop-color="#E8C090"/>
            </radialGradient>
            <radialGradient id="rlg" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#D0DDB0"/>
              <stop offset="100%" stop-color="#8AAA68"/>
            </radialGradient>
          </defs>

          <!-- Stem -->
          <path d="M150,195 Q148,165 150,140 Q152,115 150,95" stroke="#9AB878" stroke-width="3" fill="none" stroke-linecap="round" style="opacity:0;animation:fadeUp 1s ease forwards 0.5s;"/>

          <!-- Horizontal branch left -->
          <path d="M150,155 Q120,150 90,148 Q65,147 45,142" stroke="#9AB878" stroke-width="2" fill="none" stroke-linecap="round" style="opacity:0;animation:fadeUp 1.5s ease forwards 0.8s;"/>
          <!-- Left leaf -->
          <path d="M90,148 Q78,135 70,122 Q85,130 95,143Z" fill="url(#rlg)" opacity=".8" style="opacity:0;animation:fadeUp 2s ease forwards 1s;"/>
          <!-- Left small flower bud -->
          <g transform="translate(48,130)" style="opacity:0;animation:fadeUp 2s ease forwards 1.5s;">
            <ellipse cx="0" cy="-10" rx="5" ry="8" fill="url(#rp2)" opacity=".75" transform="rotate(0,0,0)"/>
            <ellipse cx="0" cy="-10" rx="5" ry="8" fill="url(#rp1)" opacity=".75" transform="rotate(90,0,0)"/>
            <ellipse cx="0" cy="-10" rx="5" ry="8" fill="url(#rp2)" opacity=".75" transform="rotate(180,0,0)"/>
            <ellipse cx="0" cy="-10" rx="5" ry="8" fill="url(#rp1)" opacity=".75" transform="rotate(270,0,0)"/>
            <circle cx="0" cy="0" r="6" fill="url(#rcg)"/>
          </g>

          <!-- Horizontal branch right -->
          <path d="M150,138 Q180,133 210,130 Q235,128 255,122" stroke="#9AB878" stroke-width="2" fill="none" stroke-linecap="round" style="opacity:0;animation:fadeUp 1.5s ease forwards 1s;"/>
          <!-- Right leaf -->
          <path d="M210,130 Q222,117 230,103 Q218,115 205,126Z" fill="url(#rlg)" opacity=".75" style="opacity:0;animation:fadeUp 2s ease forwards 1.2s;"/>
          <!-- Right small bud -->
          <g transform="translate(255,112)" style="opacity:0;animation:fadeUp 2s ease forwards 1.8s;">
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp3)" opacity=".8" transform="rotate(0,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp2)" opacity=".8" transform="rotate(72,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp3)" opacity=".8" transform="rotate(144,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp2)" opacity=".8" transform="rotate(216,0,0)"/>
            <ellipse cx="0" cy="-8" rx="4" ry="6.5" fill="url(#rp3)" opacity=".8" transform="rotate(288,0,0)"/>
            <circle cx="0" cy="0" r="5" fill="url(#rcg)"/>
          </g>

          <!-- MAIN FLOWER — blooming petals -->
          <g transform="translate(150,75)">
            <!-- Outer petals — bloom first, slowest -->
            <g class="bloom-petal" style="--base-rot:0deg;  --bloom-dur:4.5s;--bloom-del:0.4s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:45deg; --bloom-dur:4.5s;--bloom-del:0.55s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:90deg; --bloom-dur:4.5s;--bloom-del:0.7s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:135deg;--bloom-dur:4.5s;--bloom-del:0.85s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:180deg;--bloom-dur:4.5s;--bloom-del:1.0s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:225deg;--bloom-dur:4.5s;--bloom-del:1.15s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:270deg;--bloom-dur:4.5s;--bloom-del:1.3s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp1)" opacity=".72"/></g>
            <g class="bloom-petal" style="--base-rot:315deg;--bloom-dur:4.5s;--bloom-del:1.45s;transform-origin:0px 0px;"><ellipse cx="0" cy="-26" rx="11" ry="20" fill="url(#rp2)" opacity=".72"/></g>
            <!-- Mid petals -->
            <g class="bloom-inner" style="--base-rot:22.5deg; transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:67.5deg; transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:112.5deg;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:157.5deg;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:202.5deg;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:247.5deg;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:292.5deg;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp3)" opacity=".85"/></g>
            <g class="bloom-inner" style="--base-rot:337.5deg;transform-origin:0px 0px;"><ellipse cx="0" cy="-20" rx="8.5" ry="16" fill="url(#rp2)" opacity=".85"/></g>
            <!-- Inner petals -->
            <g class="bloom-inner" style="--base-rot:0deg;  transform-origin:0px 0px;animation-delay:2.2s !important;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:60deg; transform-origin:0px 0px;animation-delay:2.3s !important;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:120deg;transform-origin:0px 0px;animation-delay:2.4s !important;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:180deg;transform-origin:0px 0px;animation-delay:2.5s !important;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:240deg;transform-origin:0px 0px;animation-delay:2.6s !important;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <g class="bloom-inner" style="--base-rot:300deg;transform-origin:0px 0px;animation-delay:2.7s !important;"><ellipse cx="0" cy="-14" rx="6" ry="11" fill="url(#rp3)" opacity=".92"/></g>
            <!-- Center -->
            <g class="bloom-center">
              <circle cx="0" cy="0" r="16" fill="url(#rcg)"/>
              <circle cx="0" cy="0" r="10" fill="#F5DCC0" opacity=".9"/>
              <circle cx="-3" cy="-3" r="4" fill="rgba(255,248,235,.65)"/>
              <!-- Stamens -->
              <g stroke="#C8986A" stroke-width=".9" opacity=".75">
                <line x1="0"  y1="-9"  x2="0"  y2="-14"/><circle cx="0"   cy="-15" r="1.8" fill="#D4A870"/>
                <line x1="7"  y1="-6"  x2="10" y2="-11"/><circle cx="11"  cy="-12" r="1.5" fill="#D4A870"/>
                <line x1="-7" y1="-6"  x2="-10"y2="-11"/><circle cx="-11" cy="-12" r="1.5" fill="#D4A870"/>
                <line x1="9"  y1="2"   x2="13" y2="5"  /><circle cx="14"  cy="6"   r="1.3" fill="#D4A870"/>
                <line x1="-9" y1="2"   x2="-13"y2="5"  /><circle cx="-14" cy="6"   r="1.3" fill="#D4A870"/>
              </g>
            </g>
          </g>

          <!-- Decorative dots on stem -->
          <circle cx="108" cy="148" r="2.5" fill="#D4A878" opacity=".4" style="opacity:0;animation:fadeUp 1s ease forwards 2s;"/>
          <circle cx="175" cy="133" r="2" fill="#D4A878" opacity=".35" style="opacity:0;animation:fadeUp 1s ease forwards 2.2s;"/>
        </svg>
        </div>
      </div>

      <!-- QR -->
      <div class="qr-block">
        <div class="qr-title">Rena'ya bir<br>not bırak</div>
        <div class="qr-frame" id="qrBox"></div>
      </div>
    </div>

    <!-- RIGHT -->
    <div class="right-col" id="rightCol">
      <div class="col-line"></div>
    </div>
  </div>

  <div class="counter">
    <div class="ldot"></div>
    <div class="ctxt" id="ct">0 not</div>
  </div>
</div>

<!-- QR — canvas only, no img duplicate -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
(function(){
  var box = document.getElementById('qrBox');
  if(!box) return;
  var url = location.protocol+'//'+location.host+'/not';
  // useSVG:false forces canvas only (no img tag)
  new QRCode(box, {
    text: url, width:150, height:150,
    colorDark:'#1A0A00', colorLight:'#FFFFFF',
    correctLevel: QRCode.CorrectLevel.H,
    useSVG: false
  });
  // Hide any img tags qrcodejs might create
  setTimeout(function(){
    var imgs = box.querySelectorAll('img');
    imgs.forEach(function(img){ img.style.display='none'; });
    var canvas = box.querySelector('canvas');
    if(canvas){
      canvas.style.display='block';
      canvas.style.width='min(12vw,150px)';
      canvas.style.height='min(12vw,150px)';
    }
  }, 400);
})();

// ── FALLING ITEMS — all columns ──
(function(){
  var s = document.getElementById('snow');
  function pacifierSVG(sz,op){
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="'+sz+'" height="'+sz+'" style="display:block;">'+
      '<ellipse cx="20" cy="22" rx="14" ry="10" fill="rgba(232,180,190,'+op+')" />'+
      '<ellipse cx="20" cy="22" rx="14" ry="10" fill="none" stroke="rgba(210,150,160,'+op+')" stroke-width="1"/>'+
      '<ellipse cx="20" cy="12" rx="4.5" ry="6" fill="rgba(220,160,150,'+(op*1.1)+')" />'+
      '<circle cx="20" cy="33" r="4" fill="none" stroke="rgba(210,150,160,'+op+')" stroke-width="1.8"/>'+
      '</svg>';
  }
  function bottleSVG(sz,op){
    var w=Math.round(sz*.6);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 42" width="'+w+'" height="'+sz+'" style="display:block;">'+
      '<ellipse cx="12" cy="4" rx="3" ry="3.5" fill="rgba(200,160,140,'+op+')" />'+
      '<rect x="8" y="6" width="8" height="4" rx="2" fill="rgba(220,175,165,'+op+')" />'+
      '<path d="M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z" fill="rgba(245,225,225,'+(op*.85)+')" />'+
      '<path d="M7,10 C4,12 3,15 3,20 L3,34 C3,37 5,39 12,39 C19,39 21,37 21,34 L21,20 C21,15 20,12 17,10 Z" fill="none" stroke="rgba(210,170,165,'+op+')" stroke-width="1"/>'+
      '</svg>';
  }
  function flowerSVG(sz,op){
    var c='rgba(210,175,165,'+op+')';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="'+sz+'" height="'+sz+'" style="display:block;">'+
      '<ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(0,10,10)"/>'+
      '<ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(60,10,10)"/>'+
      '<ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(120,10,10)"/>'+
      '<ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(180,10,10)"/>'+
      '<ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(240,10,10)"/>'+
      '<ellipse cx="10" cy="4" rx="3" ry="4.5" fill="'+c+'" transform="rotate(300,10,10)"/>'+
      '<circle cx="10" cy="10" r="3.5" fill="rgba(245,225,215,'+op+')" />'+
      '</svg>';
  }
  var types=['pacifier','bottle','flower','pacifier','bottle','flower','pacifier','bottle'];
  for(var i=0;i<30;i++){
    var el=document.createElement('div'); el.className='sp';
    var type=types[i%types.length];
    var sz=8+Math.random()*6, op=(0.2+Math.random()*.28).toFixed(2);
    var inner=type==='pacifier'?pacifierSVG(sz,op):type==='bottle'?bottleSVG(sz,op):flowerSVG(sz,op);
    el.innerHTML=inner;
    // Distribute across full width
    el.style.cssText='left:'+(Math.random()*100)+'%;--dur:'+(11+Math.random()*14)+'s;--del:-'+(Math.random()*22)+'s;--op:1;--spin:'+((Math.random()-.5)*260)+'deg;--sway:'+((Math.random()-.5)*5)+'vw;';
    s.appendChild(el);
  }
})();

// ── SPARKLES ──
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

// ── CLICK BLOOM ──
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

// ── NOTES — 6 columns, no overlap ──
var count=0;
function esc(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

var _cols=[
  {left:2,  active:false},
  {left:18, active:false},
  {left:34, active:false},
  {left:50, active:false},
  {left:66, active:false},
  {left:82, active:false},
];
var _noteQueue=[];

function getFreeCol(){
  var free=_cols.filter(function(c){return !c.active;});
  if(!free.length) return null;
  return free[Math.floor(Math.random()*free.length)];
}

function launchNote(isim,mesaj,foto){
  var col=getFreeCol();
  if(!col){ _noteQueue.push({isim:isim,mesaj:mesaj,foto:foto}); return; }
  col.active=true;
  var el=document.createElement('div');el.className='nc';
  var rot=(Math.random()-.5)*1.5;
  var fallDur=10+Math.random()*6;
  el.style.cssText='left:'+col.left+'%;top:-5%;--r:'+rot+'deg;--fall-dist:115vh;--fall-dur:'+fallDur+'s;';
  var fHtml=foto?'<img class="nc-foto" src="'+foto+'" alt=""/>':'';
  el.innerHTML=fHtml+'<div class="nc-name">'+esc(isim)+'</div><div class="nc-msg">'+esc(mesaj)+'</div>';
  document.getElementById('notes').appendChild(el);
  setTimeout(function(){
    if(el.parentNode)el.remove();
    col.active=false;
    // Re-queue for infinite loop
    if(_noteQueue.length<200) _noteQueue.push({isim:isim,mesaj:mesaj,foto:foto});
    setTimeout(tryQueue,300+Math.random()*800);
  }, fallDur*1000+200);
}

function tryQueue(){
  if(!_noteQueue.length) return;
  var col=getFreeCol();
  if(!col) return;
  var next=_noteQueue.shift();
  launchNote(next.isim,next.mesaj,next.foto);
}

function spawnNote(isim,mesaj,foto){
  launchNote(isim,mesaj,foto);
  count++;
  var ct=document.getElementById('ct');if(ct)ct.textContent=count+' not';
  var t=document.createElement('div');t.className='toast';
  t.textContent=esc(isim)+' bir not bıraktı ♡';
  document.getElementById('canvas').appendChild(t);
  setTimeout(function(){if(t.parentNode)t.remove();},4200);
}

// Force visible
setTimeout(function(){
  document.querySelectorAll('.title-rena,.title-ozerden,.flower-wrap,.qr-block,.counter').forEach(function(el){
    el.style.opacity='1';el.style.transform='translateY(0)';
  });
},400);

// ── HAND PRINTS ──
(function(){
  var ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(ov);
  function foot(flip){
    var s=document.createElementNS('http://www.w3.org/2000/svg','svg');
    s.setAttribute('viewBox','0 0 32 36');s.setAttribute('width','12');s.setAttribute('height','13');
    var ns='http://www.w3.org/2000/svg';
    var g=document.createElementNS(ns,'g');
    if(flip)g.setAttribute('transform','scale(-1,1) translate(-32,0)');
    var palm=document.createElementNS(ns,'path');
    palm.setAttribute('d','M6,32 C2,31 1,27 2,23 C3,19 4,17 5,15 C6,13 7,12 9,12 C11,12 13,12 15,13 C17,12 19,12 21,13 C23,12 25,13 26,15 C27,17 28,19 28,23 C29,27 28,31 25,32 Z');
    palm.setAttribute('fill','#C8A090');palm.setAttribute('opacity','0.4');g.appendChild(palm);
    [{cx:7,cy:8,rx:2.8,ry:3.2},{cx:12,cy:6,rx:2.6,ry:3.4},{cx:18,cy:6,rx:2.6,ry:3.4},{cx:23,cy:7.5,rx:2.4,ry:3.1}].forEach(function(f){
      var e=document.createElementNS(ns,'ellipse');
      e.setAttribute('cx',f.cx);e.setAttribute('cy',f.cy);e.setAttribute('rx',f.rx);e.setAttribute('ry',f.ry);
      e.setAttribute('fill','#C8A090');e.setAttribute('opacity','0.38');g.appendChild(e);
    });
    var thumb=document.createElementNS(ns,'ellipse');
    thumb.setAttribute('cx','3');thumb.setAttribute('cy','18');thumb.setAttribute('rx','2.2');thumb.setAttribute('ry','3.5');
    thumb.setAttribute('fill','#C8A090');thumb.setAttribute('opacity','0.32');thumb.setAttribute('transform','rotate(-25,3,18)');
    g.appendChild(thumb);s.appendChild(g);return s;
  }
  function walk(){
    var W=window.innerWidth,H=window.innerHeight;
    var sx=0.08+Math.random()*0.78,sy=0.12+Math.random()*0.68;
    var ang=(-15+Math.random()*30)*Math.PI/180,stride=0.05+Math.random()*0.02;
    for(var i=0;i<5;i++){(function(idx){
      var right=idx%2===0,perp=ang+Math.PI/2,lat=right?0.022:-0.022;
      var px=(sx+Math.cos(ang)*stride*idx+Math.cos(perp)*lat)*W;
      var py=(sy+Math.sin(ang)*stride*idx+Math.sin(perp)*lat)*H;
      var rot=(ang*180/Math.PI)+(right?8:-8);
      setTimeout(function(){
        var wrap=document.createElement('div');
        wrap.style.cssText='position:absolute;left:'+px+'px;top:'+py+'px;transform:rotate('+rot+'deg);opacity:0;transition:opacity 0.5s ease;';
        wrap.appendChild(foot(!right));ov.appendChild(wrap);
        requestAnimationFrame(function(){requestAnimationFrame(function(){wrap.style.opacity='0.55';});});
        setTimeout(function(){wrap.style.transition='opacity 1.8s ease';wrap.style.opacity='0';setTimeout(function(){if(wrap.parentNode)wrap.remove();},1900);},3500);
      },idx*400);
    })(i);}
  }
  setTimeout(function(){walk();setInterval(walk,6000+Math.random()*3000);},2000);
})();
</script>
</body>
</html>
