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
  <div class="coin-face"></div>
  <div class="coin-shine"></div>
</div>`;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const drawnStage = () => `<div class="giving-stage">${HOLLOW_SVG}<div class="coin-pile"></div>${HANDS_SVG}</div>`;

export function mountGiving(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  if (cfg.handsImage) {
    el.classList.add('photo');
    const x = cfg.handsLanding?.x ?? 50;
    const y = cfg.handsLanding?.y ?? 60;
    el.insertAdjacentHTML('beforeend', `<div class="giving-stage"><img class="hands" src="${cfg.handsImage}" alt="" loading="lazy"><div class="coin-pile" style="left:${x}%;top:${y}%;bottom:auto"></div></div>`);
    // If the photo is missing, fall back to the drawn hands rather than showing a broken image.
    el.querySelector('img.hands').addEventListener('error', () => {
      el.classList.remove('photo');
      el.querySelector('.giving-stage').outerHTML = drawnStage();
    }, { once: true });
  } else {
    el.insertAdjacentHTML('beforeend', drawnStage());
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

// One coin, tied to the scroll: it starts at the top of the page and falls as the visitor
// scrolls down, lands in the hands, sinks in and disappears, and an Islamic message appears.
// Scrolling back up lets it fall again, with the next message.
export const GIVING_MESSAGES = [
  { text: '“Charity does not decrease wealth.”', source: 'Prophet Muhammad ﷺ, Sahih Muslim 2588' },
  { text: '“The example of those who spend their wealth in the way of Allah is like a seed which grows seven spikes; in each spike is a hundred grains.”', source: "Qur'an 2:261" },
  { text: '“Take from their wealth a charity by which you purify them and cause them increase.”', source: "Qur'an 9:103" },
  { text: '“Whoever relieves a believer of a hardship of this world, Allah will relieve him of a hardship of the Day of Resurrection.”', source: 'Prophet Muhammad ﷺ, Sahih Muslim 2699' },
];

export function scrollCoinScene(el, { host, messageEl, k = 1.6 } = {}) {
  if (!el || !host) return;
  mountGiving(el);
  if (reduceMotion()) {
    showMessage(messageEl, 0);
    return;
  }
  const coin = document.createElement('div');
  coin.className = 'scroll-coin';
  coin.innerHTML = `<div class="coin">${COIN_HTML}</div>`;
  host.appendChild(coin);
  const pile = el.querySelector('.coin-pile');
  let landed = false;
  let msgIndex = 0;
  let geo = null;

  const measure = () => {
    const hostRect = host.getBoundingClientRect();
    const p = pile.getBoundingClientRect();
    const lx = p.left - hostRect.left;
    const ly = p.top - hostRect.top;
    const narrow = window.innerWidth < 760;
    const sx = narrow ? hostRect.width - 44 : lx;
    const sy = 26;
    geo = { lx, ly, sx, sy, d: Math.max(ly - sy, 1) };
  };

  const frame = () => {
    if (!geo) measure();
    const { lx, ly, sx, sy, d } = geo;
    const p = Math.min((window.scrollY * k) / d, 1);
    const e = p * p * (3 - 2 * p); // smooth start and finish
    const x = sx + (lx - sx) * e + Math.sin(p * Math.PI * 2) * 18 * (1 - p);
    const y = sy + (ly - sy) * p;
    if (p >= 1 && !landed) {
      landed = true;
      coin.style.transform = `translate(${lx}px, ${ly}px)`;
      coin.querySelector('.coin').animate(
        [{ transform: 'translateY(0) scale(1) rotateX(55deg)', opacity: 1 }, { transform: 'translateY(16px) scale(.5) rotateX(70deg)', opacity: 0 }],
        { duration: 520, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
      );
      sparkle(pile, 0, 0);
      el.classList.remove('glow');
      void el.offsetWidth;
      el.classList.add('glow');
      showMessage(messageEl, msgIndex++ % GIVING_MESSAGES.length);
      return;
    }
    if (p < 0.75 && landed) {
      landed = false;
      coin.querySelector('.coin').getAnimations().forEach((a) => a.cancel());
    }
    if (!landed) {
      const spin = p * 900;
      const tilt = p * 50;
      coin.style.transform = `translate(${x}px, ${y}px)`;
      coin.querySelector('.coin').style.transform = `rotateX(${tilt}deg) rotateY(${spin}deg) scale(${1 + p * 0.1})`;
    }
  };

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; frame(); });
  }, { passive: true });
  window.addEventListener('resize', () => { geo = null; frame(); });
  // Images can change the layout once loaded.
  el.querySelector('img')?.addEventListener('load', () => { geo = null; frame(); });
  frame();
}

function showMessage(messageEl, i) {
  if (!messageEl) return;
  const m = GIVING_MESSAGES[i];
  messageEl.classList.remove('show');
  void messageEl.offsetWidth;
  messageEl.innerHTML = `<span class="msg-text">${m.text}</span><span class="msg-source">${m.source}</span>`;
  messageEl.classList.add('show');
}

// One coin for the whole page: it starts at the top of the screen and falls as the visitor
// scrolls down the page, then lands in the hands in the final section at the bottom,
// sinks in and disappears, and an Islamic message appears with the donate button.
export function pageCoinScene({ scene, stage, messageEl, contentWidth = 780 } = {}) {
  if (!scene || !stage) return;
  mountGiving(stage);
  const pileEl = () => stage.querySelector(".coin-pile"); // looked up each time: the photo can fall back to the drawing
  if (reduceMotion()) {
    showMessage(messageEl, 0);
    scene.classList.add('landed');
    return;
  }
  const coin = document.createElement('div');
  coin.className = 'page-coin';
  coin.innerHTML = `<div class="coin">${COIN_HTML}</div>`;
  document.body.appendChild(coin);
  const face = coin.querySelector('.coin');
  let landed = false;
  let msgIndex = 0;

  const frame = () => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const max = Math.max(document.documentElement.scrollHeight - vh, 1);
    const progress = Math.min(Math.max(window.scrollY / max, 0), 1);

    // Where the coin travels while the page scrolls: down the right-hand margin on wide
    // screens, down the right edge on phones.
    const right = (vw + contentWidth) / 2;
    const gutter = vw - right;
    const wide = gutter > 90;
    const trackX = wide ? right + gutter / 2 : vw - 24;
    const trackY = 40 + progress * vh * 0.45;
    const size = wide ? 1 : 0.75;

    // As the hands come into view, steer the coin into them.
    const p = pileEl().getBoundingClientRect();
    // It lands when the hands reach 45% down the screen, or at the bottom of the page if they
    // can't scroll that high.
    const pileTopAtEnd = p.top - (max - window.scrollY);
    const landY = Math.max(vh * 0.45, pileTopAtEnd + 8);
    const t = Math.min(Math.max((vh - p.top) / Math.max(vh - landY, 1), 0), 1);
    const e = t * t * (3 - 2 * t);
    const x = trackX + (p.left - trackX) * e;
    const y = trackY + (p.top - trackY) * e;
    const sway = Math.sin(progress * Math.PI * 6) * 10 * (1 - e);

    if (t >= 1 && !landed) {
      landed = true;
      coin.style.transform = `translate(${p.left}px, ${p.top}px)`;
      face.animate(
        [{ transform: 'translateY(0) scale(1) rotateX(55deg)', opacity: 1 }, { transform: 'translateY(18px) scale(.45) rotateX(72deg)', opacity: 0 }],
        { duration: 560, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' },
      );
      sparkle(pileEl(), 0, 0);
      stage.classList.remove('glow');
      void stage.offsetWidth;
      stage.classList.add('glow');
      showMessage(messageEl, msgIndex++ % GIVING_MESSAGES.length);
      scene.classList.add('landed');
      return;
    }
    if (landed) {
      if (t < 0.85) {
        landed = false;
        face.getAnimations().forEach((a) => a.cancel());
      } else {
        coin.style.transform = `translate(${p.left}px, ${p.top}px)`;
        return;
      }
    }
    coin.style.transform = `translate(${x + sway}px, ${y}px)`;
    face.style.transform = `rotateX(${e * 55}deg) rotateY(${window.scrollY * 0.9}deg) scale(${size + e * (1 - size)})`;
  };

  let ticking = false;
  const queue = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; frame(); });
  };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  new ResizeObserver(queue).observe(document.body);
  frame();
}
