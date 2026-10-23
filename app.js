import { mountChallenge } from './challenge.js';
import { loadRecords, rankNames } from './records.js';

const app = document.querySelector('#app');
const NS = 'http://www.w3.org/2000/svg';
let words = [], glyphs = {}, filter = 'すべて', query = '', onlyDone = false;
let records = {};
const storage = { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) };
const passedCount = () => Object.values(records).filter(r => r.bestRank !== 'none').length;
let cleanup = () => {};
let completed;
try { completed = new Set(JSON.parse(localStorage.getItem('kanji-practice-v1') || '[]')); }
catch { completed = new Set(); }
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories = ['すべて', '暮らし', 'ことば', '自然', '食べもの', '生きもの'];
const normalize = s => s.normalize('NFKC').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).trim();

function card(word, i) {
  const done = [...word.word].every(c => completed.has(c));
  const medals = [...word.word].map(c => { const record = records[c]; return record ? `<span class="mini-medal ${record.bestRank}">${c} ${record.bestRank === 'none' ? record.bestScore + '点' : rankNames[record.bestRank]}</span>` : ''; }).join('');
  return `<a class="word-card" href="#practice/${i}/0"><span class="card-top"><span>${escape(word.category)}</span><span class="card-check ${done ? 'done' : ''}" aria-label="${done ? '練習済み' : '未練習'}">${done ? '✓' : '↗'}</span></span><span class="word">${escape(word.word)}</span><span class="reading">${escape(word.reading)}</span>${medals ? `<span class="card-medals">${medals}</span>` : ''}<span class="card-bottom">${[...word.word].length}文字を練習 <span aria-hidden="true">→</span></span></a>`;
}

function home() {
  app.innerHTML = `<section class="hero"><div><p class="eyebrow">書くを、もう一度。</p><h1>読めるけれど、<br><span>書けない漢字</span>を。</h1><p class="hero-description">一画ずつ見て、指でなぞる。<br>忘れていた漢字と、ゆっくり向き合う時間。</p><a class="primary hero-cta" href="#practice/0/0">さっそく練習する <span aria-hidden="true">→</span></a><div class="hero-facts"><span>厳選 <b>100</b> 字</span><span>登録不要</span><span>無料・広告なし</span></div></div><div class="hero-art" aria-hidden="true"><div class="art-paper"><span class="art-number">01 — 一画から、ていねいに。</span><svg viewBox="0 0 109 109"><path class="art-grid" d="M54.5 0V109M0 54.5H109M0 0L109 109M109 0L0 109"/><g fill="none" stroke="#293e36" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${glyphs['憧'].map((d,i) => `<path d="${d}" ${i === 0 ? 'stroke="#b4513b"' : ''}/>`).join('')}</g></svg><span class="art-label">憧 <span>あこがれる</span></span></div><span class="art-stamp">日々<br>練習</span></div></section>
  <section class="collection-summary"><div><p class="eyebrow">見本なしで、どこまで書ける？</p><h2><b>${passedCount()}</b><span> / 100字 合格</span></h2><p>80点で銅、90点で銀、95点で金。自己ベストを更新しよう。</p></div><a class="primary" href="#collection">合格コレクションを見る →</a></section>
  <section class="library" aria-labelledby="library-title"><div class="section-top"><div><p class="eyebrow">小さな積み重ねを、ここから。</p><h2 id="library-title">漢字を選ぶ<span>全 ${words.length} 語</span></h2></div><div class="practice-count"><b>${completed.size}</b> / 100 字 <span>練習済み</span></div></div><div class="search-row"><label class="search"><span aria-hidden="true">⌕</span><input id="search" type="search" placeholder="漢字・読みで探す（例：薔薇、ばら）" aria-label="漢字・読みで検索" value="${escape(query)}"></label><label class="done-filter"><input id="only-done" type="checkbox" ${onlyDone ? 'checked' : ''}> 練習済みだけ</label></div><div class="filters" aria-label="カテゴリー">${categories.map(c => `<button data-category="${c}" aria-pressed="${filter === c}">${c}</button>`).join('')}</div><p id="results-count" class="results-count" role="status"></p><div id="word-grid" class="word-grid"></div></section>`;
  const search = document.querySelector('#search');
  search.addEventListener('input', () => { query = search.value; updateList(); });
  document.querySelector('#only-done').addEventListener('change', e => { onlyDone = e.target.checked; updateList(); });
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    filter = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', b === button));
    updateList();
  }));
  updateList();
}

