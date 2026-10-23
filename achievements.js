const medals = {
  gold: { label: '金', title: '見事な一筆。', detail: '積み重ねが、金の証になりました。', light: '#fff4bd', dark: '#b08728', particles: 18 },
  silver: { label: '銀', title: '確かな上達。', detail: '磨いた一画に、銀の輝きを。', light: '#f8fcff', dark: '#8a9caa', particles: 12 },
  bronze: { label: '銅', title: '書けた、その喜び。', detail: '見本なしで書き上げた、一歩の証。', light: '#f3d5b6', dark: '#a76e46', particles: 8 },
};

export function achievementMarkup({ passed, rank, score, previous }) {
  const medal = passed ? medals[rank] : null;
  const improved = Number.isFinite(previous) && score > previous;
  const award = medal ? `<div class="achievement-celebration ${rank}" aria-label="${medal.label}メダル獲得">
    <div class="achievement-art" aria-hidden="true">
      <div class="achievement-halo"></div><div class="achievement-ripple"></div>
      <div class="achievement-particles">${Array.from({ length: medal.particles }, (_, i) => {
        const angle = (i / medal.particles) * Math.PI * 2;
        return `<i style="--particle-x:${(Math.cos(angle) * (86 + i % 3 * 13)).toFixed(1)}px;--particle-y:${(Math.sin(angle) * (76 + i % 4 * 9)).toFixed(1)}px;--particle-turn:${i * 43}deg;--particle-delay:${100 + i % 5 * 75}ms"></i>`;
      }).join('')}</div>
      <svg class="achievement-seal" viewBox="0 0 240 250">
        <defs><linearGradient id="award-metal-${rank}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${medal.light}"/><stop offset=".48" stop-color="${medal.dark}"/><stop offset=".55" stop-color="${medal.light}"/><stop offset="1" stop-color="${medal.dark}"/></linearGradient></defs>
        <path class="award-ribbon" d="M78 155 66 227 98 210 118 231 122 160M124 160 125 231 148 210 177 226 161 155"/>
        <circle class="award-face" cx="120" cy="108" r="76" fill="url(#award-metal-${rank})"/>
        <circle class="award-inner" cx="120" cy="108" r="66"/>
        <circle class="award-trace" cx="120" cy="108" r="86" pathLength="1"/>
        <path class="award-branches" d="M65 143Q45 110 68 75M175 143Q195 110 172 75M57 119 47 108M57 103 49 91M61 88 57 77M183 119 193 108M183 103 191 91M179 88 183 77"/>
        <text class="award-glyph" x="120" y="127" text-anchor="middle">${medal.label}</text>
        <text class="award-caption" x="120" y="158" text-anchor="middle">書 の 証</text>
      </svg><span class="award-glint"></span>
    </div><p class="achievement-title">${medal.title}</p><p class="achievement-detail">${medal.detail}</p>
  </div>` : '';
  const best = improved ? `<div class="personal-best-celebration" role="status"><span class="personal-best-stamp" aria-hidden="true">新<br>記録</span><div><span class="personal-best-label">自己ベスト更新</span><strong>＋${score - previous}<small>点</small></strong><span class="personal-best-comparison">${previous}点 → ${score}点<span>前の自分を、ひとつ越えた。</span></span></div></div>` : '';
  return award + best;
}

// All motion finishes automatically; reduced-motion users see the final score immediately.
export function animateResultScore(element, score) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, start;
  const finish = () => {
    cancelAnimationFrame(frame); element.textContent = score;
    preference.removeEventListener('change', change);
  };
  const change = () => { if (preference.matches) finish(); };
  if (preference.matches || score === 0) { element.textContent = score; return () => {}; }
  const tick = now => {
    start ??= now;
    const t = Math.min(1, (now - start) / 950);
    element.textContent = Math.round(score * (1 - (1 - t) ** 3));
    if (t < 1) frame = requestAnimationFrame(tick); else finish();
  };
  element.textContent = '0';
  preference.addEventListener('change', change);
  frame = requestAnimationFrame(tick);
  return finish;
}
