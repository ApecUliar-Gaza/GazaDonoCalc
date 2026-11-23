// Gold coins falling into cupped hands.
// mountGiving(el) draws the hands; dropCoin(el) drops one coin. Respects reduced-motion.

const HANDS_SVG = `
<svg class="hands" viewBox="0 0 260 150" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="handFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6e6c0"/>
      <stop offset="1" stop-color="#e2c486"/>
    </linearGradient>
    <linearGradient id="handShade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".10"/>
      <stop offset=".5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".10"/>
    </linearGradient>
  </defs>
  <!-- left hand: palm curving into the bowl, fingers along the rim, thumb on top -->
  <path d="M130 140 C 92 142, 46 128, 26 92 C 18 78, 16 62, 22 52 C 27 44, 36 46, 40 54 L 46 66
           C 44 54, 46 44, 54 42 C 62 40, 66 48, 67 58 L 69 70 C 68 58, 72 50, 80 50 C 88 50, 90 58, 90 66 L 91 76
           C 92 66, 96 60, 104 61 C 111 62, 113 70, 112 78 L 110 96 C 114 104, 122 108, 130 108 Z"
        fill="url(#handFill)" stroke="#8a6a1f" stroke-width="2.4" stroke-linejoin="round"/>
  <!-- right hand, mirrored -->
  <path d="M130 140 C 168 142, 214 128, 234 92 C 242 78, 244 62, 238 52 C 233 44, 224 46, 220 54 L 214 66
           C 216 54, 214 44, 206 42 C 198 40, 194 48, 193 58 L 191 70 C 192 58, 188 50, 180 50 C 172 50, 170 58, 170 66 L 169 76
           C 168 66, 164 60, 156 61 C 149 62, 147 70, 148 78 L 150 96 C 146 104, 138 108, 130 108 Z"
        fill="url(#handFill)" stroke="#8a6a1f" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M26 92 C 46 128, 92 142, 130 140 C 168 142, 214 128, 234 92" fill="url(#handShade)" stroke="none"/>
  <!-- finger creases -->
  <g stroke="#8a6a1f" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".55">
    <path d="M46 66 C 52 84, 60 96, 72 104"/><path d="M69 70 C 73 86, 80 96, 92 104"/><path d="M91 76 C 94 88, 100 98, 110 104"/>
    <path d="M214 66 C 208 84, 200 96, 188 104"/><path d="M191 70 C 187 86, 180 96, 168 104"/><path d="M169 76 C 166 88, 160 98, 150 104"/>
  </g>
  <path d="M130 108 L 130 140" stroke="#8a6a1f" stroke-width="1.8" opacity=".6"/>
</svg>`;

const COIN_SVG = `
<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="coinG" cx=".35" cy=".3" r=".8">
      <stop offset="0" stop-color="#fff4c8"/>
      <stop offset=".45" stop-color="#f2c94c"/>
      <stop offset="1" stop-color="#b8860b"/>
    </radialGradient>
  </defs>
  <circle cx="20" cy="20" r="18.5" fill="url(#coinG)" stroke="#8a6a1f" stroke-width="1.5"/>
  <circle cx="20" cy="20" r="13.5" fill="none" stroke="#a87b12" stroke-width="1.2" opacity=".7"/>
  <path d="M20 11 l2.6 6.3 6.4 2.7 -6.4 2.7 -2.6 6.3 -2.6 -6.3 -6.4 -2.7 6.4 -2.7z" fill="#a87b12" opacity=".75"/>
</svg>`;

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function mountGiving(el) {
  if (!el || el.dataset.mounted) return;
  el.dataset.mounted = '1';
  el.insertAdjacentHTML('beforeend', `<div class="coin-pile"></div>${HANDS_SVG}`);
  el._pile = 0;
}

// Drop one coin into the hands. Coins settle in a small pile; older ones fade away.
export function dropCoin(el, { delay = 0 } = {}) {
  if (!el) return;
  mountGiving(el);
  const pile = el.querySelector('.coin-pile');
  const coin = document.createElement('div');
  coin.className = 'coin';
  coin.innerHTML = COIN_SVG;
  const n = el._pile++;
  // Landing spot: a loose heap in the middle of the bowl.
  const slots = [[0, 4], [-9, -2], [9, -3], [0, -10], [-6, -17], [7, -18], [0, -25], [-3, -32]];
  const [lx, ly] = slots[n % slots.length];
  const startX = lx + (Math.random() * 60 - 30);
  coin.style.setProperty('--x', `${lx}px`);
  coin.style.setProperty('--y', `${ly}px`);
  pile.appendChild(coin);

  if (reduceMotion()) {
    coin.style.transform = `translate(${lx}px, ${ly}px)`;
  } else {
    const fall = el.clientHeight * 0.9 + 60;
    coin.animate(
      [
        { transform: `translate(${startX}px, ${-fall}px) rotateY(0deg) scale(1.05)`, opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.12 },
        { transform: `translate(${lx}px, ${ly}px) rotateY(720deg) scale(1)`, easing: 'cubic-bezier(.3,0,.6,1)', offset: 0.78 },
        { transform: `translate(${lx}px, ${ly - 12}px) rotateY(810deg) scale(1)`, easing: 'ease-out', offset: 0.88 },
        { transform: `translate(${lx}px, ${ly}px) rotateY(900deg) scale(1)`, easing: 'ease-in', offset: 1 },
      ],
      { duration: 1300, delay, fill: 'both' },
    ).finished.then(() => {
      el.classList.remove('glow');
      void el.offsetWidth; // restart the glow animation
      el.classList.add('glow');
    }).catch(() => {});
  }
  // Keep the pile small.
  const coins = pile.querySelectorAll('.coin');
  if (coins.length > 8) {
    const old = coins[0];
    old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(() => old.remove()).catch(() => old.remove());
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
