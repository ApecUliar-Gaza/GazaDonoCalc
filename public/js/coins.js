// Gold coins falling into cupped hands.
// mountGiving(el) draws the hands (or a photo, if config.handsImage is set);
// dropCoin(el) drops one coin with a falling, spinning, bouncing motion. Respects reduced-motion.

const cfg = window.ZAKAH_CONFIG || {};

// Illustrated hands with soft, skin-like shading. Replaced by a photo when config.handsImage is set.
const HANDS_SVG = `
<svg class="hands" viewBox="0 0 260 160" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="skinL" cx=".62" cy=".35" r=".85">
      <stop offset="0" stop-color="#d9a273"/><stop offset=".55" stop-color="#b97a4c"/><stop offset="1" stop-color="#8a5532"/>
    </radialGradient>
    <radialGradient id="skinR" cx=".38" cy=".35" r=".85">
      <stop offset="0" stop-color="#d9a273"/><stop offset=".55" stop-color="#b97a4c"/><stop offset="1" stop-color="#8a5532"/>
    </radialGradient>
    <linearGradient id="palmShadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5a3018" stop-opacity=".55"/><stop offset="1" stop-color="#5a3018" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="softer" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <!-- left hand -->
  <path d="M131 152 C 92 154, 44 140, 24 104 C 15 88, 13 70, 19 59 C 24 50, 34 51, 38 60 L 45 74
           C 42 61, 44 49, 53 47 C 62 45, 66 53, 67 64 L 69 77 C 68 64, 72 55, 81 55 C 90 55, 92 64, 92 72 L 93 83
           C 94 72, 98 66, 106 67 C 114 68, 116 76, 115 85 L 113 104 C 117 113, 124 117, 131 117 Z"
        fill="url(#skinL)" stroke="#6e4122" stroke-width="1.2" stroke-linejoin="round"/>
  <!-- right hand -->
  <path d="M129 152 C 168 154, 216 140, 236 104 C 245 88, 247 70, 241 59 C 236 50, 226 51, 222 60 L 215 74
           C 218 61, 216 49, 207 47 C 198 45, 194 53, 193 64 L 191 77 C 192 64, 188 55, 179 55 C 170 55, 168 64, 168 72 L 167 83
           C 166 72, 162 66, 154 67 C 146 68, 144 76, 145 85 L 147 104 C 143 113, 136 117, 129 117 Z"
        fill="url(#skinR)" stroke="#6e4122" stroke-width="1.2" stroke-linejoin="round"/>
  <!-- light on the knuckles and finger tips -->
  <g fill="#f1c9a0" opacity=".55" filter="url(#soft)">
    <ellipse cx="28" cy="66" rx="5" ry="8"/><ellipse cx="57" cy="54" rx="5" ry="7"/><ellipse cx="82" cy="61" rx="5" ry="6"/><ellipse cx="106" cy="73" rx="4" ry="5"/>
    <ellipse cx="232" cy="66" rx="5" ry="8"/><ellipse cx="203" cy="54" rx="5" ry="7"/><ellipse cx="178" cy="61" rx="5" ry="6"/><ellipse cx="154" cy="73" rx="4" ry="5"/>
  </g>
  <!-- nails -->
  <g fill="#e8b994" stroke="#9c6640" stroke-width=".6" opacity=".9">
    <ellipse cx="25" cy="58" rx="3.4" ry="4.2"/><ellipse cx="57" cy="49" rx="3.4" ry="4.2"/><ellipse cx="81" cy="57" rx="3.2" ry="4"/><ellipse cx="107" cy="69" rx="3" ry="3.6"/>
    <ellipse cx="235" cy="58" rx="3.4" ry="4.2"/><ellipse cx="203" cy="49" rx="3.4" ry="4.2"/><ellipse cx="179" cy="57" rx="3.2" ry="4"/><ellipse cx="153" cy="69" rx="3" ry="3.6"/>
  </g>
  <!-- gaps between fingers and palm creases -->
  <g stroke="#5e3519" stroke-linecap="round" fill="none" opacity=".55" filter="url(#soft)" stroke-width="2.4">
    <path d="M45 74 C 50 92, 58 106, 72 114"/><path d="M69 77 C 73 94, 80 106, 93 114"/><path d="M93 83 C 96 96, 102 106, 112 112"/>
    <path d="M215 74 C 210 92, 202 106, 188 114"/><path d="M191 77 C 187 94, 180 106, 167 114"/><path d="M167 83 C 164 96, 158 106, 148 112"/>
  </g>
  <g stroke="#7a4626" stroke-linecap="round" fill="none" opacity=".35" stroke-width="1.1">
    <path d="M60 128 C 80 136, 104 138, 122 136"/><path d="M200 128 C 180 136, 156 138, 138 136"/>
  </g>
  <path d="M130 117 L 130 152" stroke="#5e3519" stroke-width="1.6" opacity=".5"/>
  <!-- soft shadow along the bottom of the hands -->
  <path d="M30 112 C 52 144, 96 154, 130 152 C 164 154, 208 144, 230 112" stroke="#3b1f0d" stroke-width="8" fill="none" opacity=".25" filter="url(#softer)"/>
</svg>`;

