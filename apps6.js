'use strict';
/* Orbit OS apps 6: more environments, Environments app, Control Center, Freeform, more web apps */
(function () {
  const SOS = window.SOS, S = SOS.settings, U = SOS.util, FONT = SOS.FONT, reg = SOS.registerApp, ICONS = SOS.ICONS, LABELS = SOS.LABELS;
  const clamp = U.clamp, rr = U.rr, WHITE2 = 'rgba(255,255,255,.62)', M = SOS.mulberry, ridge = SOS.ridge;
  const set = function (k, v) { S[k] = v; SOS.save(); SOS.applySettings(); };
  function stars(c, w, hh, n, seed) { const r = M(seed); for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(255,255,' + (225 + r() * 30 | 0) + ',' + (0.3 + r() * 0.7) + ')'; const s = r() < 0.04 ? 2.6 : 1.3; c.fillRect(r() * w, Math.pow(r(), 1.4) * hh, s, s); } }
  function grad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }

  /* ---------- environments ---------- */
  const P = {};
  P.snow = function (c, w, h, hz, fx) {
    c.fillStyle = grad(c, 0, hz, [[0, '#4a64b8'], [0.55, '#8097d6'], [1, '#c4b2d8']]); c.fillRect(0, 0, w, h);
    const r = M(11); c.save(); c.filter = 'blur(18px)'; for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(255,220,235,' + (0.06 + r() * 0.12) + ')'; c.fillRect(r() * w, hz * (0.25 + r() * 0.6), 120 + r() * 300, 8 + r() * 16); } c.restore();
    ridge(c, w, h, hz + h * 0.03, h * 0.15, 3, '#dfe6f8', [4, 11, 19]); ridge(c, w, h, hz + h * 0.07, h * 0.13, 8, '#a9b6dc', [6, 15, 27]); ridge(c, w, h, hz + h * 0.11, h * 0.12, 15, '#6c7aa9', [5, 13, 23]);
    c.fillStyle = grad(c, hz + h * 0.08, h, [[0, '#cfd6ee'], [1, '#8c9bc9']]); c.fillRect(0, hz + h * 0.1, w, h);
    c.fillStyle = grad(c, hz + h * 0.12, hz + h * 0.45, [[0, '#2a3b73'], [1, '#101a3d']]); c.beginPath(); c.moveTo(fx - w * 0.3, hz + h * 0.42); c.bezierCurveTo(fx - w * 0.2, hz + h * 0.2, fx + w * 0.05, hz + h * 0.18, fx + w * 0.28, hz + h * 0.1); c.lineTo(fx + w * 0.3, hz + h * 0.14); c.bezierCurveTo(fx + w * 0.08, hz + h * 0.26, fx - w * 0.1, hz + h * 0.3, fx - w * 0.06, hz + h * 0.46); c.closePath(); c.fill();
  };
  P.aurora = function (c, w, h, hz, fx) {
    c.fillStyle = grad(c, 0, hz, [[0, '#01040d'], [0.6, '#06122b'], [1, '#0f2a4a']]); c.fillRect(0, 0, w, h); stars(c, w, hz * 0.95, 800, 4);
    c.save(); c.globalCompositeOperation = 'lighter'; c.filter = 'blur(20px)';
    for (let k = 0; k < 6; k++) {
      const col = ['60,255,170', '90,230,255', '170,130,255'][k % 3], x0 = fx - w * 0.42 + k * w * 0.14, ww = w * 0.3, base = hz * (0.62 + 0.05 * Math.sin(k * 2)), top = hz * (0.12 + 0.06 * Math.cos(k));
      c.fillStyle = grad(c, top, base, [[0, 'rgba(' + col + ',0)'], [0.7, 'rgba(' + col + ',.38)'], [1, 'rgba(' + col + ',.05)']]);
      c.beginPath(); c.moveTo(x0, base); for (let x = 0; x <= ww; x += 14) c.lineTo(x0 + x, base + Math.sin(x * 0.012 + k * 1.7) * hz * 0.05); for (let x = ww; x >= 0; x -= 14) c.lineTo(x0 + x, top + Math.sin(x * 0.01 + k) * hz * 0.09); c.closePath(); c.fill();
    }
    c.restore();
    ridge(c, w, h, hz + h * 0.03, h * 0.1, 4, '#26365f', [5, 12, 22]); ridge(c, w, h, hz + h * 0.07, h * 0.08, 9, '#101c3a', [7, 15, 27]);
    c.fillStyle = grad(c, hz + h * 0.06, h, [[0, '#0d1a38'], [1, '#050a18']]); c.fillRect(0, hz + h * 0.06, w, h);
  };
  P.ocean = function (c, w, h, hz, fx) {
    c.fillStyle = grad(c, 0, hz, [[0, '#2f74c0'], [0.6, '#8fd1ee'], [1, '#ffe9b8']]); c.fillRect(0, 0, w, h);
    const sg = c.createRadialGradient(fx, hz - h * 0.02, 0, fx, hz - h * 0.02, h * 0.3); sg.addColorStop(0, 'rgba(255,252,230,1)'); sg.addColorStop(0.2, 'rgba(255,235,170,.7)'); sg.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = sg; c.fillRect(0, 0, w, h);
    c.fillStyle = grad(c, hz, h, [[0, '#9ad8ee'], [0.25, '#1f86b8'], [1, '#0a3361']]); c.fillRect(0, hz, w, h);
    const r = M(21); for (let i = 0; i < 260; i++) { const t = Math.pow(r(), 1.6), y = hz + t * hz * 0.9, len = 16 + r() * 110 * (1 + t * 2), x = fx + (r() - 0.5) * len * 4; c.fillStyle = 'rgba(255,248,215,' + (0.15 + r() * 0.5) + ')'; c.fillRect(x, y, len, 2 + r() * 3 * (1 + t)); }
    for (let i = 0; i < 70; i++) { const y = hz + Math.pow(r(), 1.5) * hz * 0.95; c.fillStyle = 'rgba(255,255,255,' + (0.04 + r() * 0.08) + ')'; c.fillRect(r() * w, y, 60 + r() * 220, 2); }
  };
  P.forest = function (c, w, h, hz, fx) {
    c.fillStyle = grad(c, 0, h, [[0, '#dfe8e4'], [0.5, '#a9bdb1'], [1, '#6f8a7c']]); c.fillRect(0, 0, w, h);
    function pines(base, sz, col, seed, n) { const r = M(seed); c.fillStyle = col; for (let i = 0; i < n; i++) { const x = r() * w, hg = sz * (0.6 + r() * 0.8), wd = hg * 0.34; for (let k = 0; k < 3; k++) { const yy = base - hg * (0.1 + k * 0.28), ww = wd * (1 - k * 0.22); c.beginPath(); c.moveTo(x - ww, yy); c.lineTo(x, yy - hg * 0.42); c.lineTo(x + ww, yy); c.closePath(); c.fill(); } c.fillRect(x - 2, base - hg * 0.1, 4, hg * 0.1); } }
    pines(hz + h * 0.05, h * 0.16, '#9bb0a4', 31, 90); c.fillStyle = 'rgba(223,232,228,.45)'; c.fillRect(0, hz - h * 0.12, w, h * 0.26);
    pines(hz + h * 0.1, h * 0.22, '#5f7a6c', 32, 64); c.fillStyle = 'rgba(223,232,228,.3)'; c.fillRect(0, hz - h * 0.02, w, h * 0.24);
    pines(hz + h * 0.22, h * 0.34, '#2c4338', 33, 38);
    c.fillStyle = grad(c, hz + h * 0.16, h, [[0, '#26392f'], [1, '#101c16']]); c.fillRect(0, hz + h * 0.2, w, h);
  };
  P.moon = function (c, w, h, hz, fx) {
    c.fillStyle = grad(c, 0, hz, [[0, '#000'], [1, '#07070d']]); c.fillRect(0, 0, w, h); stars(c, w, hz, 1000, 6);
    const ey = hz * 0.5, er = h * 0.14, gl = c.createRadialGradient(fx, ey, er * 0.9, fx, ey, er * 1.7); gl.addColorStop(0, 'rgba(110,170,255,.45)'); gl.addColorStop(1, 'rgba(110,170,255,0)'); c.fillStyle = gl; c.fillRect(0, 0, w, h);
    c.save(); c.beginPath(); c.arc(fx, ey, er, 0, 7); c.clip(); const eg = c.createRadialGradient(fx - er * 0.3, ey - er * 0.3, 0, fx, ey, er); eg.addColorStop(0, '#6db4ff'); eg.addColorStop(1, '#123a8c'); c.fillStyle = eg; c.fillRect(fx - er, ey - er, er * 2, er * 2);
    const r = M(9); c.filter = 'blur(6px)'; for (let i = 0; i < 18; i++) { c.fillStyle = (i % 3 ? 'rgba(255,255,255,.5)' : 'rgba(80,170,90,.6)'); c.beginPath(); c.ellipse(fx + (r() - 0.5) * er * 1.6, ey + (r() - 0.5) * er * 1.6, er * (0.08 + r() * 0.2), er * (0.04 + r() * 0.08), r() * 3, 0, 7); c.fill(); } c.filter = 'none';
    const sh = c.createLinearGradient(fx - er, 0, fx + er, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,10,.75)'); c.fillStyle = sh; c.fillRect(fx - er, ey - er, er * 2, er * 2); c.restore();
    ridge(c, w, h, hz + h * 0.04, h * 0.05, 14, '#4b4b54', [6, 13, 29]);
    c.fillStyle = grad(c, hz + h * 0.03, h, [[0, '#9a9aa4'], [1, '#26262e']]); c.fillRect(0, hz + h * 0.03, w, h);
    const q = M(17); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; for (let i = 0; i < 40; i++) { const t = Math.pow(q(), 1.2), y = hz + h * 0.05 + t * hz * 0.9, rx = 20 + q() * 120 * (0.4 + t * 1.6); c.beginPath(); c.ellipse(q() * w, y, rx, rx * 0.22, 0, 0, 7); c.stroke(); }
  };
  P.cosmos = function (c, w, h, hz, fx) {
    c.fillStyle = '#02020a'; c.fillRect(0, 0, w, h); stars(c, w, h * 0.98, 1400, 12);
    const r = M(41), cols = ['150,80,255', '60,120,255', '255,90,170', '60,220,255']; c.save(); c.globalCompositeOperation = 'lighter'; c.filter = 'blur(30px)';
    for (let i = 0; i < 16; i++) { const x = r() * w, y = h * (0.1 + r() * 0.8), rad = 180 + r() * 380, col = cols[i % 4], g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(' + col + ',.2)'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    c.restore();
  };
  [['snow', 'Thórsmörk'], ['aurora', 'Northern Lights'], ['ocean', 'Open Sea'], ['forest', 'Misty Pines'], ['moon', 'Lunar Surface'], ['cosmos', 'Deep Space']].forEach(function (e) {
    SOS.envPainters[e[0]] = P[e[0]]; SOS.ENVS.splice(SOS.ENVS.indexOf('passthrough'), 0, e[0]); SOS.ENV_NAMES[e[0]] = e[1];
  });
  const thumbs = {};
  function thumb(kind, w, h) { const k = kind + w; if (thumbs[k]) return thumbs[k]; const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512; SOS.drawEnv(kind, cv); const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(cv, 1024 - 600, 512 * 0.5 - 170, 600, 340, 0, 0, w, h); thumbs[k] = o; return o; }
  function envFace(ui, e, x, y, w, h, r) {
    const c = ui.c; c.save(); rr(c, x, y, w, h, r); c.clip();
    if (e === 'passthrough') { const v = SOS.video; if (SOS.videoReady && v && v.videoWidth) { const va = v.videoWidth / v.videoHeight, ta = w / h; let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0; if (va > ta) { sw = sh * ta; sx = (v.videoWidth - sw) / 2; } else { sh = sw / ta; sy = (v.videoHeight - sh) / 2; } c.drawImage(v, sx, sy, sw, sh, x, y, w, h); } else { c.fillStyle = '#1b1f2e'; c.fillRect(x, y, w, h); ui.text('Camera', x + w / 2, y + h / 2, { size: Math.max(14, h * 0.16), align: 'center', color: WHITE2, weight: 600 }); } }
    else c.drawImage(thumb(e, Math.round(w), Math.round(h)), x, y);
    c.restore();
  }

  /* ---------- Environments app ---------- */
  reg({
    id: 'env', title: 'Environments', w: 1180, h: 760,
    create(win) { win.state = {}; },
    tick(win) { if (SOS.videoReady) { win._e = (win._e || 0) + 1; if (win._e % 6 === 0) win.dirty = true; } },
    draw(ui, win) {
      const c = ui.c, W = win.w, cw = 350, ch = 214, gap = 26, rows = Math.ceil(SOS.ENVS.length / 3);
      ui.text('Environments', 48, 52, { size: 36, weight: 800 });
      ui.scroll(0, 96, W, win.h - 96, rows * (ch + gap) + 20, function () {
        SOS.ENVS.forEach(function (e, i) {
          const x = 48 + (i % 3) * (cw + gap), y = 108 + Math.floor(i / 3) * (ch + gap), id = 'e' + e, on = SOS.env === e, hv = ui.hover(id);
          ui.hit(id, x, y, cw, ch, { onClick: function () { SOS.setEnv(e); win.dirty = true; } });
          envFace(ui, e, x, y, cw, ch, 30);
          c.save(); rr(c, x, y, cw, ch, 30); c.clip(); c.fillStyle = grad(c, y + ch - 80, y + ch, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.7)']]); c.fillRect(x, y + ch - 80, cw, 80); c.restore();
          ui.text(SOS.ENV_NAMES[e], x + 22, y + ch - 28, { size: 26, weight: 700, shadow: true, maxW: cw - 44 });
          if (on) ui.rect(x, y, cw, ch, 30, null, '#0a84ff', 5); else if (hv) ui.rect(x, y, cw, ch, 30, 'rgba(255,255,255,.14)');
        });
      });
    }
  });

  /* ---------- notifications (recent toasts) ---------- */
  SOS.notifs = [];
  const toastOrig = SOS.toast;
  SOS.toast = function (m, s) { try { SOS.notifs.unshift({ m: String(m), t: new Date() }); if (SOS.notifs.length > 4) SOS.notifs.length = 4; } catch (e) {} return toastOrig.call(this, m, s); };

  /* ---------- Control Center (notifications and playback / core controls / environments) ---------- */
  reg({
    id: 'control', title: 'Control Center', w: 1500, h: 640,
    create(win) { win.state = {}; },
    draw(ui, win) {
      const c = ui.c, panel = function (x, w) { ui.rect(x, 28, w, 584, 50, 'rgba(255,255,255,.09)', 'rgba(255,255,255,.14)', 1.5); };
      panel(36, 440); panel(496, 520); panel(1036, 428);
      // left: time, playing, notifications
      const d = new Date(); ui.text(String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'), 76, 112, { size: 96, weight: 300 });
      ui.text(d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), 80, 176, { size: 24, color: WHITE2, weight: 500 });
      ui.rect(64, 212, 384, 130, 34, 'rgba(255,255,255,.12)'); if (ICONS.music) ICONS.music(c, 126, 277, 40);
      ui.text('Orbit Music', 188, 258, { size: 26, weight: 700 }); ui.text('Ambient synth', 188, 294, { size: 20, color: WHITE2 });
      ui.hit('musopen', 64, 212, 384, 130, { onClick: function () { SOS.open('music', { bring: true }); } });
      ui.text('Notifications', 80, 392, { size: 24, weight: 700 });
      if (!SOS.notifs.length) ui.text('Nothing new', 80, 440, { size: 22, color: WHITE2 });
      SOS.notifs.slice(0, 3).forEach(function (n, i) { const y = 418 + i * 62; ui.rect(64, y, 384, 52, 26, 'rgba(255,255,255,.10)'); ui.text(n.m, 88, y + 27, { size: 20, maxW: 340 }); });
      // middle: core controls
      const tg = [['📷', 'Camera', SOS.camState === 'on', function () { if (SOS.camState === 'on') { S.camera = false; SOS.save(); SOS.disableCamera(); SOS.setEnv(S.env === 'passthrough' ? 'night' : S.env); } else { S.camera = true; SOS.save(); SOS.enableCamera(); } }],
        ['🖐', 'Hands', !!S.hands, function () { if (SOS.camState !== 'on') { SOS.toast('Turn the camera on first.', 3); return; } set('hands', !S.hands); if (S.hands) SOS.startHands(); else SOS.stopHands(); }],
        ['🌀', 'Assistant', !!S.spiral, function () { set('spiral', !S.spiral); if (SOS.orbShow) SOS.orbShow(S.spiral); }],
        ['🛡', 'Comfort', !!S.comfort, function () { set('comfort', !S.comfort); }]];
      tg.forEach(function (t, i) {
        const x = 496 + 76 + i * 122, y = 108, id = 'tg' + i, hv = ui.hover(id);
        ui.hit(id, x - 52, y - 52, 104, 122, { onClick: function () { t[3](); win.dirty = true; } });
        c.fillStyle = t[2] ? '#0a84ff' : hv ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.16)'; c.beginPath(); c.arc(x, y, hv ? 48 : 45, 0, 7); c.fill();
        ui.text(t[0], x, y + 3, { size: 40, align: 'center' }); ui.text(t[1], x, y + 80, { size: 18, align: 'center', color: t[2] ? '#fff' : WHITE2, weight: 600 });
      });
      [['Recenter windows', function () { SOS.recenterAll(); }], ['Close all windows', function () { Object.keys(SOS.wins).forEach(function (k) { if (k !== 'control' && k !== 'dock' && k !== 'home') SOS.close(k); }); }], ['Open Environments', function () { SOS.open('env', { bring: true }); }], ['Open Settings', function () { SOS.open('settings', { bring: true }); }]].forEach(function (r, i) {
        const y = 226 + i * 70; ui.btn('row' + i, 524, y, 464, 58, { label: r[0], size: 24, r: 29, fill: 'rgba(255,255,255,.10)', onClick: function () { r[1](); win.dirty = true; } });
      });
      ui.text('Volume', 530, 520, { size: 20, color: WHITE2, weight: 600 }); ui.slider('vol', 640, 520, 330, S.volume, 0, 1, function (v) { set('volume', v); win.dirty = true; }, 0.05);
      ui.text('Window size', 530, 574, { size: 20, color: WHITE2, weight: 600 }); ui.slider('wsz', 700, 574, 270, S.winScale, 0.7, 1.4, function (v) { set('winScale', v); win.dirty = true; }, 0.05);
      // right: environments
      const E = SOS.ENVS, cur = SOS.env, ci = Math.max(0, E.indexOf(cur));
      envFace(ui, cur, 1060, 52, 380, 210, 36);
      c.save(); rr(c, 1060, 52, 380, 210, 36); c.clip(); c.fillStyle = grad(c, 182, 262, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.7)']]); c.fillRect(1060, 182, 380, 80); c.restore();
      ui.text(SOS.ENV_NAMES[cur] || cur, 1084, 236, { size: 28, weight: 800, shadow: true, maxW: 270 });
      ui.btn('envp', 1308, 206, 56, 44, { label: '‹', size: 30, r: 22, onClick: function () { SOS.setEnv(E[(ci + E.length - 1) % E.length]); win.dirty = true; } });
      ui.btn('envn', 1374, 206, 56, 44, { label: '›', size: 30, r: 22, onClick: function () { SOS.setEnv(E[(ci + 1) % E.length]); win.dirty = true; } });
      E.forEach(function (e, i) {
        const x = 1060 + (i % 4) * 96, y = 290 + Math.floor(i / 4) * 78, id = 'ec' + e;
        ui.hit(id, x, y, 88, 66, { onClick: function () { SOS.setEnv(e); win.dirty = true; } });
        envFace(ui, e, x, y, 88, 66, 18); if (e === cur) ui.rect(x, y, 88, 66, 18, null, '#fff', 4); else if (ui.hover(id)) ui.rect(x, y, 88, 66, 18, 'rgba(255,255,255,.2)');
      });
      ui.btn('allenv', 1060, 540, 380, 56, { label: 'All environments', size: 22, r: 28, fill: 'rgba(255,255,255,.12)', onClick: function () { SOS.open('env', { bring: true }); } });
    }
  });

  /* ---------- Freeform: whiteboard with sticky notes ---------- */
  const NCOL = ['#ffd60a', '#ff9eb5', '#7dd3fc', '#86efac'];
  let BOARD = []; try { BOARD = JSON.parse(localStorage.getItem('sos.board') || '[]'); } catch (e) {} if (!Array.isArray(BOARD)) BOARD = [];
  const bSave = function () { try { localStorage.setItem('sos.board', JSON.stringify(BOARD)); } catch (e) {} };
  ICONS.freeform = function (c, x, y, r) { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e5e7eb'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = '#0a84ff'; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * 0.5, y + r * 0.2); c.bezierCurveTo(x - r * 0.2, y - r * 0.6, x + r * 0.1, y + r * 0.6, x + r * 0.5, y - r * 0.2); c.stroke(); c.fillStyle = '#ffd60a'; rr(c, x + r * 0.05, y + r * 0.15, r * 0.42, r * 0.4, r * 0.06); c.fill(); };
  reg({
    id: 'freeform', title: 'Freeform', w: 1320, h: 820,
    create(win) { win.state = { sel: -1, off: [0, 0] }; },
    onKey(win, k) { const n = BOARD[win.state.sel]; if (!n) return; if (k === 'Backspace') n.t = n.t.slice(0, -1); else if (k === 'Enter') n.t += '\n'; else if (n.t.length < 120 && k.length === 1) n.t += k; bSave(); win.dirty = true; },
    draw(ui, win) {
      const c = ui.c, st = win.state, W = win.w, H = win.h, kb = SOS.kbFor === win;
      c.save(); c.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 40; x < W; x += 44) for (let y = 120; y < H; y += 44) c.fillRect(x, y, 2, 2); c.restore();
      ui.text('Freeform', 48, 58, { size: 38, weight: 800 });
      NCOL.forEach(function (col, i) { const x = 330 + i * 64; ui.hit('add' + i, x, 28, 52, 52, { onClick: function () { BOARD.push({ x: 120 + (BOARD.length % 5) * 60, y: 160 + (BOARD.length % 4) * 50, t: '', c: col }); st.sel = BOARD.length - 1; bSave(); win.dirty = true; } }); c.fillStyle = col; rr(c, x, 28, 52, 52, 14); c.fill(); if (ui.hover('add' + i)) { c.strokeStyle = '#fff'; c.lineWidth = 4; rr(c, x, 28, 52, 52, 14); c.stroke(); } });
      ui.text('+ note', 590, 56, { size: 20, color: WHITE2, weight: 600 });
      ui.btn('typ', W - 560, 28, 130, 52, { label: kb ? 'Done' : 'Type', size: 22, r: 26, fill: kb ? '#0a84ff' : 'rgba(255,255,255,.12)', onClick: function () { if (kb) SOS.hideKeyboard(); else if (st.sel >= 0) SOS.showKeyboard(win); win.dirty = true; } });
      ui.btn('del', W - 414, 28, 130, 52, { label: 'Delete', size: 22, r: 26, onClick: function () { if (st.sel >= 0) { BOARD.splice(st.sel, 1); st.sel = -1; bSave(); win.dirty = true; } } });
      ui.btn('clr', W - 268, 28, 130, 52, { label: 'Clear', size: 22, r: 26, onClick: function () { BOARD.length = 0; st.sel = -1; bSave(); win.dirty = true; } });
      BOARD.forEach(function (n, i) {
        const id = 'n' + i, w = 230, h = 210;
        ui.hit(id, n.x, n.y, w, h, { kind: 'slider', noDwell: true, onDown: function (px, py) { st.sel = i; st.off = [px - n.x, py - n.y]; win.dirty = true; }, onDrag: function (px, py) { n.x = clamp(px - st.off[0], 8, W - w - 8); n.y = clamp(py - st.off[1], 100, H - h - 8); bSave(); win.dirty = true; } });
        c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 18; c.shadowOffsetY = 8; c.fillStyle = n.c; rr(c, n.x, n.y, w, h, 20); c.fill(); c.restore();
        if (st.sel === i) { c.strokeStyle = '#0a84ff'; c.lineWidth = 5; rr(c, n.x, n.y, w, h, 20); c.stroke(); }
        c.save(); c.font = '600 26px ' + FONT; c.fillStyle = '#1c1c1e'; c.textBaseline = 'top'; let ly = n.y + 18;
        String(n.t || (st.sel === i ? '' : 'Tap, then Type')).split('\n').forEach(function (para) { let line = ''; para.split(' ').forEach(function (word) { const test = line ? line + ' ' + word : word; if (c.measureText(test).width > w - 36 && line) { c.fillText(line, n.x + 18, ly); ly += 34; line = word; } else line = test; }); c.fillText(line + (st.sel === i && kb && Math.floor(SOS.t * 2) % 2 ? '|' : ''), n.x + 18, ly); ly += 34; });
        c.restore();
      });
      if (!BOARD.length) ui.text('Tap a colour to add a sticky note. Drag it with a pinch or hold-tap.', W / 2, H / 2, { size: 26, align: 'center', color: WHITE2 });
    }
  });
  LABELS.freeform = 'Freeform'; LABELS.control = 'Control Center'; SOS.CATALOG.push(['freeform', 'Freeform', 'Sticky-note whiteboard', 'Create']);

  /* ---------- more web apps ---------- */
  const WEB2 = {
    w_mail: ['Mail', 'Your inbox', 'Work', 'https://mail.google.com/', '#4da3ff', '#1d4ed8', '✉'], w_msg: ['Messages', 'Texts on the big screen', 'Social', 'https://messages.google.com/web', '#4ade80', '#15803d', '💬'],
    w_netflix: ['Netflix', 'Shows and films', 'Watch', 'https://www.netflix.com/', '#ef4444', '#450a0a', 'N'], w_paramount: ['Paramount+', 'Streaming', 'Watch', 'https://www.paramountplus.com/', '#3b82f6', '#172554', 'P+'],
    w_pluto: ['Pluto TV', 'Free live TV', 'Watch', 'https://pluto.tv/', '#facc15', '#a16207', 'Pl'], w_walmart: ['Walmart', 'Shopping', 'Social', 'https://www.walmart.com/', '#38bdf8', '#075985', 'W'],
    w_instacart: ['Instacart', 'Groceries', 'Social', 'https://www.instacart.com/', '#4ade80', '#166534', 'I'], w_pov: ['Explore POV', 'Travel in 3D', 'Watch', 'https://explorepov.com/', '#f472b6', '#9d174d', 'POV'],
    w_jig: ['JigSpace', '3D presentations', 'Create', 'https://jig.space/', '#a78bfa', '#5b21b6', 'Jig'], w_notion: ['Notion', 'Notes and docs', 'Work', 'https://www.notion.so/', '#e5e7eb', '#6b7280', 'N'],
    w_figma: ['Figma', 'Design', 'Create', 'https://www.figma.com/', '#f87171', '#7c3aed', 'F'], w_canva: ['Canva', 'Quick design', 'Create', 'https://www.canva.com/', '#22d3ee', '#7c3aed', 'Cv'],
    w_gemini: ['Gemini', 'AI assistant', 'Tools', 'https://gemini.google.com/', '#60a5fa', '#7c3aed', '✦'], w_reddit: ['Reddit', 'Communities', 'Social', 'https://www.reddit.com/', '#fb923c', '#9a3412', 'R']
  };
  function glyph(a, b, txt) { return function (c, x, y, r) { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.save(); c.fillStyle = '#fff'; c.font = '800 ' + Math.round(r * (txt.length > 2 ? 0.6 : txt.length > 1 ? 0.78 : 0.9)) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + r * 0.04); c.restore(); }; }
  Object.keys(WEB2).forEach(function (id) { const w = WEB2[id]; LABELS[id] = w[0]; ICONS[id] = glyph(w[4], w[5], w[6]); reg({ id: id, title: w[0], w: 8, h: 8, draw: function () {} }); SOS.CATALOG.push([id, w[0], w[1], w[2]]); });
  const open5 = SOS.open;
  SOS.open = function (id, o) { if (WEB2[id]) { SOS.openBrowser(WEB2[id][3], true); return null; } return open5.apply(this, arguments); };
  try { if (!localStorage.getItem('sos.seed6')) { ['freeform', 'w_yt', 'w_mail', 'w_msg'].forEach(function (id) { SOS.installApp(id); }); localStorage.setItem('sos.seed6', '1'); } } catch (e) {}
})();
