'use strict';
/* SpatialOS 1.3 apps: Timer, Tic-Tac-Toe, Memory, 2048 (installable from the Store) */
(function () {
  const SOS = window.SOS, U = SOS.util, FONT = SOS.FONT, reg = SOS.registerApp, ICONS = SOS.ICONS;
  const clamp = U.clamp, rr = U.rr;
  const WHITE2 = 'rgba(255,255,255,.62)';
  const pad = function (n) { return String(n).padStart(2, '0'); };
  function base(c, x, y, r, a, b) { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }

  /* ---- icons ---- */
  ICONS.timer = function (c, x, y, r) {
    base(c, x, y, r, '#2dd4bf', '#0f766e'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = r * 0.12; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y + r * 0.06, r * 0.48, 0, 7); c.stroke(); c.beginPath(); c.moveTo(x, y + r * 0.06); c.lineTo(x + r * 0.22, y - r * 0.12); c.stroke();
    c.beginPath(); c.moveTo(x - r * 0.12, y - r * 0.6); c.lineTo(x + r * 0.12, y - r * 0.6); c.stroke(); c.restore();
  };
  ICONS.ttt = function (c, x, y, r) {
    base(c, x, y, r, '#a78bfa', '#5b21b6'); c.save(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = r * 0.09; c.lineCap = 'round';
    const s = r * 0.26; [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(x + k * s * 0.5 - s * 0.0, y - r * 0.5); c.lineTo(x + k * s * 0.5, y + r * 0.5); c.stroke(); c.beginPath(); c.moveTo(x - r * 0.5, y + k * s * 0.5); c.lineTo(x + r * 0.5, y + k * s * 0.5); c.stroke(); });
    c.strokeStyle = '#ffd60a'; c.beginPath(); c.arc(x + s, y - s, s * 0.36, 0, 7); c.stroke(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(x - s * 1.3, y + s * 0.7); c.lineTo(x - s * 0.7, y + s * 1.3); c.moveTo(x - s * 0.7, y + s * 0.7); c.lineTo(x - s * 1.3, y + s * 1.3); c.stroke(); c.restore();
  };
  ICONS.memory = function (c, x, y, r) {
    base(c, x, y, r, '#fb923c', '#c2410c'); c.save(); const s = r * 0.42;
    [[-1, -1, '#fff'], [1, -1, '#ffd60a'], [-1, 1, '#ffd60a'], [1, 1, '#fff']].forEach(function (q) { rr(c, x + q[0] * s * 0.62 - s * 0.5, y + q[1] * s * 0.62 - s * 0.5, s, s, s * 0.22); c.fillStyle = q[2]; c.fill(); }); c.restore();
  };
  ICONS.g2048 = function (c, x, y, r) {
    base(c, x, y, r, '#fbbf24', '#d97706'); c.save(); c.fillStyle = '#fff'; c.font = '800 ' + Math.round(r * 0.62) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('2048', x, y + r * 0.04); c.restore();
  };
  Object.assign(SOS.LABELS, { timer: 'Timer', ttt: 'Tic-Tac-Toe', memory: 'Memory', g2048: '2048' });

  /* ---- Timer ---- */
  reg({
    id: 'timer', title: 'Timer', w: 760, h: 620,
    create(win) { win.state = { set: 300, left: 300, run: false, end: 0, done: false }; },
    tick(win) { const st = win.state; if (st.run) { st.left = Math.max(0, st.end - SOS.t); if (st.left <= 0) { st.run = false; st.done = true; SOS.tick(880, 0.5, 0.14); setTimeout(function () { SOS.tick(1175, 0.5, 0.14); }, 350); } win.dirty = true; } },
    draw(ui, win) {
      const st = win.state, c = ui.c, secs = Math.ceil(st.left - 1e-6), cx = win.w / 2;
      const frac = st.set > 0 ? clamp(st.left / st.set, 0, 1) : 0;
      c.save(); c.lineWidth = 18; c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(cx, 250, 150, 0, 7); c.stroke();
      c.strokeStyle = st.done ? '#ff453a' : '#2dd4bf'; c.beginPath(); c.arc(cx, 250, 150, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); c.stroke(); c.restore();
      ui.text(pad(Math.floor(secs / 60)) + ':' + pad(secs % 60), cx, 250, { size: 92, align: 'center', weight: 300 });
      if (st.done) ui.text("Time's up", cx, 340, { size: 28, align: 'center', color: '#ff453a', weight: 600 });
      const adj = function (id, label, d, x) { ui.btn(id, x, 440, 150, 64, { label: label, size: 26, r: 32, onClick: function () { if (st.run) return; st.set = clamp(st.set + d, 10, 5999); st.left = st.set; st.done = false; win.dirty = true; } }); };
      adj('m1', '−1 min', -60, 70); adj('m2', '−10 s', -10, 240); adj('p1', '+10 s', 10, 410); adj('p2', '+1 min', 60, 580 - 0);
      ui.btn('go', 70, 530, 330, 70, { label: st.run ? 'Pause' : 'Start', size: 30, r: 35, fill: st.run ? '#ff9f0a' : '#30d158', hoverFill: st.run ? '#ffb340' : '#4ae26f', onClick: function () { if (st.run) { st.run = false; } else { if (st.left <= 0) st.left = st.set; st.done = false; st.run = true; st.end = SOS.t + st.left; } win.dirty = true; } });
      ui.btn('rs', 420, 530, 270, 70, { label: 'Reset', size: 30, r: 35, onClick: function () { st.run = false; st.left = st.set; st.done = false; win.dirty = true; } });
    }
  });

  /* ---- Tic-Tac-Toe (you = X, computer = O) ---- */
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function winner(b) { for (let i = 0; i < 8; i++) { const l = LINES[i]; if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return b[l[0]]; } return b.every(Boolean) ? 'D' : null; }
  function minimax(b, turn) {
    const w = winner(b); if (w) return w === 'O' ? 1 : w === 'X' ? -1 : 0;
    let best = turn === 'O' ? -2 : 2;
    for (let i = 0; i < 9; i++) { if (b[i]) continue; b[i] = turn; const v = minimax(b, turn === 'O' ? 'X' : 'O'); b[i] = null; if (turn === 'O') best = Math.max(best, v); else best = Math.min(best, v); }
    return best;
  }
  function aiMove(b) { let bm = -1, bv = -2; for (let i = 0; i < 9; i++) { if (b[i]) continue; b[i] = 'O'; const v = minimax(b, 'X'); b[i] = null; if (v > bv || (v === bv && Math.random() < 0.3)) { bv = v; bm = i; } } return bm; }
  reg({
    id: 'ttt', title: 'Tic-Tac-Toe', w: 640, h: 760,
    create(win) { win.state = { b: Array(9).fill(null), score: { x: 0, o: 0, d: 0 }, over: null }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, S = 160, ox = (win.w - S * 3) / 2, oy = 110;
      ui.text('You  ' + st.score.x + '   ·   Draws  ' + st.score.d + '   ·   Computer  ' + st.score.o, win.w / 2, 80, { size: 24, align: 'center', color: WHITE2, weight: 600 });
      for (let i = 0; i < 9; i++) {
        const x = ox + (i % 3) * S, y = oy + Math.floor(i / 3) * S, id = 't' + i, hv = ui.hover(id);
        ui.hit(id, x, y, S - 8, S - 8, { onClick: function () {
          if (st.over || st.b[i]) return; st.b[i] = 'X'; let w = winner(st.b);
          if (!w) { const m = aiMove(st.b); if (m >= 0) st.b[m] = 'O'; w = winner(st.b); }
          if (w) { st.over = w; if (w === 'X') st.score.x++; else if (w === 'O') st.score.o++; else st.score.d++; SOS.tick(w === 'X' ? 1175 : 440, 0.25, 0.1); }
          win.dirty = true;
        } });
        ui.rect(x, y, S - 8, S - 8, 26, hv && !st.b[i] && !st.over ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.14)');
        const v = st.b[i]; c.save(); c.lineWidth = 14; c.lineCap = 'round';
        if (v === 'X') { c.strokeStyle = '#0a84ff'; c.beginPath(); c.moveTo(x + 40, y + 40); c.lineTo(x + S - 48, y + S - 48); c.moveTo(x + S - 48, y + 40); c.lineTo(x + 40, y + S - 48); c.stroke(); }
        else if (v === 'O') { c.strokeStyle = '#ff9f0a'; c.beginPath(); c.arc(x + (S - 8) / 2, y + (S - 8) / 2, 44, 0, 7); c.stroke(); }
        c.restore();
      }
      const msg = st.over === 'X' ? 'You win!' : st.over === 'O' ? 'Computer wins' : st.over === 'D' ? "It's a draw" : 'Your move (X)';
      ui.text(msg, win.w / 2, 625, { size: 34, align: 'center', weight: 700, color: st.over === 'X' ? '#30d158' : '#fff' });
      ui.btn('again', win.w / 2 - 130, 664, 260, 70, { label: 'New game', size: 28, r: 35, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { st.b = Array(9).fill(null); st.over = null; win.dirty = true; } });
    }
  });

  /* ---- Memory ---- */
  const MCOL = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#ff6482'];
  function sym(c, k, x, y, s) {
    c.save(); c.fillStyle = MCOL[k]; c.translate(x, y); c.beginPath();
    if (k % 4 === 0) c.arc(0, 0, s, 0, 7);
    else if (k % 4 === 1) c.rect(-s * 0.85, -s * 0.85, s * 1.7, s * 1.7);
    else if (k % 4 === 2) { c.moveTo(0, -s); c.lineTo(s, s * 0.8); c.lineTo(-s, s * 0.8); c.closePath(); }
    else { c.moveTo(0, -s * 1.1); c.lineTo(s, 0); c.lineTo(0, s * 1.1); c.lineTo(-s, 0); c.closePath(); }
    c.fill(); c.restore();
  }
  function shuffled() { const a = []; for (let i = 0; i < 8; i++) { a.push(i, i); } for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  reg({
    id: 'memory', title: 'Memory', w: 700, h: 780,
    create(win) { win.state = { cards: shuffled(), open: [], done: {}, moves: 0, back: 0 }; },
    tick(win) { const st = win.state; if (st.back && SOS.t > st.back) { st.open = []; st.back = 0; win.dirty = true; } },
    draw(ui, win) {
      const st = win.state, c = ui.c, S = 140, ox = (win.w - S * 4) / 2, oy = 120, matched = Object.keys(st.done).length;
      ui.text('Moves  ' + st.moves + '   ·   Pairs  ' + matched / 2 + ' / 8', win.w / 2, 80, { size: 26, align: 'center', color: WHITE2, weight: 600 });
      for (let i = 0; i < 16; i++) {
        const x = ox + (i % 4) * S, y = oy + Math.floor(i / 4) * S, id = 'm' + i, up = st.done[i] || st.open.indexOf(i) >= 0, hv = ui.hover(id);
        ui.hit(id, x, y, S - 10, S - 10, { onClick: function () {
          if (st.back || up) return; st.open.push(i); SOS.tick(900, 0.05, 0.06);
          if (st.open.length === 2) { st.moves++; const a = st.open[0], b = st.open[1]; if (st.cards[a] === st.cards[b]) { st.done[a] = st.done[b] = true; st.open = []; SOS.tick(1175, 0.12, 0.08); } else st.back = SOS.t + 0.9; }
          win.dirty = true;
        } });
        ui.rect(x, y, S - 10, S - 10, 24, up ? 'rgba(255,255,255,.92)' : hv ? 'rgba(10,132,255,.75)' : 'rgba(10,132,255,.5)');
        if (up) sym(c, st.cards[i], x + (S - 10) / 2, y + (S - 10) / 2, 36);
      }
      if (matched === 16) ui.text('Well done! ' + st.moves + ' moves', win.w / 2, 722, { size: 34, align: 'center', weight: 700, color: '#30d158' });
      ui.btn('restart', win.w - 190, 38, 150, 52, { label: 'Restart', size: 22, r: 26, onClick: function () { st.cards = shuffled(); st.open = []; st.done = {}; st.moves = 0; st.back = 0; win.dirty = true; } });
    }
  });

  /* ---- 2048 (on-screen arrows, no swipes in VR) ---- */
  const TC = { 0: 'rgba(255,255,255,.1)', 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
  function slide(row) { const a = row.filter(Boolean); let g = 0; for (let i = 0; i < a.length - 1; i++) { if (a[i] === a[i + 1]) { a[i] *= 2; g += a[i]; a.splice(i + 1, 1); } } while (a.length < 4) a.push(0); return [a, g]; }
  function addTile(b) { const e = []; b.forEach(function (v, i) { if (!v) e.push(i); }); if (e.length) b[e[Math.floor(Math.random() * e.length)]] = Math.random() < 0.9 ? 2 : 4; }
  function canMove(b) { if (b.some(function (v) { return !v; })) return true; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const v = b[r * 4 + c]; if ((c < 3 && b[r * 4 + c + 1] === v) || (r < 3 && b[(r + 1) * 4 + c] === v)) return true; } return false; }
  function move(st, dir) {
    let changed = false, gained = 0; const nb = st.b.slice();
    for (let i = 0; i < 4; i++) {
      const idx = []; for (let k = 0; k < 4; k++) idx.push(dir === 0 ? i * 4 + k : dir === 1 ? i * 4 + 3 - k : dir === 2 ? k * 4 + i : (3 - k) * 4 + i);
      const res = slide(idx.map(function (j) { return nb[j]; })); gained += res[1];
      idx.forEach(function (j, k) { if (nb[j] !== res[0][k]) changed = true; nb[j] = res[0][k]; });
    }
    if (changed) { st.b = nb; st.score += gained; if (st.score > st.best) st.best = st.score; addTile(st.b); st.over = !canMove(st.b); }
  }
  reg({
    id: 'g2048', title: '2048', w: 700, h: 860,
    create(win) { const b = Array(16).fill(0); addTile(b); addTile(b); let best = 0; try { best = +localStorage.getItem('sos.best2048') || 0; } catch (e) {} win.state = { b: b, score: 0, best: best, over: false }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, S = 130, ox = (win.w - S * 4) / 2, oy = 150;
      try { localStorage.setItem('sos.best2048', String(st.best)); } catch (e) {}
      ui.text('Score ' + st.score + '   ·   Best ' + st.best, win.w / 2, 90, { size: 28, align: 'center', weight: 700 });
      for (let i = 0; i < 16; i++) {
        const x = ox + (i % 4) * S, y = oy + Math.floor(i / 4) * S, v = st.b[i];
        ui.rect(x, y, S - 10, S - 10, 18, TC[v] || '#3c3a32');
        if (v) ui.text(String(v), x + (S - 10) / 2, y + (S - 10) / 2 + 2, { size: v > 999 ? 38 : v > 99 ? 46 : 56, align: 'center', weight: 800, color: v <= 4 ? '#776e65' : '#fff' });
      }
      const ay = oy + S * 4 + 24, cx = win.w / 2, ab = function (id, lab, dx, dy, d) { ui.btn(id, cx + dx - 50, ay + dy, 100, 70, { label: lab, size: 38, r: 22, onClick: function () { if (!st.over) { move(st, d); SOS.tick(700, 0.04, 0.05); win.dirty = true; } } }); };
      ab('up', '↑', 0, 0, 2); ab('lf', '←', -112, 78, 0); ab('dn', '↓', 0, 78, 3); ab('rt', '→', 112, 78, 1);
      ui.btn('rs', win.w - 190, 38, 150, 52, { label: 'New', size: 22, r: 26, onClick: function () { const b = Array(16).fill(0); addTile(b); addTile(b); st.b = b; st.score = 0; st.over = false; win.dirty = true; } });
      if (st.over) { ui.rect(ox, oy, S * 4 - 10, S * 4 - 10, 18, 'rgba(0,0,0,.55)'); ui.text('Game over', win.w / 2, oy + (S * 4) / 2, { size: 54, align: 'center', weight: 800 }); }
    }
  });
})();