// The hollow of the palms sits behind the coins; the hands sit in front of them.
const HOLLOW_SVG = `
<svg class="hands-back" viewBox="0 0 260 160" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="hollowG" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#4a2410"/><stop offset="1" stop-color="#7a4628"/></radialGradient>
  </defs>
  <ellipse cx="130" cy="100" rx="58" ry="22" fill="url(#hollowG)"/>
</svg>`;

// A coin is a face, a thick milled edge and a shine, built from CSS layers so it catches light as it spins.
const COIN_HTML = `
<div class="coin-body">
  <div class="coin-edge"></div>
  <div class="coin-face">
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><g fill="none" stroke="rgba(110,74,6,.55)" stroke-width="1.1">
      <circle cx="20" cy="20" r="14.5"/><path d="M20 10.5 l2.8 6.7 6.7 2.8 -6.7 2.8 -2.8 6.7 -2.8 -6.7 -6.7 -2.8 6.7 -2.8z" fill="rgba(140,98,10,.35)"/></g></svg>
  </div>
  <div class="coin-shine"></div>
</div>`;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function mountGiving(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  if (cfg.handsImage) {
    el.classList.add('photo');
    const x = cfg.handsLanding?.x ?? 50;
    const y = cfg.handsLanding?.y ?? 60;
    el.insertAdjacentHTML('beforeend', `<div class="giving-stage"><img class="hands" src="${cfg.handsImage}" alt="" loading="lazy"><div class="coin-pile" style="left:${x}%;top:${y}%;bottom:auto"></div></div>`);
  } else {
    el.insertAdjacentHTML('beforeend', `<div class="giving-stage">${HOLLOW_SVG}<div class="coin-pile"></div>${HANDS_SVG}</div>`);
  }
  el._pile = 0;
}

function sparkle(pile, x, y) {
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    pile.appendChild(s);
    const a = (Math.PI * 2 * i) / 5 + Math.random() * 0.6;
    const d = 16 + Math.random() * 14;
    s.animate(
      [
        { transform: `translate(${x}px, ${y - 4}px) scale(.2)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(a) * d}px, ${y - 4 + Math.sin(a) * d * 0.6 - 10}px) scale(1)`, opacity: 0 },
      ],
      { duration: 650, easing: 'cubic-bezier(.2,.7,.3,1)' },
    ).finished.then(() => s.remove()).catch(() => s.remove());
  }
}

