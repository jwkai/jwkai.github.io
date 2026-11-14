// Self-test of the player's controls, run on the open scene: open the page with ?test (scripts/web_page.py copies
// this file next to it). Presses each control the way a click does and checks where the playhead ends up against
// the recording (steps, captions, end states). Needs the page visible: a hidden tab throttles timers.
(async () => {
  const out = $('tests'); out.style.display = 'block'; out.textContent = 'running the control self-test…';
  const sleep = ms => new Promise(r => setTimeout(r, ms)), click = id => $(id).click();
  const until = async (c, ms = 20000) => { const t = performance.now(); while (!c() && performance.now() - t < ms) await sleep(20); return c(); };
  const R = [], ok = (name, cond, detail) => R.push((cond ? 'PASS ' : 'FAIL ') + name + (detail ? `  [${detail}]` : ''));
  const reset = () => { pause(); $('speed').value = '1'; $('beatstop').checked = false; $('caps').checked = true; };
  $('cont').checked = false;                      // stay inside this scene until the cross-scene checks
  const i0 = S.i, D = S.D, fps = D.fps, m = D.moves, C = D.capts.filter(c => c.land > 0.5);
  const rects = () => ['bbeat', 'bstep', 'rev', 'play', 'fstep', 'fbeat'].map(i => { const r = $(i).getBoundingClientRect(); return [r.left, r.top, r.width].map(Math.round).join(','); }).join('|') + '|' + Math.round(stage.getBoundingClientRect().top);

  reset(); jump(0); const L0 = rects(); click('play'); await sleep(300); const L1 = rects(); click('play'); click('fstep'); await sleep(100); const L2 = rects();
  jump(Math.min(300, LAST())); click('rev'); await sleep(200); const L3 = rects(); reset();
  ok('buttons and picture never move', L0 === L1 && L1 === L2 && L2 === L3);

  jump(0); let t = performance.now(); click('play'); await sleep(3000); const played = S.pos / fps, wall = (performance.now() - t) / 1000; click('play'); const p0 = S.pos; await sleep(500);
  ok('play runs at real time', Math.abs(played - wall) < 0.1, `${played.toFixed(2)} s in ${wall.toFixed(2)} s`);
  ok('pause holds', S.pos === p0 && S.dir === 0 && $('play').textContent.includes('play'));

  reset(); jump(0);
  for (let k = 0; k < Math.min(3, m.length); k++) {
    click('fstep'); await until(() => S.dir === 0);
    ok(`step ${k + 1} stops at the end of movement ${k + 1}`, Math.round(S.pos) === m[k].f1 - 1, `at ${Math.round(S.pos)}, end ${m[k].f1 - 1}`);
    if (D.endAt.size) ok(`step ${k + 1} shows the finished state`, String(S.fi).includes('e'));
  }
  if (m.length > 3) {
    click('fstep'); await sleep(150); const mid = S.pos; click('fstep');
    ok('step during a step finishes it at once', S.dir === 0 && S.pos === m[3].f1 - 1 && mid < m[3].f1 - 1, `${mid.toFixed(1)} -> ${S.pos}`);
    click('bstep'); ok('back: to just before movement 4', S.pos === m[3].f0 - 1, `${S.pos}`);
    click('bstep'); ok('back again: just before movement 3', S.pos === m[2].f0 - 1, `${S.pos}`);
    click('fstep'); await until(() => S.dir === 0); ok('step after back replays movement 3', Math.round(S.pos) === m[2].f1 - 1);
  }

  if (C.length >= 3) {
    reset(); jump(0); click('fbeat'); await sleep(50);
    ok('caption ⇥ lands on the next caption, fully shown', S.pos === C[0].land && $('now').innerText.includes(C[0].text.slice(0, 25)), `${S.pos} vs cue ${C[0].f}`);
    click('fbeat'); await sleep(50); ok('caption ⇥ again: the one after', S.pos === C[1].land);
    click('bbeat'); await sleep(50); ok('caption ⇤ right after landing: the one before', S.pos === C[0].land);
    jump(C[2].land + 2 * fps); click('bbeat'); await sleep(50); ok('caption ⇤ 2 s into a caption: back to its start', S.pos === C[2].land);
    { // deterministic: a tick that ends a hair short of a caption, then one that passes it, must stop on it
      reset(); $('beatstop').checked = true; const L = C[1].land, f = D.fps;
      S.pos = L - 0.5; S.dir = 1; S.stopAt = null; S.clock = 1000; advance(1000 + 1000 * 0.496 / f);
      const short = S.pos, still = S.dir; advance(1000 + 1000 * 0.996 / f);
      ok('stop at a caption the clock lands just short of', still === 1 && S.pos === L && S.dir === 0, `${short.toFixed(3)} -> ${S.pos}`);
    }
    reset(); $('beatstop').checked = true; jump(C[1].land); click('play'); const stopped = await until(() => S.dir === 0);
    ok('stop at each caption', stopped && S.pos === C[2].land, `${S.pos} vs ${C[2].land}; now: dir ${S.dir} stopAt ${S.stopAt} box ${$('beatstop').checked}`);
  }

  reset(); const r0 = Math.min(600, LAST()); jump(r0); $('speed').value = '2'; t = performance.now(); click('rev'); await sleep(1500);
  const back = (r0 - S.pos) / fps, w2 = (performance.now() - t) / 1000; click('rev');
  ok('reverse at 2×', Math.abs(back - 2 * w2) < 0.15 && S.dir === 0, `${back.toFixed(2)} s back in ${w2.toFixed(2)} s`);

  { // slow motion: halfway between two different recorded frames of one play, shapes are blended, not held
    reset(); const f = D.fidx.findIndex((x, k) => k < LAST() && D.stepOf[k] === D.stepOf[k + 1] && x !== D.fidx[k + 1]
      && D.frames[x].length === D.frames[D.fidx[k + 1]].length && D.frames[x].some((id, j) => id !== D.frames[D.fidx[k + 1]][j] && !D.shapes[id][6]));
    if (f >= 0) {
      const pic = () => S.pool.map(p => ['d', 'transform', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity'].map(a => p.getAttribute(a)).join());
      jump(f); const A = pic();
      S.pos = f + 0.5; draw(); const M = pic();
      jump(f + 1); const B = pic();
      ok('slow motion blends between recorded frames', S.tw === 0 && M.some((x, k) => x !== A[k] && x !== B[k]), `frame ${f}`);
      jump(f); $('speed').value = '0.1'; let draws = 0, last = ''; click('play');
      const t0 = performance.now(); while (performance.now() - t0 < 600) { await new Promise(r => { requestAnimationFrame(r); setTimeout(r, 40); });
        const k = pic().join(); if (k !== last) { draws++; last = k; } }
      pause(); const crossed = S.pos - f;   // without blending there would be one picture per recorded frame crossed
      ok('0.1× shows in-between pictures, not one per recorded frame', draws > 3 * (crossed + 1), `${draws} pictures across ${crossed.toFixed(1)} frames`);
    }
  }

  reset(); jump(10); stage.dispatchEvent(new MouseEvent('click')); const sp = S.dir; stage.dispatchEvent(new MouseEvent('click'));
  ok('click the picture: play, click again: pause', sp === 1 && S.dir === 0);
  const capShapes = D.shapes.filter(s => s[6]).length;
  if (capShapes) { jump(C.length ? C[0].land : 0); const on = S.pool.filter(p => p.style.display !== 'none').length; toggleCaps();
    const off = S.pool.filter(p => p.style.display !== 'none').length; toggleCaps(); ok('captions toggle hides only the caption', off < on, `${on} -> ${off} shapes`); }
  jump(LAST()); click('play'); ok('play at the end restarts', S.dir === 1 && S.pos < 1); reset();
  dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); ok('→ key steps', S.stopAt != null || m.length === 0); reset();

  // across scenes: step past the end opens the next scene, step back at its start returns to this one
  const next = okIdx(1);
  if (next >= 0) {
    jump(LAST()); await stepFwd(); await until(() => S.i === next && S.dir === 0);
    ok('step at the end opens the next scene and plays its first step', S.i === next && S.pos > 0, `scene ${S.i + 1}, frame ${Math.round(S.pos)}`);
    jump(0); await stepBack(); ok('step back at the start returns to the previous scene, at its end', S.i === i0 && S.pos === LAST());
  }
  $('cont').checked = true; reset();
  const fails = R.filter(r => r.startsWith('FAIL'));
  out.textContent = `${PLAYLIST[i0].cls}: ${R.length - fails.length}/${R.length} checks pass\n\n` + R.join('\n');
  window.__testResult = { scene: PLAYLIST[i0].cls, pass: R.length - fails.length, total: R.length, fails };
})();
