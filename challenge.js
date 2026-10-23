import { achievementMarkup, animateResultScore } from './achievements.js';
import { scoreAttempt } from './scoring.js';
import { recordAttempt, rankNames } from './records.js';

const NS = 'http://www.w3.org/2000/svg';
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountChallenge({ app, word, wordIndex, charIndex, paths, records, storage, retry }) {
  const character = [...word.word][charIndex];
  const previous = records[character];
  let submitted = false, active = null, strokes = [];
  let stopScoreAnimation = () => {};
  app.innerHTML = `<section class="challenge-page"><a class="back-link" href="#practice/${wordIndex}/${charIndex}">← 練習に戻る</a>
    <div class="challenge-heading"><p class="eyebrow">NO HINT CHALLENGE</p><h1>「${escape(word.reading)}」の${charIndex + 1}文字目</h1><p>見本なしで、覚えた漢字を書いてみましょう。</p></div>
    <div class="challenge-layout"><div class="practice-workspace">
      <div class="challenge-board-top"><span>見本なしテスト</span><span id="draw-count" role="status">0画 入力済み</span></div>
      <div class="board-wrap challenge-drawing-surface"><svg id="challenge-board" class="trace" viewBox="0 0 109 109" aria-label="解答を書く方眼" role="img"><path class="board-grid" d="M54.5 0V109M0 54.5H109M0 0L109 109M109 0L0 109"/><g id="answer-guide" fill="none" stroke="#a5afa0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></g><g id="answer-ink" fill="none" stroke="#b4513b" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"></g></svg></div>
      <div class="challenge-edit"><button id="challenge-undo" class="secondary" disabled>↶ ひとつ戻す</button><button id="challenge-erase" class="secondary" disabled>すべて消す</button></div>
      <p id="input-notice" class="small-note" role="status" hidden>入力が中断されました。線は残しています。「ひとつ戻す」で中断した線を戻して、書き直してください。</p><button id="grade" class="primary grade-button" disabled>採点する →</button>
      <div id="result-overlay-controls" hidden><label><input id="answer-overlay" type="checkbox" checked> お手本を重ねる（緑）</label><span>あなたの線（赤）</span></div>
    </div><aside id="challenge-aside"><span class="aside-number">目指せ、80点。</span><h2>覚えた形を、<br>自分の力で。</h2><p>画数・書き順・線の方向に加え、<br>位置や形までしっかり採点します。</p><div class="challenge-best">自己ベスト <b>${previous ? previous.bestScore + '点' : '—'}</b><small>${previous ? previous.attempts + '回挑戦' : 'はじめての挑戦'}</small></div><p class="small-note">お手本との一致度を評価します。書道の美しさを判定するものではありません。<br>採点するまで答えは表示されません。</p><div class="medal-targets"><span>銅 <b>80点</b></span><span>銀 <b>90点</b></span><span>金 <b>95点</b></span></div></aside></div></section>`;
  const select = id => document.getElementById(id);
  const board = select('challenge-board'), ink = select('answer-ink');
  const point = e => {
    const p = board.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const local = p.matrixTransform(board.getScreenCTM().inverse());
    return [Math.max(0, Math.min(109, local.x)), Math.max(0, Math.min(109, local.y))];
  };
  const update = () => {
    const interrupted = strokes.some(stroke => stroke.interrupted);
    select('draw-count').textContent = `${strokes.length}画 入力済み${interrupted ? '（入力中断）' : ''}`;
    select('input-notice').hidden = !interrupted;
    select('challenge-undo').disabled = select('challenge-erase').disabled = submitted || !strokes.length || !!active;
    select('grade').disabled = submitted || !strokes.length || !!active || interrupted;
  };
  const append = e => {
    if (!active || active.id !== e.pointerId) return;
    active.stroke.points.push(point(e));
    active.stroke.line.setAttribute('points', active.stroke.points.map(p => p.join(',')).join(' '));
  };
  board.addEventListener('pointerdown', e => {
    if (submitted || active || strokes.some(stroke => stroke.interrupted) || e.isPrimary === false || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.cancelable) e.preventDefault();
    // Global move/up handlers also work if Chrome releases capture during a stroke.
    try { board.setPointerCapture(e.pointerId); } catch { /* Continue via window events. */ }
    const line = document.createElementNS(NS, 'polyline');
    const start = point(e);
    line.setAttribute('points', `${start} ${start}`); ink.append(line);
    const stroke = { line, points: [start] }; strokes.push(stroke);
    active = { id: e.pointerId, stroke }; update();
  });
  const move = e => {
    if (!active || active.id !== e.pointerId) return;
    if (e.cancelable) e.preventDefault();
    const samples = e.getCoalescedEvents?.() || [];
    for (const sample of samples.length ? samples : [e]) append(sample);
  };
  const finish = e => {
    if (active?.id !== e.pointerId) return;
    append(e); active = null; update();
  };
  const interrupt = e => {
    if (!active || (e?.pointerId !== undefined && active.id !== e.pointerId)) return;
    // A cancellation must never silently erase the user's ink.
    active.stroke.interrupted = true;
    active.stroke.line.setAttribute('stroke-dasharray', '1.5 1.5');
    active = null; update();
  };
  const visibility = () => { if (document.hidden) interrupt(); };
  // lostpointercapture bubbles from SVG children and does not mean the stroke was canceled.
  // Keep following move/up on window, even if the pointer leaves the drawing surface.
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', interrupt);
  window.addEventListener('blur', interrupt);
  document.addEventListener('visibilitychange', visibility);
  board.addEventListener('dragstart', e => e.preventDefault());
  select('challenge-undo').addEventListener('click', () => { strokes.pop()?.line.remove(); update(); });
  select('challenge-erase').addEventListener('click', () => { ink.replaceChildren(); strokes = []; update(); });
  select('grade').addEventListener('click', () => {
    if (submitted || active || !strokes.length || strokes.some(stroke => stroke.interrupted)) return;
    submitted = true; update();
    const reference = paths.map(d => {
      const path = document.createElementNS(NS, 'path'); path.setAttribute('d', d);
      select('answer-guide').append(path);
      const length = path.getTotalLength();
      return Array.from({ length: 257 }, (_, i) => {
        const p = path.getPointAtLength(length * i / 256); return [p.x, p.y];
      });
    });
    const result = scoreAttempt(strokes.map(s => s.points), reference);
    const record = recordAttempt(records, character, result, storage);
    select('grade').hidden = true;
    select('result-overlay-controls').hidden = false;
    select('answer-overlay').addEventListener('change', e => { select('answer-guide').style.display = e.target.checked ? '' : 'none'; });
    select('draw-count').textContent = '採点済み・筆跡は固定されています';
    board.classList.remove('trace');
    board.parentElement.classList.remove('challenge-drawing-surface');
    const difference = record.previous === null ? '最初のスコアを記録しました' : result.score > record.previous ? `自己ベストを${result.score - record.previous}点更新！` : `自己ベスト ${record.previous}点 ／ ベストとの差 ${result.score - record.previous}点`;
    const hasNext = charIndex + 1 < [...word.word].length;
    select('challenge-aside').innerHTML = `<div class="result-card ${record.improved ? 'new-record' : ''}" tabindex="-1" role="region" aria-label="採点結果">${achievementMarkup({ passed: result.passed, rank: result.rank, score: result.score, previous: record.previous })}<p class="eyebrow result-score-label">お手本との一致度</p><div class="result-score" role="img" aria-label="${result.score} / 100点"><span class="score-number" aria-hidden="true">${result.score}</span><span aria-hidden="true"> / 100点</span></div><div class="result-verdict ${result.passed ? result.rank : 'retry'}">${result.passed ? `合格！ ${rankNames[result.rank]}メダル` : '今回は未合格・再挑戦'}</div><p class="record-message">${escape(difference)}</p><h2>答えは「${character}」</h2><p class="result-feedback">${escape(result.feedback)}</p><ul class="result-checks"><li>${result.countOK ? '✓' : '△'} 画数</li><li>${result.directionOK ? '✓' : '△'} 書き順・方向</li><li>${result.shapeOK ? '✓' : '△'} 形・位置</li></ul><p class="small-note">80点以上かつ、全画で画数・順番・方向・形の条件を満たすと合格です。条件が未達の場合は最高79点です。</p><button id="challenge-retry" class="primary">もう一度挑戦 →</button><a class="secondary" href="#practice/${wordIndex}/${charIndex}">練習に戻る</a><a class="next-character" href="${hasNext ? `#challenge/${wordIndex}/${charIndex + 1}` : '#collection'}">${hasNext ? '次の文字に挑戦 →' : '合格コレクションを見る →'}</a><p class="small-note" role="status">${record.saved ? 'このブラウザに記録しました。' : '記録を保存できません。このページを閉じると今回の記録が消えます。'}</p></div>`;
    stopScoreAnimation = animateResultScore(select('challenge-aside').querySelector('.score-number'), result.score);
    select('challenge-retry').addEventListener('click', retry);
    select('challenge-aside').querySelector('.result-card').focus({ preventScroll: true });
    select('challenge-aside').scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  return () => {
    stopScoreAnimation();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', interrupt);
    window.removeEventListener('blur', interrupt);
    document.removeEventListener('visibilitychange', visibility);
    if (active && board.hasPointerCapture(active.id)) board.releasePointerCapture(active.id);
    active = null; strokes = [];
  };
}