// Drop one coin. It falls with gravity, spins, stretches slightly with speed, lands lying
// flat at an angle, bounces once and settles. Coins build a small heap; old ones fade out.
export function dropCoin(el, { delay = 0 } = {}) {
  if (!el) return;
  mountGiving(el);
  const pile = el.querySelector('.coin-pile');
  const coin = document.createElement('div');
  coin.className = 'coin';
  coin.innerHTML = COIN_HTML;
  const n = el._pile++;
  const slots = [[0, 2], [-20, 4], [20, 3], [-9, -6], [10, -7], [-28, -3], [28, -4], [0, -13]];
  const [lx, ly] = slots[n % slots.length];
  const tilt = 58 + Math.random() * 10; // lying flat, seen at an angle
  const turn = Math.random() * 360;
  const startX = lx + (Math.random() * 50 - 25);
  pile.appendChild(coin);
  const rest = `translate(${lx}px, ${ly}px) rotateX(${tilt}deg) rotateZ(${turn}deg)`;

  // Contact shadow under where the coin lands.
  const shadow = document.createElement('span');
  shadow.className = 'coin-shadow';
  shadow.style.transform = `translate(${lx}px, ${ly + 8}px)`;
  pile.insertBefore(shadow, pile.firstChild);

  if (reduceMotion()) {
    coin.style.transform = rest;
    return;
  }
  const fall = el.clientHeight * 0.95 + 80;
  const spin = 3 + Math.floor(Math.random() * 2);
  const body = coin.querySelector('.coin-body');
  coin.animate(
    [
      { transform: `translate(${startX}px, ${-fall}px) rotateX(0deg) rotateZ(0deg)`, opacity: 0, offset: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: `translate(${lx}px, ${ly}px) rotateX(${tilt - 20}deg) rotateZ(${turn * 0.6}deg)`, easing: 'cubic-bezier(.45,0,.85,.55)', offset: 0.7 },
      { transform: `translate(${lx}px, ${ly - 14}px) rotateX(${tilt + 8}deg) rotateZ(${turn * 0.9}deg)`, easing: 'cubic-bezier(.2,.6,.4,1)', offset: 0.82 },
      { transform: `translate(${lx}px, ${ly}px) rotateX(${tilt - 4}deg) rotateZ(${turn}deg)`, easing: 'ease-in', offset: 0.92 },
      { transform: `translate(${lx}px, ${ly - 2}px) rotateX(${tilt + 2}deg) rotateZ(${turn}deg)`, offset: 0.96 },
      { transform: rest, offset: 1 },
    ],
    { duration: 1500, delay, fill: 'both' },
  );
  // Spin about its own axis while falling, slowing as it lands; stretch slightly at speed.
  body.animate(
    [
      { transform: 'rotateY(0deg) scaleY(1)', offset: 0 },
      { transform: `rotateY(${spin * 360 - 120}deg) scaleY(1.08)`, easing: 'linear', offset: 0.62 },
      { transform: `rotateY(${spin * 360}deg) scaleY(1)`, easing: 'cubic-bezier(.2,.8,.3,1)', offset: 0.85 },
      { transform: `rotateY(${spin * 360}deg) scaleY(1)`, offset: 1 },
    ],
    { duration: 1500, delay, fill: 'both' },
  );
  shadow.animate(
    [{ opacity: 0, transform: `translate(${lx}px, ${ly + 8}px) scale(.3)` }, { opacity: 0.55, transform: `translate(${lx}px, ${ly + 8}px) scale(1)` }],
    { duration: 1050, delay, easing: 'ease-in', fill: 'both' },
  );
  setTimeout(() => {
    sparkle(pile, lx, ly);
    el.classList.remove('glow');
    void el.offsetWidth; // restart the glow
    el.classList.add('glow');
  }, delay + 1050);

  const coins = pile.querySelectorAll('.coin');
  if (coins.length > 8) {
    const old = coins[0];
    const oldShadow = pile.querySelector('.coin-shadow');
    old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished
      .then(() => { old.remove(); oldShadow?.remove(); }).catch(() => old.remove());
  }
}

// Drop a coin for every `step` pixels scrolled down, while the element is on screen.
export function coinsOnScroll(el, step = 160) {
  if (!el) return;
  mountGiving(el);
  let last = window.scrollY;
  let acc = 0;
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 }).observe(el);
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const d = y - last;
    last = y;
    if (!visible || d <= 0) return;
    acc += d;
    if (acc >= step) {
      acc = 0;
      dropCoin(el);
    }
  }, { passive: true });
}

// Drop a few coins the first time the element scrolls into view.
export function coinsOnView(el, count = 3) {
  if (!el) return;
  mountGiving(el);
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    for (let i = 0; i < count; i++) dropCoin(el, { delay: i * 280 });
  }, { threshold: 0.5 });
  io.observe(el);
}