function updateList() {
  const q = normalize(query);
  const selected = words.map((word, i) => ({word, i})).filter(({word}) =>
    (filter === 'すべて' || filter === word.category) &&
    (!onlyDone || [...word.word].every(c => completed.has(c))) &&
    (normalize(word.word).includes(q) || normalize(word.reading).includes(q)));
  document.querySelector('#results-count').textContent = `${selected.length} 語${query ? 'が見つかりました' : ''}`;
  document.querySelector('#word-grid').innerHTML = selected.length ? selected.map(({word, i}) => card(word,i)).join('') : '<div class="empty"><h3>該当する漢字がありません</h3><p>検索する文字やカテゴリーを変えてみてください。</p><button class="secondary" id="clear-filter">条件をリセット</button></div>';
  document.querySelector('#clear-filter')?.addEventListener('click', () => { query = ''; filter = 'すべて'; onlyDone = false; home(); });
}

function practice(wordIndex, charIndex) {
  const word = words[wordIndex];
  const chars = word && [...word.word];
  if (!chars || !chars[charIndex]) { location.hash = ''; return; }
  const character = chars[charIndex], paths = glyphs[character];
  let mode = 'watch', progress = 0, playing = false, raf = 0, last = 0, speed = 1;
  let strokes = [], active = null, guide = true, currentAnnouncement = -1;
  app.innerHTML = `<section class="practice-page"><a class="back-link" href="#">← 漢字一覧に戻る</a><div class="practice-heading"><div><p class="eyebrow">${escape(word.category)} ／ ${escape(word.reading)}</p><h1>${escape(word.word)}</h1></div><p>一画ずつ、形をたしかめながら。</p></div><div class="character-tabs" aria-label="練習する文字">${chars.map((c,i) => `<a href="#practice/${wordIndex}/${i}" ${i === charIndex ? 'aria-current="page"' : ''}>${c}<span>${glyphs[c].length}画</span></a>`).join('')}</div><div class="practice-layout"><div class="practice-workspace"><div class="mode-tabs" role="group" aria-label="練習方法"><button id="watch-mode" aria-pressed="true">01 <span>書き順を見る</span></button><button id="trace-mode" aria-pressed="false">02 <span>なぞって書く</span></button></div><div class="board-wrap"><svg id="board" viewBox="0 0 109 109" aria-label="${character}の書き順。${paths.length}画" role="img"><path class="board-grid" d="M54.5 0V109M0 54.5H109M0 0L109 109M109 0L0 109"/><g id="guide" fill="none" stroke="#dfded5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}"/>`).join('')}</g><g id="animated" fill="none" stroke="#293e36" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths.map(d => `<path d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join('')}</g><g id="ink" fill="none" stroke="#b4513b" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"></g></svg><span id="board-badge" class="board-badge">書き順</span></div><div id="watch-controls"><div class="stroke-status"><span id="stroke-count" role="status">0 / ${paths.length} 画</span><label>速さ <select id="speed" aria-label="再生速度"><option value="0.5">ゆっくり</option><option value="1" selected>ふつう</option><option value="1.8">はやく</option></select></label></div><div class="progress-track"><div id="progress-fill"></div></div><div class="playback-controls"><button class="secondary" id="restart" aria-label="最初に戻す">↺ 最初から</button><button class="primary" id="play">▶ 再生する</button><button class="secondary" id="step">1画進む →</button></div></div><div id="trace-controls" hidden><p class="trace-note">指・ペン・マウスで、見本をなぞってみましょう。</p><div class="trace-actions"><button class="secondary" id="undo" disabled>↶ ひとつ戻す</button><button class="secondary" id="erase" disabled>すべて消す</button><label><input id="show-guide" type="checkbox" checked> 見本を表示</label></div><p class="small-note">自由になぞる練習です。書き順や形の自動採点は行いません。</p></div></div><aside class="practice-aside"><span class="aside-number">PRACTICE / ${String(charIndex + 1).padStart(2,'0')}</span><h2>「${character}」を<br>自分の手で。</h2><p>${paths.length}画の動きを目で追ったら、<br>次は実際になぞってみましょう。</p><ol><li><span>01</span><div><b>まずは、見る</b><p>再生ボタンで書き順を確認。<br>一画ずつ進めることもできます。</p></div></li><li><span>02</span><div><b>つぎに、なぞる</b><p>薄い見本に重ねて、<br>自分のペースで書きましょう。</p></div></li></ol><a class="primary challenge-entry" href="#challenge/${wordIndex}/${charIndex}">見本なしで挑戦 →</a><p class="small-note">80点で合格。形・位置・書き順を採点します。${records[character] ? ` 自己ベスト ${records[character].bestScore}点` : ''}</p><button class="complete-button" id="complete">${completed.has(character) ? '✓ 練習済み（取り消す）' : '✓ この文字を練習済みにする'}</button><p id="save-message" class="small-note" role="status">練習の記録は、このブラウザに保存されます。</p>${charIndex + 1 < chars.length ? `<a class="next-character" href="#practice/${wordIndex}/${charIndex+1}">次の文字「${chars[charIndex+1]}」へ →</a>` : '<a class="next-character" href="#">ほかの漢字も練習する →</a>'}</aside></div></section>`;
  const board = document.querySelector('#board'), ink = document.querySelector('#ink');
  const animated = document.querySelector('#animated');
  const animatedPaths = [...animated.children];
  const playButton = document.querySelector('#play');
  const select = id => document.getElementById(id);
  function paint() {
    animatedPaths.forEach((p,i) => {
      p.setAttribute('stroke-dashoffset', 1 - Math.max(0,Math.min(1, progress-i)));
      p.setAttribute('stroke', progress > i && progress < i+1 ? '#b4513b' : '#293e36');
    });
    const count = Math.min(paths.length, Math.ceil(progress));
    if (currentAnnouncement !== count) {
      select('stroke-count').textContent = `${count} / ${paths.length} 画`;
      currentAnnouncement = count;
    }
    select('progress-fill').style.width = `${progress / paths.length * 100}%`;
    select('step').disabled = progress >= paths.length;
  }
  function stop() { playing = false; cancelAnimationFrame(raf); last = 0; playButton.textContent = progress >= paths.length ? '▶ もう一度再生' : '▶ 再生する'; }
  function tick(time) {
    if (!playing) return;
    if (last) progress = Math.min(paths.length, progress + (time-last) / 950 * speed);
    last = time;
    paint();
    if (progress >= paths.length) stop(); else raf = requestAnimationFrame(tick);
  }
  playButton.addEventListener('click', () => {
    if (playing) { stop(); return; }
    if (progress >= paths.length) progress = 0;
    playing = true; last = 0; playButton.textContent = 'Ⅱ 一時停止'; raf = requestAnimationFrame(tick);
  });
  select('restart').addEventListener('click', () => { stop(); progress = 0; paint(); });
  select('step').addEventListener('click', () => { stop(); progress = Math.min(paths.length, Math.floor(progress)+1); paint(); });
  select('speed').addEventListener('change', e => { speed = Number(e.target.value); });
  function setMode(next) {
    stop(); mode = next;
    animated.style.display = mode === 'watch' ? '' : 'none';
    ink.style.display = mode === 'trace' ? '' : 'none';
    select('guide').style.display = mode === 'watch' || guide ? '' : 'none';
    select('watch-controls').hidden = mode !== 'watch';
    select('trace-controls').hidden = mode !== 'trace';
    select('watch-mode').setAttribute('aria-pressed', mode === 'watch');
    select('trace-mode').setAttribute('aria-pressed', mode === 'trace');
    board.classList.toggle('trace', mode === 'trace');
    select('board-badge').textContent = mode === 'trace' ? 'なぞり書き' : '書き順';
  }
  select('watch-mode').addEventListener('click', () => setMode('watch'));
  select('trace-mode').addEventListener('click', () => setMode('trace'));
  select('show-guide').addEventListener('change', e => { guide = e.target.checked; select('guide').style.display = guide ? '' : 'none'; });
  function updateInk() { select('erase').disabled = select('undo').disabled = strokes.length === 0; }
  function point(event) {
    const p = board.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    const local = p.matrixTransform(board.getScreenCTM().inverse());
    return `${Math.max(0,Math.min(109,local.x)).toFixed(2)},${Math.max(0,Math.min(109,local.y)).toFixed(2)}`;
  }
  board.addEventListener('pointerdown', e => {
    if (mode !== 'trace' || active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    board.setPointerCapture(e.pointerId);
    const line = document.createElementNS(NS,'polyline');
    const start = point(e);
    line.setAttribute('points', `${start} ${start}`); ink.append(line);
    active = {id:e.pointerId, line}; strokes.push(line); updateInk();
  });
  board.addEventListener('pointermove', e => {
    if (!active || active.id !== e.pointerId) return;
    active.line.setAttribute('points', `${active.line.getAttribute('points')} ${point(e)}`);
  });
  const end = e => { if (active?.id === e.pointerId) active = null; };
  board.addEventListener('pointerup', end); board.addEventListener('pointercancel', end); board.addEventListener('lostpointercapture', end);
  select('undo').addEventListener('click', () => { strokes.pop()?.remove(); active = null; updateInk(); });
  select('erase').addEventListener('click', () => { ink.replaceChildren(); strokes = []; active = null; updateInk(); });
  select('complete').addEventListener('click', () => {
    if (completed.has(character)) completed.delete(character); else completed.add(character);
    select('complete').textContent = completed.has(character) ? '✓ 練習済み（取り消す）' : '✓ この文字を練習済みにする';
    try { localStorage.setItem('kanji-practice-v1', JSON.stringify([...completed])); select('save-message').textContent = completed.has(character) ? '練習の記録を保存しました。' : '練習済みを取り消しました。'; }
    catch { select('save-message').textContent = 'このブラウザでは記録を保存できません。ページを閉じると記録が消えます。'; }
  });
  document.addEventListener('visibilitychange', visibility);
  function visibility() { if (document.hidden) stop(); }
  cleanup = () => { stop(); document.removeEventListener('visibilitychange', visibility); };
  paint();
}

function collection() {
  const characters = [...new Set(words.flatMap(w => [...w.word]))];
  app.innerHTML = `<section class="collection-page"><a class="back-link" href="#">← 漢字一覧に戻る</a><p class="eyebrow">MY KANJI COLLECTION</p><h1>書ける漢字が、増えていく。</h1><p class="collection-total"><b>${passedCount()}</b> / 100字 合格</p><p class="small-note">見本なしテストで合格するとメダルを獲得。銅80点・銀90点・金95点を目指しましょう。</p><div class="collection-grid">${characters.map(c => {
    const record = records[c];
    const rank = record?.bestRank || 'none';
    const wordIndex = words.findIndex(w => w.word.includes(c));
    const charIndex = [...words[wordIndex].word].indexOf(c);
    return `<a class="collection-tile ${rank}" href="#practice/${wordIndex}/${charIndex}" aria-label="${c} ${rankNames[rank]}${record ? ` 自己ベスト${record.bestScore}点 ${record.attempts}回挑戦` : ' 未挑戦'}"><span class="collection-character">${c}</span><span class="collection-rank">${record ? rank === 'none' ? '挑戦中' : rankNames[rank] + 'メダル' : '未挑戦'}</span><span>${record ? `${record.bestScore}点 · ${record.attempts}回` : '—'}</span></a>`;
  }).join('')}</div></section>`;
}

function about() {
  app.innerHTML = `<article class="about-page"><a class="back-link" href="#">← 漢字一覧に戻る</a><p class="eyebrow">ABOUT THIS APP</p><h1>書くを、もう一度。</h1><p>「大人の漢字書き順」は、読めるけれど書くと迷ってしまう漢字を、ゆっくり練習するためのWebアプリです。</p><h2>57語、100字を収録</h2><p>書き順アニメーションを見て、指・ペン・マウスでなぞって練習できます。見本なしテストでは、お手本との一致度を100点満点で評価します。形・位置60点、方向30点、画数10点。80点以上で全画の合格条件を満たすと銅、90点で銀、95点で金のメダルが残ります。書道の美しさの判定ではありません。文字ごとの練習済み記録も残せます。</p><h2>データとプライバシー</h2><p>登録・広告・アクセス解析はありません。なぞった線はサーバーに送信されません。練習済み・自己ベスト・メダル・挑戦回数の記録は、このブラウザの端末内（localStorage）にのみ保存されます。ブラウザのデータを削除すると記録も消えます。</p><h2>書き順データの出典</h2><p><a href="https://kanjivg.tagaini.net/" target="_blank" rel="noreferrer">KanjiVG</a> — Copyright © 2009/2010/2011 Ulrich Apel and KanjiVG contributors.</p><p>原本のSVGパスを順番・座標を保持したままJSONに変換し、同梱しています。書き順データと変換後のJSONは <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> で提供されます。</p><p><a href="./THIRD_PARTY_NOTICES.md">出典・変更内容の詳細</a> ／ <a href="./data/glyphs.json" download>書き順データをダウンロード</a></p><p class="small-note">字体や書き順には、資料・流派による違いがあります。</p></article>`;
}

function route() {
  cleanup(); cleanup = () => {};
  const match = location.hash.match(/^#(practice|challenge)\/(\d+)\/(\d+)$/);
  if (match) {
    const wordIndex = Number(match[2]), charIndex = Number(match[3]);
    if (!words[wordIndex] || ![...words[wordIndex].word][charIndex]) { location.hash = ''; return; }
    if (match[1] === 'practice') practice(wordIndex, charIndex);
    else cleanup = mountChallenge({ app, word: words[wordIndex], wordIndex, charIndex, paths: glyphs[[...words[wordIndex].word][charIndex]], records, storage, retry: route });
  }
  else if (location.hash === '#collection') collection();
  else if (location.hash === '#about') about();
  else home();
  window.scrollTo(0,0);
  app.setAttribute('aria-busy','false');
}

async function init() {
  try {
    const responses = await Promise.all(['words','glyphs'].map(name => fetch(new URL(`./data/${name}.json`, import.meta.url))));
    if (responses.some(r => !r.ok)) throw new Error('Data unavailable');
    [words, glyphs] = await Promise.all(responses.map(r => r.json()));
    completed = new Set([...completed].filter(c => Object.hasOwn(glyphs,c)));
    records = loadRecords(storage, Object.keys(glyphs));
    window.addEventListener('hashchange', route); route();
  } catch (error) {
    app.setAttribute('aria-busy','false');
    app.innerHTML = '<div class="empty"><h1>漢字データを読み込めませんでした</h1><p>通信状態を確認して、もう一度お試しください。</p><button class="primary" id="retry">再読み込み</button></div>';
    document.querySelector('#retry').addEventListener('click', () => location.reload());
    console.error(error);
  }
}
init();
