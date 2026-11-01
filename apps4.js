'use strict';
/* SpatialOS 2.0 apps: Spiral (assistant orb), Browser, Snake, Pong, Converter, Dice */
(function () {
  const SOS = window.SOS, U = SOS.util, FONT = SOS.FONT, reg = SOS.registerApp, ICONS = SOS.ICONS;
  const clamp = U.clamp, rr = U.rr;
  const WHITE2 = 'rgba(255,255,255,.62)';
  const nb = function () { return window.NativeBridge && typeof window.NativeBridge.browserStart === 'function' ? window.NativeBridge : null; };
  function base(c, x, y, r, a, b) { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }

  /* ---------- icons ---------- */
  ICONS.browser = function (c, x, y, r) {
    base(c, x, y, r, '#5ac8fa', '#0a60ff'); c.save(); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = r * 0.09; c.lineCap = 'round';
    c.beginPath(); c.arc(x, y, r * 0.6, 0, 7); c.stroke(); c.beginPath(); c.ellipse(x, y, r * 0.26, r * 0.6, 0, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(x - r * 0.6, y); c.lineTo(x + r * 0.6, y); c.stroke(); c.beginPath(); c.arc(x, y - r * 0.78, r * 0.72, 0.28 * Math.PI, 0.72 * Math.PI); c.stroke(); c.beginPath(); c.arc(x, y + r * 0.78, r * 0.72, 1.28 * Math.PI, 1.72 * Math.PI); c.stroke(); c.restore();
  };
  ICONS.snake = function (c, x, y, r) {
    base(c, x, y, r, '#4ade80', '#15803d'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = r * 0.2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - r * 0.5, y + r * 0.3); c.lineTo(x - r * 0.5, y - r * 0.2); c.lineTo(x + r * 0.05, y - r * 0.2); c.lineTo(x + r * 0.05, y + r * 0.25); c.lineTo(x + r * 0.5, y + r * 0.25); c.stroke();
    c.fillStyle = '#ff453a'; c.beginPath(); c.arc(x + r * 0.5, y - r * 0.38, r * 0.14, 0, 7); c.fill(); c.restore();
  };
  ICONS.pong = function (c, x, y, r) {
    base(c, x, y, r, '#38bdf8', '#1e3a8a'); c.save(); c.fillStyle = '#fff'; rr(c, x - r * 0.62, y - r * 0.34, r * 0.14, r * 0.5, r * 0.07); c.fill(); rr(c, x + r * 0.48, y - r * 0.16, r * 0.14, r * 0.5, r * 0.07); c.fill();
    c.beginPath(); c.arc(x + r * 0.02, y, r * 0.11, 0, 7); c.fill(); c.restore();
  };
  ICONS.convert = function (c, x, y, r) {
    base(c, x, y, r, '#f472b6', '#9d174d'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = r * 0.12; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - r * 0.5, y - r * 0.2); c.lineTo(x + r * 0.45, y - r * 0.2); c.lineTo(x + r * 0.25, y - r * 0.4); c.moveTo(x + r * 0.5, y + r * 0.2); c.lineTo(x - r * 0.45, y + r * 0.2); c.lineTo(x - r * 0.25, y + r * 0.4); c.stroke(); c.restore();
  };
  ICONS.dice = function (c, x, y, r) {
    base(c, x, y, r, '#fca5a5', '#b91c1c'); c.save(); rr(c, x - r * 0.46, y - r * 0.46, r * 0.92, r * 0.92, r * 0.2); c.fillStyle = '#fff'; c.fill(); c.fillStyle = '#b91c1c';
    [[-0.22, -0.22], [0.22, -0.22], [0, 0], [-0.22, 0.22], [0.22, 0.22]].forEach(function (p) { c.beginPath(); c.arc(x + p[0] * r, y + p[1] * r, r * 0.08, 0, 7); c.fill(); }); c.restore();
  };
  ICONS.spiral = ICONS.dice;
  Object.assign(SOS.LABELS, { browser: 'Browser', snake: 'Snake', pong: 'Pong', convert: 'Converter', dice: 'Dice' });

  /* ---------- Spiral: the floating glass orb assistant (tap it, then speak) ---------- */
  function drawOrb(c, cx, cy, R, t, mode) {
    c.save();
    // soft glow
    let g = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25); g.addColorStop(0, 'rgba(140,170,255,.22)'); g.addColorStop(1, 'rgba(140,170,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.25, 0, 7); c.fill();
    // glass body
    c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip();
    g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R); g.addColorStop(0, 'rgba(255,255,255,.34)'); g.addColorStop(0.55, 'rgba(160,185,255,.14)'); g.addColorStop(1, 'rgba(20,26,60,.55)'); c.fillStyle = g; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    // spiral arms (own design: three rotating logarithmic arms with shifting hue)
    const spin = t * (mode === 'listening' ? 2.4 : mode === 'thinking' ? 4.2 : 0.7), arms = 3;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let a = 0; a < arms; a++) {
      const hue = (t * 40 + a * 120 + (mode === 'listening' ? 0 : 200)) % 360;
      c.beginPath();
      for (let i = 0; i <= 46; i++) { const k = i / 46, ang = spin + a * (Math.PI * 2 / arms) + k * 5.2, rad = R * (0.08 + 0.78 * k); const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.strokeStyle = 'hsla(' + hue + ',95%,68%,.75)'; c.lineWidth = R * 0.12; c.stroke();
      c.strokeStyle = 'hsla(' + hue + ',100%,86%,.55)'; c.lineWidth = R * 0.04; c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
    const pulse = mode === 'listening' ? 1 + 0.12 * Math.sin(t * 9) : 1;
    g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.24 * pulse); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 0.24 * pulse, 0, 7); c.fill();
    // specular highlight + lens band
    g = c.createRadialGradient(cx - R * 0.38, cy - R * 0.45, 0, cx - R * 0.38, cy - R * 0.45, R * 0.5); g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    c.restore();
    c.save(); const rm = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R); rm.addColorStop(0, 'rgba(255,255,255,.95)'); rm.addColorStop(0.5, 'rgba(255,255,255,.12)'); rm.addColorStop(1, 'rgba(255,255,255,.6)'); c.strokeStyle = rm; c.lineWidth = R * 0.045; c.beginPath(); c.arc(cx, cy, R - R * 0.025, 0, 7); c.stroke(); c.restore();
  }
  reg({
    id: 'spiral', title: 'Spiral', w: 220, h: 220, chrome: false, glass: false, animated: true, dist: 1.5,
    create(win) { win.sc = 0.6; win.z = 99999; win.mesh.renderOrder = 99999; win.state = { yaw: 0, pitch: 0, init: false }; },
    tick(win, dt) {
      win.z = 99999; win.mesh.renderOrder = 99999;
      const hp = SOS.headYawPitch(), st = win.state, lis = SOS.listening, tt = SOS.t;
      const wrap = function (d) { while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
      if (!st.init) { st.yaw = hp.yaw - 0.42; st.pitch = hp.pitch - 0.3; st.ty = st.yaw; st.tp = st.pitch; st.init = true; }
      // the orb stays where it is in the room; only when you have looked far away does it float over to its spot near your view
      const away = Math.hypot(wrap(st.yaw - hp.yaw) * Math.cos(hp.pitch), st.pitch - hp.pitch);
      if (!st.moving && away > 1.0) { st.moving = true; st.ty = hp.yaw - 0.42; st.tp = hp.pitch - 0.3; }
      if (st.moving) {
        const k = 1 - Math.pow(0.12, dt || 0.016), dy = wrap(st.ty - st.yaw);
        st.yaw += dy * k; st.pitch += (st.tp - st.pitch) * k;
        if (Math.abs(dy) < 0.01 && Math.abs(st.tp - st.pitch) < 0.01) st.moving = false;
      }
      win.yaw = st.yaw; win.pitch = st.pitch + Math.sin(tt * 1.3) * 0.01; win.dist = lis ? 1.3 : 1.5; win.place();
    },
    draw(ui, win) {
      const c = ui.c, mode = SOS.voiceState === 'thinking' ? 'thinking' : SOS.listening ? 'listening' : 'idle';
      ui.hit('orb', 20, 20, 180, 180, { noDwell: false, onClick: function () { SOS.startVoice('command'); } });
      drawOrb(c, 110, 110, ui.hover('orb') ? 88 : 80, SOS.t, mode);
      if (SOS.listening && SOS.voicePartial) { /* partial text shows on the toast-less keyboard header only */ }
    }
  });

  /* ---------- Spatial Browser ---------- */
  const TB = 92, BW = 1280, BH = 720;
  reg({
    id: 'browser', title: 'Browser', w: BW, h: BH + TB, animated: false, dist: 2.5,
    create(win) {
      const st = win.state = { mode: 'page', url: '', text: '', info: {}, seen: -1, busy: false, frame: document.createElement('canvas'), touching: false, started: false, nat: !!nb() };
      st.frame.width = BW; st.frame.height = BH; st.ctx = st.frame.getContext('2d');
      if (st.nat) {
        try { nb().browserStart(BW, BH); st.started = true; } catch (e) {}
        st.timer = setInterval(function () { pump(win); }, 70);
        setTimeout(function () { try { if (!st.info.url || st.info.url === 'about:blank') nb().browserLoad('https://duckduckgo.com'); } catch (e) {} }, 500);
      }
    },
    onClose(win) { const st = win.state; clearInterval(st.timer); try { if (nb()) nb().browserStop(); } catch (e) {} },
    search(q) { const w = SOS.wins.browser; if (w && nb()) { nb().browserLoad(q); } },
    onKey(win, k) {
      const st = win.state;
      if (st.mode === 'url') {
        if (k === 'Backspace') st.text = st.text.slice(0, -1);
        else if (k === 'Enter') { if (nb()) nb().browserLoad(st.text); st.mode = 'page'; SOS.hideKeyboard(); }
        else if (k.length === 1) st.text += k;
      } else if (nb()) { if (k === 'Backspace' || k === 'Enter') nb().browserKey(k); else if (k.length === 1) nb().browserType(k); }
      win.dirty = true;
    },
    onPointer(win, e) {
      const st = win.state, n = nb(); if (!n) return;
      const x = e.x, y = e.y - TB;
      if (y < 0 || y > BH || x < 0 || x > BW) { if (e.type === 'up' && st.touching) { n.browserTouch(1, st.lx || 0, st.ly || 0); st.touching = false; } return; }
      if (e.type === 'click') { if (st.touching) { n.browserTouch(1, x, y); st.touching = false; } else { n.browserTouch(0, x, y); n.browserTouch(1, x, y); } return; }
      if (e.type === 'down') { st.touching = true; st.lx = x; st.ly = y; n.browserTouch(0, x, y); }
      else if (e.type === 'move' && st.touching) { st.lx = x; st.ly = y; n.browserTouch(2, x, y); }
      else if (e.type === 'up' && st.touching) { n.browserTouch(1, x, y); st.touching = false; }
    },
    draw(ui, win) {
      const st = win.state, c = ui.c, w = win.w, n = nb(), inf = st.info || {};
      // toolbar
      const pill = function (id, x, y, ww, hh, on, fn, draw) { const hv = ui.hover(id); ui.hit(id, x, y, ww, hh, { onClick: fn }); ui.rect(x, y, ww, hh, hh / 2, hv ? 'rgba(255,255,255,.26)' : 'rgba(255,255,255,.12)', 'rgba(255,255,255,.22)', 1.5); draw(x + ww / 2, y + hh / 2, on ? 1 : 0.35); };
      const arrow = function (dir) { return function (cx, cy, a) { const cc = c; cc.save(); cc.strokeStyle = 'rgba(255,255,255,' + a + ')'; cc.lineWidth = 4; cc.lineCap = 'round'; cc.lineJoin = 'round'; cc.beginPath(); cc.moveTo(cx + dir * 8, cy - 14); cc.lineTo(cx - dir * 8, cy); cc.lineTo(cx + dir * 8, cy + 14); cc.stroke(); cc.restore(); }; };
      pill('bk', 28, 18, 64, 56, inf.back, function () { if (n) n.browserNav('back'); }, arrow(1));
      pill('fw', 102, 18, 64, 56, inf.fwd, function () { if (n) n.browserNav('forward'); }, arrow(-1));
      pill('rl', 176, 18, 64, 56, true, function () { if (n) n.browserNav(inf.p < 100 ? 'stop' : 'reload'); }, function (cx, cy, a) { ui.text(inf.p < 100 ? '✕' : '⟳', cx, cy + 1, { size: 30, align: 'center', weight: 700 }); });
      // address pill
      const ax = 256, aw = w - 256 - 28 - 64 * 3 - 36, editing = st.mode === 'url', hv = ui.hover('addr');
      ui.hit('addr', ax, 18, aw, 56, { onClick: function () { st.mode = 'url'; st.text = ''; SOS.showKeyboard(win); win.dirty = true; } });
      ui.rect(ax, 18, aw, 56, 28, editing ? 'rgba(255,255,255,.28)' : hv ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.12)', editing ? '#0a84ff' : 'rgba(255,255,255,.22)', editing ? 3 : 1.5);
      const shown = editing ? st.text + '|' : (inf.title || inf.url || 'Search or enter website');
      ui.text(String(shown).slice(0, 70), ax + 26, 47, { size: 25, color: editing || inf.url ? '#fff' : WHITE2, maxW: aw - 52 });
      if (inf.p != null && inf.p < 100) { c.save(); c.fillStyle = '#0a84ff'; rr(c, ax + 20, 70, (aw - 40) * inf.p / 100, 4, 2); c.fill(); c.restore(); }
      // mic, keyboard, scroll buttons
      const bx = ax + aw + 12;
      pill('mic', bx, 18, 64, 56, true, function () { st.mode = 'url'; st.text = ''; SOS.kbFor = win; SOS.voiceAfter = function (t) { if (n) n.browserLoad(t); st.mode = 'page'; win.dirty = true; }; SOS.startVoice('type'); }, function (cx, cy) { c.save(); c.strokeStyle = SOS.listening ? '#ff453a' : '#fff'; c.fillStyle = c.strokeStyle; c.lineWidth = 3; c.lineCap = 'round'; rr(c, cx - 6, cy - 17, 12, 22, 6); c.fill(); c.beginPath(); c.arc(cx, cy - 4, 13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); c.beginPath(); c.moveTo(cx, cy + 9); c.lineTo(cx, cy + 18); c.stroke(); c.restore(); });
      pill('kb', bx + 76, 18, 64, 56, true, function () { st.mode = 'page'; SOS.showKeyboard(win); win.dirty = true; }, function (cx, cy) { ui.text('⌨', cx, cy, { size: 30, align: 'center' }); });
      pill('up', bx + 152, 18, 64, 56, true, function () { if (n) n.browserScroll(-420); }, function (cx, cy) { ui.text('▲', cx, cy, { size: 24, align: 'center' }); });
      pill('dn', bx + 228, 18, 64, 56, true, function () { if (n) n.browserScroll(420); }, function (cx, cy) { ui.text('▼', cx, cy, { size: 24, align: 'center' }); });
      // page
      c.save(); rr(c, 0, TB, w, BH, 0); c.beginPath(); c.rect(0, TB, w, BH); c.clip();
      if (n) { c.fillStyle = '#fff'; c.fillRect(0, TB, w, BH); c.drawImage(st.frame, 0, TB); } else { c.fillStyle = '#1c1d22'; c.fillRect(0, TB, w, BH); ui.text('The browser runs inside the Android app.', w / 2, TB + BH / 2, { size: 34, align: 'center', color: WHITE2 }); }
      c.restore();
    }
  });
  function pump(win) {
    const st = win.state, n = nb(); if (!n || st.busy || win.closing) return;
    let seq = -1, info = ''; try { seq = n.browserSeq(); info = n.browserInfo(); } catch (e) { return; }
    try { const j = JSON.parse(info); if (j.url !== st.info.url || j.title !== st.info.title || j.p !== st.info.p || j.back !== st.info.back || j.fwd !== st.info.fwd) { st.info = j; win.dirty = true; } } catch (e) {}
    if (seq === st.seen || seq <= 0) return;
    st.seen = seq; st.busy = true;
    fetch('https://appassets.androidplatform.net/browser.jpg?s=' + seq, { cache: 'no-store' }).then(function (r) { return r.blob(); }).then(function (b) { return createImageBitmap(b); }).then(function (bm) { st.ctx.drawImage(bm, 0, 0, BW, BH); try { bm.close(); } catch (e) {} win.dirty = true; }).catch(function () {}).then(function () { st.busy = false; });
  }

  /* ---------- Snake (on-screen arrows) ---------- */
  reg({
    id: 'snake', title: 'Snake', w: 760, h: 880, animated: true,
    create(win) { win.state = { n: 16, s: [[8, 8], [7, 8], [6, 8]], d: [1, 0], nd: [1, 0], f: [12, 8], t: 0, score: 0, best: +(localStorage.getItem('sos.bestSnake') || 0), over: false, run: false }; },
    tick(win, dt) {
      const st = win.state; if (!st.run || st.over) return; st.t += dt; const step = Math.max(0.09, 0.2 - st.score * 0.004);
      if (st.t < step) return; st.t = 0; st.d = st.nd;
      const h = [st.s[0][0] + st.d[0], st.s[0][1] + st.d[1]];
      if (h[0] < 0 || h[1] < 0 || h[0] >= st.n || h[1] >= st.n || st.s.some(function (p) { return p[0] === h[0] && p[1] === h[1]; })) { st.over = true; st.run = false; SOS.tick(300, 0.4, 0.12); try { localStorage.setItem('sos.bestSnake', String(st.best)); } catch (e) {} return; }
      st.s.unshift(h);
      if (h[0] === st.f[0] && h[1] === st.f[1]) { st.score++; if (st.score > st.best) st.best = st.score; SOS.tick(1100, 0.06, 0.08); let f; do { f = [Math.floor(Math.random() * st.n), Math.floor(Math.random() * st.n)]; } while (st.s.some(function (p) { return p[0] === f[0] && p[1] === f[1]; })); st.f = f; } else st.s.pop();
    },
    draw(ui, win) {
      const st = win.state, c = ui.c, S = 40, ox = (win.w - S * st.n) / 2, oy = 110;
      ui.text('Score ' + st.score + '   ·   Best ' + st.best, win.w / 2, 60, { size: 28, align: 'center', weight: 700 });
      ui.rect(ox - 8, oy - 8, S * st.n + 16, S * st.n + 16, 22, 'rgba(0,0,0,.32)');
      st.s.forEach(function (p, i) { ui.rect(ox + p[0] * S + 2, oy + p[1] * S + 2, S - 4, S - 4, 12, i === 0 ? '#86efac' : '#22c55e'); });
      ui.rect(ox + st.f[0] * S + 6, oy + st.f[1] * S + 6, S - 12, S - 12, 16, '#ff453a');
      const ay = oy + S * st.n + 30, cx = win.w / 2, turn = function (dx, dy) { return function () { if (!(dx === -st.d[0] && dy === -st.d[1])) st.nd = [dx, dy]; st.run = true; win.dirty = true; }; };
      ui.btn('u', cx - 50, ay, 100, 70, { label: '↑', size: 38, r: 22, onClick: turn(0, -1) }); ui.btn('l', cx - 162, ay + 78, 100, 70, { label: '←', size: 38, r: 22, onClick: turn(-1, 0) }); ui.btn('d', cx - 50, ay + 78, 100, 70, { label: '↓', size: 38, r: 22, onClick: turn(0, 1) }); ui.btn('r', cx + 62, ay + 78, 100, 70, { label: '→', size: 38, r: 22, onClick: turn(1, 0) });
      ui.btn('new', win.w - 190, 36, 150, 52, { label: st.over ? 'Again' : 'Restart', size: 22, r: 26, onClick: function () { const b = st.best; win.state = null; SOS.apps.snake.create(win); win.state.best = b; win.dirty = true; } });
      if (!st.run && !st.over) ui.text('Tap an arrow to start', win.w / 2, oy + S * st.n / 2, { size: 34, align: 'center', weight: 700, shadow: true });
      if (st.over) ui.text('Game over', win.w / 2, oy + S * st.n / 2, { size: 56, align: 'center', weight: 800, shadow: true });
    }
  });

  /* ---------- Pong (your gaze / finger moves the paddle) ---------- */
  reg({
    id: 'pong', title: 'Pong', w: 900, h: 640, animated: true,
    create(win) { win.state = { py: 0.5, ay: 0.5, bx: 0.5, by: 0.5, vx: 0.45, vy: 0.28, me: 0, ai: 0, run: false }; },
    onPointer(win, e) { const st = win.state; if (e.type === 'move' || e.type === 'down' || e.type === 'click') { st.py = clamp((e.y - 40) / (win.h - 80), 0.1, 0.9); if (e.type !== 'move') st.run = true; } },
    tick(win, dt) {
      const st = win.state; const hp = win.hovers; // follow the pointer when hovering via gaze too
      const p = SOS.pointers.gaze.hit; if (p && p.win === win) st.py = clamp((p.py - 40) / (win.h - 80), 0.1, 0.9);
      if (!st.run) return; dt = Math.min(dt, 0.05);
      st.bx += st.vx * dt; st.by += st.vy * dt; if (st.by < 0.02 || st.by > 0.98) st.vy = -st.vy;
      st.ay += clamp(st.by - st.ay, -0.5 * dt, 0.5 * dt);
      if (st.bx < 0.06 && Math.abs(st.by - st.py) < 0.13) { st.vx = Math.abs(st.vx) * 1.06; st.vy += (st.by - st.py) * 1.2; SOS.tick(800, 0.04, 0.08); }
      if (st.bx > 0.94 && Math.abs(st.by - st.ay) < 0.12) { st.vx = -Math.abs(st.vx) * 1.04; SOS.tick(600, 0.04, 0.08); }
      if (st.bx < -0.02) { st.ai++; st.bx = 0.5; st.by = 0.5; st.vx = 0.45; st.vy = 0.28; st.run = false; SOS.tick(300, 0.2, 0.1); }
      if (st.bx > 1.02) { st.me++; st.bx = 0.5; st.by = 0.5; st.vx = -0.45; st.vy = -0.28; st.run = false; SOS.tick(1200, 0.2, 0.1); }
      win.dirty = true;
    },
    draw(ui, win) {
      const st = win.state, c = ui.c, ax = 40, ay = 40, aw = win.w - 80, ah = win.h - 80;
      ui.rect(ax, ay, aw, ah, 24, 'rgba(0,0,0,.34)');
      c.save(); c.setLineDash([14, 16]); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 4; c.beginPath(); c.moveTo(win.w / 2, ay + 10); c.lineTo(win.w / 2, ay + ah - 10); c.stroke(); c.restore();
      ui.text(String(st.me), win.w / 2 - 80, 110, { size: 64, align: 'center', weight: 700 }); ui.text(String(st.ai), win.w / 2 + 80, 110, { size: 64, align: 'center', weight: 700 });
      ui.rect(ax + 16, ay + st.py * ah - 56, 18, 112, 9, '#fff'); ui.rect(ax + aw - 34, ay + st.ay * ah - 56, 18, 112, 9, '#ff9f0a');
      c.fillStyle = '#fff'; c.beginPath(); c.arc(ax + st.bx * aw, ay + st.by * ah, 13, 0, 7); c.fill();
      if (!st.run) ui.text('Look or point at the left side to move · tap to serve', win.w / 2, win.h - 74, { size: 24, align: 'center', color: WHITE2 });
    }
  });

  /* ---------- Converter ---------- */
  const CONV = { Length: [['m', 1], ['km', 1000], ['cm', 0.01], ['mi', 1609.344], ['ft', 0.3048], ['in', 0.0254]], Weight: [['kg', 1], ['g', 0.001], ['lb', 0.45359237], ['oz', 0.028349523]], Temp: [['°C'], ['°F'], ['K']], Data: [['MB', 1], ['GB', 1024], ['KB', 1 / 1024], ['TB', 1048576]] };
  function conv(cat, v, a, b) { if (cat === 'Temp') { const c = a === '°C' ? v : a === '°F' ? (v - 32) * 5 / 9 : v - 273.15; return b === '°C' ? c : b === '°F' ? c * 9 / 5 + 32 : c + 273.15; } const t = CONV[cat], fa = t.find(function (x) { return x[0] === a; })[1], fb = t.find(function (x) { return x[0] === b; })[1]; return v * fa / fb; }
  reg({
    id: 'convert', title: 'Converter', w: 820, h: 820,
    create(win) { win.state = { cat: 'Length', a: 0, b: 1, d: '1' }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, cats = Object.keys(CONV), units = CONV[st.cat].map(function (x) { return x[0]; });
      cats.forEach(function (k, i) { ui.btn('c' + i, 40 + i * 185, 36, 175, 60, { label: k, size: 24, r: 30, fill: st.cat === k ? '#0a84ff' : 'rgba(255,255,255,.1)', onClick: function () { st.cat = k; st.a = 0; st.b = 1; win.dirty = true; } }); });
      const v = parseFloat(st.d) || 0, out = conv(st.cat, v, units[st.a % units.length], units[st.b % units.length]);
      ui.rect(40, 120, win.w - 80, 150, 28, 'rgba(255,255,255,.1)'); ui.text(st.d || '0', 70, 175, { size: 62, weight: 300 });
      ui.btn('ua', win.w - 250, 150, 190, 56, { label: units[st.a % units.length], size: 26, r: 28, onClick: function () { st.a++; win.dirty = true; } });
      ui.text('tap the unit to change it', 70, 235, { size: 19, color: WHITE2 });
      ui.rect(40, 290, win.w - 80, 150, 28, 'rgba(255,255,255,.18)'); ui.text(String(+out.toPrecision(8)), 70, 345, { size: 62, weight: 300 });
      ui.btn('ub', win.w - 250, 320, 190, 56, { label: units[st.b % units.length], size: 26, r: 28, onClick: function () { st.b++; win.dirty = true; } });
      const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];
      keys.forEach(function (k, i) { const x = 40 + (i % 3) * 252, y = 470 + Math.floor(i / 3) * 84; ui.btn('k' + i, x, y, 240, 72, { label: k, size: 36, r: 36, onClick: function () { if (k === '⌫') st.d = st.d.slice(0, -1); else if (k === '.' && st.d.indexOf('.') >= 0) return; else if (st.d.length < 12) st.d += k; win.dirty = true; } }); });
    }
  });

  /* ---------- Dice ---------- */
  reg({
    id: 'dice', title: 'Dice', w: 760, h: 560, animated: true,
    create(win) { win.state = { v: [3, 5], t: -9, n: 2 }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, rolling = SOS.t - st.t < 0.7;
      for (let i = 0; i < st.n; i++) {
        const x = win.w / 2 + (i - (st.n - 1) / 2) * 230, y = 230, val = rolling ? 1 + Math.floor(Math.random() * 6) : st.v[i], s = 170;
        c.save(); c.translate(x, y); if (rolling) c.rotate(Math.sin(SOS.t * 30 + i) * 0.25); rr(c, -s / 2, -s / 2, s, s, 34); c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 10; c.fill(); c.shadowColor = 'transparent'; c.fillStyle = '#1c1c1e';
        const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[val];
        P.forEach(function (p) { c.beginPath(); c.arc(p[0] * 42, p[1] * 42, 14, 0, 7); c.fill(); }); c.restore();
      }
      ui.text(rolling ? 'Rolling…' : 'Total  ' + st.v.slice(0, st.n).reduce(function (a, b) { return a + b; }, 0), win.w / 2, 400, { size: 34, align: 'center', weight: 700 });
      ui.btn('roll', win.w / 2 - 180, 450, 240, 70, { label: 'Roll', size: 30, r: 35, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { st.t = SOS.t; st.v = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; SOS.tick(500, 0.3, 0.1); win.dirty = true; } });
      ui.btn('cnt', win.w / 2 + 70, 450, 110, 70, { label: st.n + ' ⚀', size: 26, r: 35, onClick: function () { st.n = st.n === 2 ? 1 : 2; win.dirty = true; } });
    }
  });
})();
