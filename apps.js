'use strict';
/* SpatialOS apps: Home, Dock, Keyboard, Settings, Notes, Photos, Music, Sketch, Calculator, Clock, Environments, Store, Breathe, Compass */
(function () {
  const SOS = window.SOS, S = SOS.settings, U = SOS.util, FONT = SOS.FONT;
  const clamp = U.clamp, rr = U.rr;
  const reg = SOS.registerApp;
  const set = function (k, v) { S[k] = v; SOS.save(); SOS.applySettings(); };
  const WHITE2 = 'rgba(255,255,255,.62)';

  /* ---------- icon glyphs ---------- */
  function disc(c, x, y, r, a, b) { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, a); g.addColorStop(1, b || a); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  const ICONS = {
    settings(c, x, y, r) {
      disc(c, x, y, r, '#c9ccd3', '#6d717b'); c.save(); c.translate(x, y); c.fillStyle = '#2b2d33';
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillRect(-r * 0.09, -r * 0.62, r * 0.18, r * 0.2); }
      c.beginPath(); c.arc(0, 0, r * 0.46, 0, 7); c.fill(); c.fillStyle = '#9ea2ac'; c.beginPath(); c.arc(0, 0, r * 0.2, 0, 7); c.fill(); c.restore();
    },
    photos(c, x, y, r) {
      disc(c, x, y, r, '#fff', '#e9e9ee'); const cols = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#ff375f'];
      c.save(); c.globalCompositeOperation = 'multiply'; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.fillStyle = cols[i]; c.globalAlpha = 0.85; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, r * 0.33, 0, 7); c.fill(); } c.restore();
    },
    notes(c, x, y, r) {
      disc(c, x, y, r, '#fff', '#f1f1f4'); c.fillStyle = '#ffd60a'; c.beginPath(); c.arc(x, y, r, Math.PI * 1.08, Math.PI * 1.92); c.lineTo(x + r * 0.9, y - r * 0.62); c.lineTo(x - r * 0.9, y - r * 0.62); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x - r * 0.52, y - r * 0.2 + i * r * 0.3); c.lineTo(x + r * 0.52, y - r * 0.2 + i * r * 0.3); c.stroke(); }
    },
    music(c, x, y, r) {
      disc(c, x, y, r, '#ff5e75', '#e0182d'); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = r * 0.12; c.lineCap = 'round';
      c.beginPath(); c.ellipse(x - r * 0.18, y + r * 0.32, r * 0.2, r * 0.15, -0.4, 0, 7); c.fill(); c.beginPath(); c.moveTo(x - r * 0.02, y + r * 0.28); c.lineTo(x - r * 0.02, y - r * 0.42); c.lineTo(x + r * 0.38, y - r * 0.5); c.lineTo(x + r * 0.38, y + r * 0.12); c.stroke();
      c.beginPath(); c.ellipse(x + r * 0.2, y + r * 0.2, r * 0.2, r * 0.15, -0.4, 0, 7); c.fill();
    },
    sketch(c, x, y, r) {
      disc(c, x, y, r, '#ffffff', '#ececf1'); c.lineCap = 'round'; c.lineWidth = r * 0.12; c.strokeStyle = '#0a84ff'; c.beginPath(); c.moveTo(x - r * 0.5, y + r * 0.2); c.bezierCurveTo(x - r * 0.3, y - r * 0.6, x + r * 0.1, y + r * 0.6, x + r * 0.2, y - r * 0.1); c.stroke();
      c.strokeStyle = '#ff9f0a'; c.beginPath(); c.moveTo(x - r * 0.2, y + r * 0.45); c.bezierCurveTo(x + r * 0.1, y + r * 0.1, x + r * 0.4, y + r * 0.5, x + r * 0.55, y - r * 0.2); c.stroke();
    },
    calc(c, x, y, r) {
      disc(c, x, y, r, '#3a3a40', '#1b1b1f'); const s = r * 0.34; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i === 1 && j === 1) ? '#ff9f0a' : '#7b7b84'; rr(c, x - s * 1.08 + i * s * 1.16, y - s * 1.08 + j * s * 1.16, s, s, s * 0.28); c.fill(); }
    },
    clock(c, x, y, r) {
      disc(c, x, y, r, '#1c1c20', '#000'); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.72, 0, 7); c.fill(); c.strokeStyle = '#111'; c.lineCap = 'round'; c.lineWidth = r * 0.07;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - r * 0.46); c.stroke(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + r * 0.3, y + r * 0.1); c.stroke(); c.strokeStyle = '#ff9f0a'; c.lineWidth = r * 0.03; c.beginPath(); c.moveTo(x, y + r * 0.14); c.lineTo(x - r * 0.1, y - r * 0.55); c.stroke();
    },
    env(c, x, y, r) {
      disc(c, x, y, r, '#5ac8fa', '#3a5bd9'); c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip(); c.fillStyle = '#ffd60a'; c.beginPath(); c.arc(x + r * 0.3, y - r * 0.3, r * 0.17, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.moveTo(x - r, y + r * 0.5); c.lineTo(x - r * 0.35, y - r * 0.12); c.lineTo(x + r * 0.05, y + r * 0.3); c.lineTo(x + r * 0.35, y + r * 0.05); c.lineTo(x + r, y + r * 0.5); c.lineTo(x + r, y + r); c.lineTo(x - r, y + r); c.fill(); c.restore();
    },
    store(c, x, y, r) {
      disc(c, x, y, r, '#4fc3ff', '#0a63ff'); c.fillStyle = '#fff'; rr(c, x - r * 0.42, y - r * 0.18, r * 0.84, r * 0.62, r * 0.12); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath(); c.arc(x, y - r * 0.18, r * 0.24, Math.PI, 0); c.stroke();
    },
    breathe(c, x, y, r) {
      disc(c, x, y, r, '#5eead4', '#0f9aa6'); c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x, y, r * (0.2 + i * 0.2), 0, 7); c.fill(); }
    },
    compass(c, x, y, r) {
      disc(c, x, y, r, '#2d2f36', '#101114'); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r * 0.66, 0, 7); c.stroke();
      c.fillStyle = '#ff453a'; c.beginPath(); c.moveTo(x, y - r * 0.52); c.lineTo(x + r * 0.16, y); c.lineTo(x - r * 0.16, y); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x, y + r * 0.52); c.lineTo(x + r * 0.16, y); c.lineTo(x - r * 0.16, y); c.fill();
    },
    home(c, x, y, r) { c.strokeStyle = '#fff'; c.lineWidth = r * 0.12; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r * 0.5, y + r * 0.05); c.lineTo(x, y - r * 0.45); c.lineTo(x + r * 0.5, y + r * 0.05); c.moveTo(x - r * 0.34, y); c.lineTo(x - r * 0.34, y + r * 0.45); c.lineTo(x + r * 0.34, y + r * 0.45); c.lineTo(x + r * 0.34, y); c.stroke(); },
    target(c, x, y, r) { c.strokeStyle = '#fff'; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r * 0.42, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.1, 0, 7); c.fill(); [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) { c.beginPath(); c.moveTo(x + d[0] * r * 0.5, y + d[1] * r * 0.5); c.lineTo(x + d[0] * r * 0.7, y + d[1] * r * 0.7); c.stroke(); }); },
    hand(c, x, y, r) { c.strokeStyle = '#fff'; c.lineWidth = r * 0.1; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - r * 0.3, y + r * 0.5); c.lineTo(x - r * 0.4, y - r * 0.05); c.moveTo(x - r * 0.15, y - r * 0.1); c.lineTo(x - r * 0.15, y - r * 0.5); c.moveTo(x + r * 0.02, y - r * 0.1); c.lineTo(x + r * 0.02, y - r * 0.58); c.moveTo(x + r * 0.2, y - r * 0.05); c.lineTo(x + r * 0.2, y - r * 0.45); c.moveTo(x - r * 0.3, y + r * 0.5); c.lineTo(x + r * 0.32, y + r * 0.5); c.lineTo(x + r * 0.4, y + r * 0.05); c.lineTo(x + r * 0.2, y - r * 0.05); c.stroke(); },
    apps(c, x, y, r) { c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x + (i - 1) * r * 0.36, y + (j - 1) * r * 0.36, r * 0.1, 0, 7); c.fill(); } }
  };
  const LABELS = { settings: 'Settings', photos: 'Photos', notes: 'Notes', music: 'Music', sketch: 'Sketch', calc: 'Calculator', clock: 'Clock', env: 'Environments', store: 'App Store', breathe: 'Breathe', compass: 'Compass' };

  /* ---------- Home ---------- */
  const HOME_ROWS = [['photos', 'notes', 'music', 'sketch'], ['store', 'settings', 'env'], ['calc', 'clock', 'breathe', 'compass']];
  reg({
    id: 'home', w: 1180, h: 740, chrome: false, glass: false, dist: 2.4,
    draw(ui, win) {
      const c = ui.c, sp = 176;
      // left tab bar
      ui.rect(18, 270, 76, 200, 38, 'rgba(40,40,46,.62)', 'rgba(255,255,255,.14)');
      [['apps', 308, null], ['env', 370, 'env'], ['settings', 432, 'settings']].forEach(function (t) {
        const id = 'tab_' + t[0], hv = ui.hover(id); ui.hit(id, 28, t[1] - 28, 56, 56, { onClick: t[2] ? function () { SOS.open(t[2]); } : null });
        if (hv || !t[2]) { c.fillStyle = hv ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.16)'; c.beginPath(); c.arc(56, t[1], 24, 0, 7); c.fill(); }
        (t[0] === 'apps' ? ICONS.apps : t[0] === 'env' ? ICONS.target : ICONS.settings)(c, 56, t[1], t[0] === 'settings' ? 15 : 24);
      });
      HOME_ROWS.forEach(function (row, ri) {
        const y = 190 + ri * 156;
        row.forEach(function (id, i) {
          const x = 640 + (i - (row.length - 1) / 2) * sp, key = 'app_' + id, hv = ui.hover(id) || ui.hover(key), dn = ui.down(key);
          ui.hit(key, x - 78, y - 78, 156, 156, { onClick: function () { SOS.open(id); } });
          const hv2 = ui.hover(key);
          c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = hv2 ? 34 : 20; c.shadowOffsetY = 8;
          const r = 72 * (hv2 ? 1.1 : 1) * (dn ? 0.95 : 1); ICONS[id](c, x, y, r); c.restore();
          if (hv2) { c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 72 * 1.1 + 5, 0, 7); c.stroke(); c.restore(); }
          if (hv2) ui.text(LABELS[id], x, y + 72 + 28, { size: 26, align: 'center', weight: 700, color: '#fff', shadow: true });
        });
      });
    }
  });

  /* ---------- Dock ---------- */
  const ENVS = ['passthrough', 'sunset', 'night', 'studio'], ENV_NAMES = { passthrough: 'Passthrough', sunset: 'Sunset Dunes', night: 'Midnight', studio: 'Studio' };
  reg({
    id: 'dock', w: 600, h: 130, chrome: false, radius: 65, dist: 2.0,
    draw(ui, win) {
      const c = ui.c, items = [
        ['home', 'Home', function () { SOS.toggleHome(); }, false],
        ['target', 'Recenter', function () { SOS.recenter(); const hp = { yaw: 0, pitch: 0 }; for (const k in SOS.wins) { const w = SOS.wins[k]; if (k === 'dock') continue; w.yaw = 0; w.pitch = k === 'keyboard' ? -0.5 : 0.02; w.place(); } }, false],
        ['env', 'Space', function () { SOS.setEnv(ENVS[(ENVS.indexOf(SOS.env) + 1) % ENVS.length]); win.dirty = true; }, false],
        ['hand', 'Hands', function () { set('hands', !S.hands); }, S.hands],
        ['settings', 'Settings', function () { SOS.open('settings'); }, false]
      ];
      items.forEach(function (it, i) {
        const x = 75 + i * 112, y = 56, id = 'd_' + it[0], hv = ui.hover(id);
        ui.hit(id, x - 46, y - 46, 92, 92, { onClick: it[2] });
        c.fillStyle = hv ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)'; c.beginPath(); c.arc(x, y, hv ? 44 : 40, 0, 7); c.fill();
        if (it[0] === 'env') ICONS.env(c, x, y, 26); else if (it[0] === 'settings') ICONS.settings(c, x, y, 26); else ICONS[it[0]](c, x, y, 34);
        if (it[0] === 'hand') { c.fillStyle = it[3] ? '#30d158' : '#ff453a'; c.beginPath(); c.arc(x + 28, y - 28, 7, 0, 7); c.fill(); }
        ui.text(it[1], x, 112, { size: 17, align: 'center', color: hv ? '#fff' : WHITE2, weight: 600 });
      });
    }
  });

  /* ---------- Keyboard ---------- */
  const KB_ROWS = [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['SHIFT', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace'], ['SYM', ' ', 'Enter']];
  const KB_SYM = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['-', '/', ':', ';', '(', ')', '$', '&', '@'], ['SHIFT', '.', ',', '?', '!', '\'', '"', '#', 'Backspace'], ['SYM', ' ', 'Enter']];
  reg({
    id: 'keyboard', w: 1100, h: 400, chrome: false, radius: 44, dist: 1.7, tilt: -0.28,
    create(win) { win.state = { shift: false, sym: false, flash: null }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, rows = st.sym ? KB_SYM : KB_ROWS, kh = 74, gap = 10, ky = 46;
      ui.text(SOS.kbFor ? (SOS.kbFor.app.title || 'Typing') : 'Keyboard', 550, 22, { size: 20, align: 'center', color: WHITE2, weight: 600 });
      rows.forEach(function (row, ri) {
        const base = 84, wide = 132;
        const widths = row.map(function (k) { return k === 'SHIFT' || k === 'Backspace' ? wide : k === ' ' ? 560 : k === 'Enter' ? 200 : k === 'SYM' ? 160 : base; });
        const tw = widths.reduce(function (a, b) { return a + b; }, 0) + gap * (row.length - 1);
        let x = (1100 - tw) / 2; const y = ky + ri * (kh + gap);
        row.forEach(function (k, i) {
          const w = widths[i], id = 'k_' + k, hv = ui.hover(id), fl = st.flash && st.flash.k === k && SOS.t - st.flash.t < 0.18;
          const special = k.length > 1 && k !== ' ';
          ui.hit(id, x, y, w, kh, { onClick: function () {
            st.flash = { k: k, t: SOS.t };
            if (k === 'SHIFT') st.shift = !st.shift; else if (k === 'SYM') st.sym = !st.sym;
            else { const out = (k.length === 1 && st.shift && !st.sym) ? k.toUpperCase() : k; SOS.typeKey(out); if (st.shift && k.length === 1) st.shift = false; }
            win.dirty = true;
          } });
          ui.rect(x, y, w, kh, 16, fl ? 'rgba(255,255,255,.7)' : hv ? 'rgba(255,255,255,.34)' : special ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.2)');
          let lab = k === 'Backspace' ? '⌫' : k === 'SHIFT' ? (st.shift ? '⇧•' : '⇧') : k === 'SYM' ? (st.sym ? 'ABC' : '123') : k === 'Enter' ? 'return' : k === ' ' ? 'space' : (st.shift && !st.sym ? k.toUpperCase() : k);
          ui.text(lab, x + w / 2, y + kh / 2 + 1, { size: special || k === ' ' ? 26 : 34, align: 'center', weight: 600, color: fl ? '#111' : '#fff' });
          x += w + gap;
        });
      });
      if (st.flash && SOS.t - st.flash.t < 0.2) win.dirty = true;
    }
  });

  /* ---------- Settings ---------- */
  const SET_PANES = [['general', 'General', '#8e8e93'], ['display', 'Display', '#0a84ff'], ['passthrough', 'Passthrough', '#30d158'], ['input', 'Input', '#ff9f0a'], ['sound', 'Sound', '#ff375f'], ['about', 'About', '#64d2ff']];
  reg({
    id: 'settings', title: 'Settings', w: 1160, h: 720,
    create(win) { win.state = { pane: 'general' }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, SW = 330;
      ui.rect(0, 0, SW, win.h, 0, 'rgba(0,0,0,.18)');
      ui.rect(26, 28, SW - 52, 54, 27, 'rgba(255,255,255,.1)'); ui.text('Search', 92, 56, { size: 24, color: WHITE2 });
      ui.hit('search', 26, 28, SW - 52, 54, { noDwell: true });
      c.strokeStyle = WHITE2; c.lineWidth = 3; c.beginPath(); c.arc(60, 54, 9, 0, 7); c.moveTo(67, 61); c.lineTo(74, 68); c.stroke();
      SET_PANES.forEach(function (p, i) {
        const y = 112 + i * 74, sel = st.pane === p[0], id = 'p_' + p[0], hv = ui.hover(id);
        ui.hit(id, 18, y, SW - 36, 64, { onClick: function () { st.pane = p[0]; win.scrollY = 0; win.dirty = true; } });
        if (sel || hv) ui.rect(18, y, SW - 36, 64, 20, sel ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.1)');
        ui.rect(34, y + 14, 36, 36, 10, p[2]); ui.text(p[1], 90, y + 33, { size: 27, weight: sel ? 700 : 500 });
      });
      const cx = SW + 40, cw = win.w - SW - 80, name = SET_PANES.filter(function (p) { return p[0] === st.pane; })[0][1];
      ui.text(name, SW + (win.w - SW) / 2, 44, { size: 32, align: 'center', weight: 700 });
      const rows = settingsRows(st.pane, win);
      let total = 20; rows.forEach(function (r) { total += r.h || 84; }); total += 20;
      ui.scroll(SW, 90, win.w - SW, win.h - 90, total, function () {
        let y = 110;
        rows.forEach(function (r, idx) {
          const h = r.h || 84, id = 'r' + idx;
          if (r.type === 'head') { ui.text(r.label, cx + 6, y + h - 22, { size: 20, color: WHITE2, weight: 700 }); y += h; return; }
          ui.rect(cx, y, cw, h - 10, 22, 'rgba(255,255,255,.08)');
          if (r.type === 'toggle') { ui.text(r.label, cx + 28, y + (h - 10) / 2, { size: 27 }); ui.toggle(id, cx + cw - 116, y + (h - 10) / 2 - 22, r.value, r.set); }
          else if (r.type === 'slider') { ui.text(r.label, cx + 28, y + (h - 10) / 2, { size: 27 }); ui.text(r.fmt(r.value), cx + cw - 420, y + (h - 10) / 2, { size: 24, color: WHITE2, align: 'right' }); ui.slider(id, cx + cw - 390, y + (h - 10) / 2, 340, r.value, r.min, r.max, r.set, r.step); }
          else if (r.type === 'button') { const hv = ui.hover(id); ui.hit(id, cx, y, cw, h - 10, { onClick: r.onClick }); if (hv) ui.rect(cx, y, cw, h - 10, 22, 'rgba(255,255,255,.14)'); ui.text(r.label, cx + 28, y + (h - 10) / 2, { size: 27, color: r.color || '#fff' }); if (r.note) ui.text(r.note, cx + cw - 28, y + (h - 10) / 2, { size: 23, color: WHITE2, align: 'right' }); }
          else if (r.type === 'info') { ui.text(r.label, cx + 28, y + (h - 10) / 2, { size: 27 }); ui.text(r.value, cx + cw - 28, y + (h - 10) / 2, { size: 25, color: WHITE2, align: 'right' }); }
          else if (r.type === 'choice') {
            ui.text(r.label, cx + 28, y + 30, { size: 27 }); const n = r.opts.length, bw = (cw - 56 - (n - 1) * 12) / n;
            r.opts.forEach(function (o, k) { const bid = id + '_' + k, on = r.value === o[0]; ui.btn(bid, cx + 28 + k * (bw + 12), y + 52, bw, 54, { label: o[1], size: 22, r: 16, fill: on ? '#0a84ff' : 'rgba(255,255,255,.1)', hoverFill: on ? '#2b95ff' : 'rgba(255,255,255,.22)', onClick: function () { r.set(o[0]); win.dirty = true; } }); });
          }
          y += h;
        });
      });
    }
  });
  function settingsRows(pane, win) {
    const t = function (label, k, extra) { return { type: 'toggle', label: label, value: S[k], set: function () { set(k, !S[k]); if (extra) extra(); win.dirty = true; } }; };
    const sl = function (label, k, min, max, step, fmt, extra) { return { type: 'slider', label: label, value: S[k], min: min, max: max, step: step, fmt: fmt, set: function (v) { set(k, v); if (extra) extra(); win.dirty = true; } }; };
    const head = function (l) { return { type: 'head', label: l, h: 56 }; };
    if (pane === 'general') return [head('SPACE'), { type: 'button', label: 'Recenter view', note: 'Face forward, then tap', onClick: function () { SOS.recenter(); } }, { type: 'button', label: 'Open Home', onClick: function () { SOS.toggleHome(); } },
      head('SYSTEM'), { type: 'button', label: 'Restore default settings', onClick: function () { SOS.resetSettings(); SOS.setEnv('passthrough'); SOS.setResScale(); win.dirty = true; } }, { type: 'button', label: 'Shut Down', color: '#ff453a', onClick: function () { SOS.quit(); } }];
    if (pane === 'display') return [head('LENSES'), sl('Eye distance', 'ipd', 54, 74, 1, function (v) { return v + ' mm'; }), sl('Field of view', 'fov', 60, 100, 1, function (v) { return v + '°'; }), t('Lens distortion correction', 'distortion'), sl('Lens strength', 'lens', 0, 1, 0.05, function (v) { return Math.round(v * 100) + '%'; }),
      head('DISPLAY'), sl('Render quality', 'resScale', 0.5, 1, 0.05, function (v) { return Math.round(v * 100) + '%'; }, function () { SOS.setResScale(); }), t('Centre divider', 'divider'), sl('Window size', 'winScale', 0.7, 1.4, 0.05, function (v) { return Math.round(v * 100) + '%'; })];
    if (pane === 'passthrough') return [head('BACKGROUND'), { type: 'choice', label: 'Space', value: SOS.env, opts: ENVS.map(function (e) { return [e, e === 'passthrough' ? 'Camera' : ENV_NAMES[e].split(' ')[0]]; }), set: function (e) { SOS.setEnv(e); }, h: 130 },
      sl('Camera brightness', 'bright', 0.5, 1.6, 0.05, function (v) { return Math.round(v * 100) + '%'; }), { type: 'info', label: 'Camera', value: SOS.videoReady ? 'Live' : 'Not available' }];
    if (pane === 'input') return [head('HANDS'), t('Hand tracking', 'hands'), t('Show hand cursor', 'handCursor'), { type: 'info', label: 'Hand status', value: !S.hands ? 'Off' : SOS.handsState || 'Starting…' },
      head('CARDBOARD'), t('Magnet button', 'magnet'), sl('Magnet trigger', 'magnetT', 15, 120, 5, function (v) { return v + ' µT'; }, function () { SOS.pushNative(); }), { type: 'info', label: 'Touch button', value: 'Tap = select · Hold = Home' },
      head('GAZE'), t('Dwell to select', 'dwell'), sl('Dwell time', 'dwellT', 0.6, 3, 0.1, function (v) { return v.toFixed(1) + ' s'; })];
    if (pane === 'sound') return [head('AUDIO'), t('Interface sounds', 'sound'), sl('Volume', 'volume', 0, 1, 0.05, function (v) { return Math.round(v * 100) + '%'; }, function () { SOS.tick(1200, 0.08, 0.1); })];
    return [head('SPATIALOS'), { type: 'info', label: 'Version', value: '1.0' }, { type: 'info', label: 'Frame rate', value: SOS.fps + ' fps' }, { type: 'info', label: 'Head tracking', value: SOS.nativeOK ? 'Gyroscope' : 'Mouse / keys' }, { type: 'info', label: 'Camera', value: SOS.videoReady ? 'Live' : 'Not available' },
      { type: 'info', label: 'Hands', value: !S.hands ? 'Off' : SOS.handsState || 'Starting…' }, { type: 'info', label: 'Open windows', value: String(Object.keys(SOS.wins).length) }];
  }
  SOS.apps.settings.tick = function (win) { if (win.state.pane === 'about' || win.state.pane === 'input') { win._t = (win._t || 0) + 1; if (win._t % 20 === 0) win.dirty = true; } };

  /* ---------- Notes ---------- */
  function wrapText(c, text, maxW) {
    const out = []; text.split('\n').forEach(function (para) {
      const words = para.split(' '); let line = '';
      words.forEach(function (w) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
      out.push(line);
    }); return out;
  }
  reg({
    id: 'notes', title: 'Notes', w: 980, h: 620, animated: false,
    create(win) { let t = ''; try { t = localStorage.getItem('sos.notes') || ''; } catch (e) {} win.state = { text: t }; },
    onKey(win, k) {
      let t = win.state.text;
      if (k === 'Backspace') t = t.slice(0, -1); else if (k === 'Enter') t += '\n'; else if (t.length < 4000) t += k;
      win.state.text = t; try { localStorage.setItem('sos.notes', t); } catch (e) {}
    },
    tick(win) { if (SOS.kbFor === win) { const b = Math.floor(SOS.t * 2) % 2; if (b !== win._b) { win._b = b; win.dirty = true; } } },
    draw(ui, win) {
      const c = ui.c, st = win.state, kb = SOS.kbFor === win;
      ui.text('Notes', 48, 52, { size: 34, weight: 700 });
      ui.btn('clr', win.w - 330, 24, 130, 54, { label: 'Clear', size: 23, r: 27, onClick: function () { st.text = ''; try { localStorage.setItem('sos.notes', ''); } catch (e) {} win.dirty = true; } });
      ui.btn('kb', win.w - 184, 24, 140, 54, { label: kb ? 'Done' : 'Type', size: 23, r: 27, fill: kb ? '#0a84ff' : 'rgba(255,255,255,.12)', hoverFill: kb ? '#2b95ff' : undefined, onClick: function () { if (SOS.kbFor === win) SOS.hideKeyboard(); else SOS.showKeyboard(win); win.dirty = true; } });
      const ax = 36, ay = 104, aw = win.w - 72, ah = win.h - 140;
      ui.rect(ax, ay, aw, ah, 26, 'rgba(255,255,255,' + (ui.hover('area') ? '.14' : '.08') + ')', kb ? '#0a84ff' : null, 3);
      ui.hit('area', ax, ay, aw, ah, { onClick: function () { if (SOS.kbFor !== win) SOS.showKeyboard(win); win.dirty = true; } });
      c.save(); c.font = '500 32px ' + FONT; const lines = wrapText(c, st.text, aw - 64); c.restore();
      if (!st.text) ui.text('Tap here to start typing…', ax + 32, ay + 48, { size: 32, color: 'rgba(255,255,255,.4)' });
      const lh = 46, maxL = Math.floor((ah - 40) / lh), start = Math.max(0, lines.length - maxL);
      lines.slice(start).forEach(function (l, i) { ui.text(l, ax + 32, ay + 48 + i * lh, { size: 32 }); });
      if (kb && Math.floor(SOS.t * 2) % 2 === 0) { const li = lines.length - 1 - start, last = lines[lines.length - 1] || ''; c.font = '500 32px ' + FONT; const tw = c.measureText(last).width; ui.rect(ax + 34 + tw, ay + 48 + li * lh - 19, 3, 38, 1, '#0a84ff'); }
    }
  });

  /* ---------- Photos ---------- */
  function envThumb(kind, w, h) { const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; SOS.drawEnv(kind, cv); const o = document.createElement('canvas'); o.width = w; o.height = h; const oc = o.getContext('2d'); oc.drawImage(cv, 2048 * 0.75 - 560, 1024 * 0.5 - 320, 1120, 630, 0, 0, w, h); return o; }
  reg({
    id: 'photos', title: 'Photos', w: 1100, h: 660,
    create(win) {
      win.state = { sel: 0, imgs: [] };
      try { win.state.imgs = [envThumb('sunset', 640, 360), envThumb('night', 640, 360), envThumb('studio', 640, 360)]; } catch (e) {}
    },
    draw(ui, win) {
      const st = win.state, c = ui.c;
      ui.text('Photos', 48, 52, { size: 34, weight: 700 });
      ui.btn('shot', win.w - 360, 24, 190, 56, { label: '● Capture', size: 24, r: 28, fill: '#ff453a', hoverFill: '#ff6a60', onClick: function () {
        const v = SOS.video; if (!v || !SOS.videoReady) return;
        const o = document.createElement('canvas'); o.width = 640; o.height = 360; const oc = o.getContext('2d'); const va = v.videoWidth / v.videoHeight, ta = 640 / 360; let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0; if (va > ta) { sw = sh * ta; sx = (v.videoWidth - sw) / 2; } else { sh = sw / ta; sy = (v.videoHeight - sh) / 2; }
        oc.drawImage(v, sx, sy, sw, sh, 0, 0, 640, 360); st.imgs.push(o); st.sel = st.imgs.length - 1; if (st.imgs.length > 14) { st.imgs.shift(); st.sel--; } SOS.tick(1800, 0.12, 0.1); win.dirty = true;
      } });
      ui.btn('del', win.w - 160, 24, 112, 56, { label: 'Delete', size: 22, r: 28, onClick: function () { if (st.imgs.length) { st.imgs.splice(st.sel, 1); st.sel = clamp(st.sel, 0, Math.max(0, st.imgs.length - 1)); win.dirty = true; } } });
      const px = 36, py = 110, pw = 700, ph = 394;
      ui.rect(px, py, pw, ph, 26, 'rgba(0,0,0,.35)');
      const img = st.imgs[st.sel];
      if (img) { c.save(); rr(c, px, py, pw, ph, 26); c.clip(); c.drawImage(img, px, py, pw, ph); c.restore(); } else ui.text('No photos yet', px + pw / 2, py + ph / 2, { size: 30, align: 'center', color: WHITE2 });
      ui.text(SOS.videoReady ? 'Capture saves what the camera sees.' : 'Camera is not available, showing built-in scenes.', px, py + ph + 40, { size: 22, color: WHITE2 });
      const gx = 770, gy = 110; ui.text(st.imgs.length + ' items', gx, gy - 4, { size: 20, color: WHITE2, weight: 600 });
      st.imgs.forEach(function (im, i) {
        const col = i % 2, row = Math.floor(i / 2), x = gx + col * 160, y = gy + 24 + row * 98, id = 'th' + i;
        ui.hit(id, x, y, 150, 90, { onClick: function () { st.sel = i; win.dirty = true; } });
        c.save(); rr(c, x, y, 150, 86, 14); c.clip(); c.drawImage(im, x, y, 150, 86); c.restore();
        if (i === st.sel) ui.rect(x, y, 150, 86, 14, null, '#0a84ff', 4); else if (ui.hover(id)) ui.rect(x, y, 150, 86, 14, 'rgba(255,255,255,.18)');
      });
    }
  });

  /* ---------- Music ---------- */
  const TRACKS = [{ n: 'Aurora', a: 'Ambient', ch: [[57, 60, 64, 71], [53, 57, 60, 67], [55, 59, 62, 69], [52, 56, 59, 66]] }, { n: 'Dunes', a: 'Warm pads', ch: [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]] }, { n: 'Tide', a: 'Slow waves', ch: [[55, 59, 62, 66], [52, 55, 59, 64], [50, 54, 57, 62], [54, 57, 61, 66]] }, { n: 'Orbit', a: 'Night drift', ch: [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 59]] }];
  const mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  const synth = { ctx: null, master: null, an: null, timer: null, idx: -1, step: 0, playing: false, data: null };
  function synthStop() { if (synth.timer) { clearInterval(synth.timer); synth.timer = null; } synth.playing = false; if (synth.master) { try { synth.master.gain.setTargetAtTime(0, synth.ctx.currentTime, 0.2); } catch (e) {} } }
  function synthPlay(i) {
    const a = SOS.audio(); if (!a) return; synthStop(); synth.ctx = a; synth.idx = i; synth.step = 0; synth.playing = true;
    if (!synth.an) { synth.an = a.createAnalyser(); synth.an.fftSize = 128; synth.an.smoothingTimeConstant = 0.8; synth.an.connect(a.destination); synth.data = new Uint8Array(synth.an.frequencyBinCount); }
    synth.master = a.createGain(); synth.master.gain.value = S.volume; synth.master.connect(synth.an);
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(synth.master); const mgn = synth.master;
    const beat = function () {
      const tr = TRACKS[synth.idx], now = a.currentTime, st = synth.step++, chord = tr.ch[Math.floor(st / 8) % 4];
      if (st % 8 === 0) chord.forEach(function (m, k) { const o = a.createOscillator(), g = a.createGain(); o.type = k % 2 ? 'sawtooth' : 'triangle'; o.frequency.value = mtof(m - 12 + (k === 3 ? 12 : 0)); o.detune.value = (k - 1.5) * 5; g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.05, now + 1.2); g.gain.linearRampToValueAtTime(0.0001, now + 4.6); o.connect(g); g.connect(lp); o.start(now); o.stop(now + 4.8); });
      if (st % 2 === 0 || Math.random() < 0.3) { const m = chord[(st * 3 + (st >> 2)) % chord.length] + 12, o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = mtof(m); g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(0.11, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1); o.connect(g); g.connect(mgn); o.start(now); o.stop(now + 1.2); }
    };
    beat(); synth.timer = setInterval(beat, 500);
  }
  reg({
    id: 'music', title: 'Music', w: 940, h: 600, animated: false,
    tick(win) { if (synth.playing) { win._m = (win._m || 0) + 1; if (win._m % 2 === 0) win.dirty = true; } if (synth.master) synth.master.gain.value = S.volume; },
    onClose() { synthStop(); },
    draw(ui, win) {
      const c = ui.c;
      ui.text('Music', 48, 52, { size: 34, weight: 700 });
      TRACKS.forEach(function (t, i) {
        const y = 100 + i * 82, id = 't' + i, on = synth.idx === i && synth.playing;
        ui.hit(id, 36, y, 430, 72, { onClick: function () { if (synth.idx === i && synth.playing) synthStop(); else synthPlay(i); win.dirty = true; } });
        ui.rect(36, y, 430, 72, 20, ui.hover(id) ? 'rgba(255,255,255,.18)' : on ? 'rgba(255,69,58,.28)' : 'rgba(255,255,255,.07)');
        ui.text(t.n, 70, y + 26, { size: 28, weight: 700 }); ui.text(t.a, 70, y + 54, { size: 20, color: WHITE2 });
        ui.text(on ? '❚❚' : '▶', 430, y + 36, { size: 24, align: 'center', color: on ? '#ff6a60' : WHITE2 });
      });
      // visualizer
      ui.rect(500, 100, 404, 262, 26, 'rgba(0,0,0,.28)');
      if (synth.an && synth.playing) synth.an.getByteFrequencyData(synth.data);
      for (let i = 0; i < 24; i++) { const v = synth.playing && synth.data ? synth.data[i + 2] / 255 : 0.04 + 0.02 * Math.sin(i + SOS.t); const h = 12 + v * 220; const g = c.createLinearGradient(0, 340 - h, 0, 340); g.addColorStop(0, '#ff5e75'); g.addColorStop(1, '#ff9f0a'); c.fillStyle = g; rr(c, 522 + i * 15.6, 340 - h, 10, h, 5); c.fill(); }
      const nm = synth.idx >= 0 ? TRACKS[synth.idx].n : 'Pick a track'; ui.text(nm, 700, 400, { size: 30, weight: 700, align: 'center' });
      ui.btn('prev', 560, 440, 90, 80, { label: '⏮', size: 30, r: 40, onClick: function () { synthPlay((Math.max(0, synth.idx) + 3) % 4); win.dirty = true; } });
      ui.btn('play', 662, 436, 100, 88, { label: synth.playing ? '❚❚' : '▶', size: 34, r: 44, fill: '#ff453a', hoverFill: '#ff6a60', onClick: function () { if (synth.playing) synthStop(); else synthPlay(Math.max(0, synth.idx)); win.dirty = true; } });
      ui.btn('next', 774, 440, 90, 80, { label: '⏭', size: 30, r: 40, onClick: function () { synthPlay((synth.idx + 1) % 4); win.dirty = true; } });
      ui.text('Volume', 60, 530, { size: 22, color: WHITE2 }); ui.slider('vol', 160, 530, 260, S.volume, 0, 1, function (v) { set('volume', v); win.dirty = true; }, 0.05);
    }
  });

  /* ---------- Sketch ---------- */
  const PALETTE = ['#ffffff', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'];
  reg({
    id: 'sketch', title: 'Sketch', w: 1060, h: 640,
    create(win) { const a = document.createElement('canvas'); a.width = 780; a.height = 520; win.state = { art: a, col: '#ffffff', size: 8, gazePen: false, last: {} }; },
    draw(ui, win) {
      const st = win.state, c = ui.c, ax = 240, ay = 100, aw = 780, ah = 520;
      ui.text('Sketch', 48, 52, { size: 34, weight: 700 });
      ui.rect(ax, ay, aw, ah, 26, 'rgba(0,0,0,.4)');
      c.save(); rr(c, ax, ay, aw, ah, 26); c.clip(); c.drawImage(st.art, ax, ay); c.restore();
      ui.hit('art', ax, ay, aw, ah, { noDwell: true, noScroll: true, onClick: function (px, py, p) { if (!p.isHand) { st.gazePen = !st.gazePen; st.last.gaze = null; win.dirty = true; } } });
      if (st.gazePen) ui.rect(ax, ay, aw, ah, 26, null, '#0a84ff', 4);
      ui.text(st.gazePen ? 'Pen down: look around to draw, tap to lift' : 'Tap to put the pen down (pinch to draw with a hand)', ax + aw / 2, ay + ah + 0, { size: 1, color: 'rgba(0,0,0,0)' });
      PALETTE.forEach(function (col, i) { const x = 36, y = 100 + i * 62, id = 'col' + i, hv = ui.hover(id); ui.hit(id, x, y, 56, 56, { onClick: function () { st.col = col; win.dirty = true; } }); c.fillStyle = col; c.beginPath(); c.arc(x + 28, y + 28, hv ? 25 : 22, 0, 7); c.fill(); if (st.col === col) { c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(x + 28, y + 28, 29, 0, 7); c.stroke(); } });
      [5, 10, 18].forEach(function (s, i) { const x = 112, y = 100 + i * 62, id = 'sz' + i; ui.hit(id, x, y, 56, 56, { onClick: function () { st.size = s; win.dirty = true; } }); ui.rect(x, y, 56, 56, 18, st.size === s ? 'rgba(255,255,255,.3)' : ui.hover(id) ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.08)'); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 28, y + 28, s / 2 + 1, 0, 7); c.fill(); });
      ui.btn('eraser', 112, 100 + 3 * 62, 56, 56, { r: 18, onClick: function () { st.col = '#000000'; win.dirty = true; }, draw: function (cc, x, y) { ui.text('⌫', x + 28, y + 30, { size: 26, align: 'center' }); } });
      ui.btn('clear', 36, 100 + 7 * 62 + 8, 132, 56, { label: 'Clear', size: 22, r: 28, onClick: function () { st.art.getContext('2d').clearRect(0, 0, st.art.width, st.art.height); win.dirty = true; } });
    },
    tick(win) {
      const st = win.state, a = st.art.getContext('2d'); let drew = false;
      ['gaze', 'h0', 'h1'].forEach(function (id) {
        const p = SOS.pointers[id], pen = id === 'gaze' ? st.gazePen : p.pinch;
        if (!p.active || !p.hit || p.hit.win !== win || !pen) { st.last[id] = null; return; }
        const x = p.hit.px - 240, y = p.hit.py - 100; if (x < 0 || y < 0 || x > 780 || y > 520) { st.last[id] = null; return; }
        const l = st.last[id]; a.strokeStyle = st.col; a.lineWidth = st.size; a.lineCap = 'round'; a.lineJoin = 'round';
        if (st.col === '#000000') { a.globalCompositeOperation = 'destination-out'; a.lineWidth = 36; }
        a.beginPath(); if (l) a.moveTo(l[0], l[1]); else a.moveTo(x, y); a.lineTo(x + 0.01, y); a.stroke(); a.globalCompositeOperation = 'source-over';
        st.last[id] = [x, y]; drew = true;
      });
      if (drew) win.dirty = true;
    }
  });

  /* ---------- Calculator ---------- */
  reg({
    id: 'calc', title: 'Calculator', w: 620, h: 800,
    create(win) { win.state = { d: '0', acc: null, op: null, fresh: true }; },
    draw(ui, win) {
      const st = win.state, c = ui.c;
      const fmt = function (s) { return s.length > 12 ? Number(s).toPrecision(9).replace(/\.?0+$/, '') : s; };
      ui.text(fmt(st.d), win.w - 44, 120, { size: st.d.length > 9 ? 70 : 96, align: 'right', weight: 300 });
      const keys = [['AC', '±', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['0', '.', '=']];
      const calc = function (a, b, op) { return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : op === '÷' ? (b === 0 ? NaN : a / b) : b; };
      const press = function (k) {
        if (/\d/.test(k)) { st.d = st.fresh || st.d === '0' ? k : st.d + k; st.fresh = false; }
        else if (k === '.') { if (st.fresh) { st.d = '0.'; st.fresh = false; } else if (st.d.indexOf('.') < 0) st.d += '.'; }
        else if (k === 'AC') { st.d = '0'; st.acc = null; st.op = null; st.fresh = true; }
        else if (k === '±') st.d = String(-Number(st.d)); else if (k === '%') st.d = String(Number(st.d) / 100);
        else { const v = Number(st.d); if (st.op && !st.fresh) { st.acc = calc(st.acc, v, st.op); st.d = isFinite(st.acc) ? String(+st.acc.toPrecision(12)) : 'Error'; } else st.acc = v; st.fresh = true; st.op = k === '=' ? null : k; }
        win.dirty = true;
      };
      keys.forEach(function (row, ri) {
        let x = 28; const y = 190 + ri * 118;
        row.forEach(function (k, i) {
          const w = (ri === 4 && i === 0) ? 270 : 128, isOp = '÷×−+='.indexOf(k) >= 0, top = ri === 0 && i < 3, id = 'c' + k, hv = ui.hover(id), act = st.op === k && st.fresh;
          ui.hit(id, x, y, w, 106, { onClick: function () { press(k); } });
          ui.rect(x, y, w, 106, 53, act ? '#fff' : isOp ? (hv ? '#ffb340' : '#ff9f0a') : top ? (hv ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.34)') : (hv ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.18)'));
          ui.text(k, ri === 4 && i === 0 ? x + 64 : x + w / 2, y + 54, { size: 44, align: ri === 4 && i === 0 ? 'left' : 'center', color: act ? '#ff9f0a' : '#fff', weight: 500 });
          x += w + 12;
        });
      });
    }
  });

  /* ---------- Clock ---------- */
  reg({
    id: 'clock', title: 'Clock', w: 960, h: 560, animated: true,
    create(win) { win.state = { run: false, t0: 0, acc: 0 }; },
    draw(ui, win) {
      const c = ui.c, st = win.state, d = new Date(), cx = 270, cy = 290, R = 200;
      ui.text('Clock', 48, 52, { size: 34, weight: 700 });
      c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(cx, cy, R + 14, 0, 7); c.fill();
      c.fillStyle = '#f5f5f7'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 === 0 ? 22 : 9; c.strokeStyle = '#222'; c.lineWidth = i % 5 === 0 ? 5 : 2; c.beginPath(); c.moveTo(cx + Math.sin(a) * (R - 10), cy - Math.cos(a) * (R - 10)); c.lineTo(cx + Math.sin(a) * (R - 10 - l), cy - Math.cos(a) * (R - 10 - l)); c.stroke(); }
      for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; ui.text(String(i), cx + Math.sin(a) * (R - 54), cy - Math.cos(a) * (R - 54), { size: 34, align: 'center', color: '#111', weight: 600 }); }
      const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
      const hand = function (a, l, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - Math.sin(a) * l * 0.15, cy + Math.cos(a) * l * 0.15); c.lineTo(cx + Math.sin(a) * l, cy - Math.cos(a) * l); c.stroke(); };
      hand(h / 12 * Math.PI * 2, R * 0.5, 10, '#111'); hand(m / 60 * Math.PI * 2, R * 0.78, 7, '#111'); hand(s / 60 * Math.PI * 2, R * 0.86, 3, '#ff9f0a');
      c.fillStyle = '#ff9f0a'; c.beginPath(); c.arc(cx, cy, 9, 0, 7); c.fill(); c.restore();
      const pad = function (n, k) { return String(n).padStart(k || 2, '0'); };
      ui.text(pad(d.getHours()) + ':' + pad(d.getMinutes()), 700, 150, { size: 96, align: 'center', weight: 300 });
      ui.text(d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }), 700, 218, { size: 26, align: 'center', color: WHITE2 });
      const el = st.acc + (st.run ? (performance.now() - st.t0) : 0), mm = Math.floor(el / 60000), ss = Math.floor(el / 1000) % 60, cs = Math.floor(el / 10) % 100;
      ui.text(pad(mm) + ':' + pad(ss) + '.' + pad(cs), 700, 330, { size: 62, align: 'center', weight: 300 });
      ui.btn('sw1', 540, 400, 150, 70, { label: st.run ? 'Stop' : 'Start', size: 26, r: 35, fill: st.run ? '#ff453a' : '#30d158', hoverFill: st.run ? '#ff6a60' : '#4be06f', onClick: function () { if (st.run) { st.acc += performance.now() - st.t0; st.run = false; } else { st.t0 = performance.now(); st.run = true; } } });
      ui.btn('sw2', 710, 400, 150, 70, { label: 'Reset', size: 26, r: 35, onClick: function () { st.run = false; st.acc = 0; } });
    }
  });

  /* ---------- Environments ---------- */
  const envThumbs = {};
  reg({
    id: 'env', title: 'Environments', w: 1000, h: 640,
    draw(ui, win) {
      const c = ui.c; ui.text('Environments', 48, 52, { size: 34, weight: 700 });
      ENVS.forEach(function (e, i) {
        const x = 40 + (i % 2) * 464, y = 104 + Math.floor(i / 2) * 252, w = 440, h = 232, id = 'e' + e, on = SOS.env === e, hv = ui.hover(id);
        ui.hit(id, x, y, w, h, { onClick: function () { SOS.setEnv(e); win.dirty = true; } });
        c.save(); rr(c, x, y, w, h, 26); c.clip();
        if (e === 'passthrough') { if (SOS.videoReady && SOS.video) { const v = SOS.video, va = v.videoWidth / v.videoHeight, ta = w / h; let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0; if (va > ta) { sw = sh * ta; sx = (v.videoWidth - sw) / 2; } else { sh = sw / ta; sy = (v.videoHeight - sh) / 2; } c.drawImage(v, sx, sy, sw, sh, x, y, w, h); } else { c.fillStyle = '#242830'; c.fillRect(x, y, w, h); ICONS.target(c, x + w / 2, y + h / 2 - 10, 70); } }
        else { if (!envThumbs[e]) envThumbs[e] = envThumb(e, 440, 232); c.drawImage(envThumbs[e], x, y); }
        const g = c.createLinearGradient(0, y + h - 90, 0, y + h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)'); c.fillStyle = g; c.fillRect(x, y + h - 90, w, 90); c.restore();
        ui.text(ENV_NAMES[e], x + 26, y + h - 32, { size: 28, weight: 700, shadow: true });
        if (on) { ui.rect(x, y, w, h, 26, null, '#0a84ff', 5); ui.text('Active', x + w - 26, y + h - 32, { size: 22, align: 'right', color: '#64d2ff', weight: 700 }); } else if (hv) ui.rect(x, y, w, h, 26, 'rgba(255,255,255,.15)');
      });
    },
    tick(win) { if (SOS.videoReady) { win._e = (win._e || 0) + 1; if (win._e % 6 === 0) win.dirty = true; } }
  });

  /* ---------- Store ---------- */
  reg({
    id: 'store', title: 'Store', w: 1100, h: 680,
    create(win) { win.state = { page: 0 }; },
    draw(ui, win) {
      const c = ui.c, st = win.state;
      ui.rect(24, 250, 64, 168, 32, 'rgba(0,0,0,.3)'); ['apps', 'target', 'home'].forEach(function (k, i) { const y = 292 + i * 52; c.fillStyle = i === 0 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,0)'; c.beginPath(); c.arc(56, y, 20, 0, 7); c.fill(); ICONS[k](c, 56, y, 20); });
      ui.text('Apps & Games', 130, 52, { size: 30, weight: 700 });
      const hx = 120, hy = 96, hw = 940, hh = 340;
      c.save(); rr(c, hx, hy, hw, hh, 30); c.clip(); const g = c.createLinearGradient(hx, hy, hx + hw, hy + hh); g.addColorStop(0, '#0a63ff'); g.addColorStop(1, '#5ad0ff'); c.fillStyle = g; c.fillRect(hx, hy, hw, hh);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(hx + 760, hy + 170, 250, 0, 7); c.fill(); c.restore();
      ui.text('GET STARTED', hx + 44, hy + 70, { size: 20, weight: 700, color: 'rgba(255,255,255,.8)' });
      ui.text('A new space', hx + 44, hy + 130, { size: 52, weight: 700 }); ui.text('for your apps', hx + 44, hy + 190, { size: 52, weight: 700 });
      ui.text('Everything here runs right on your phone.', hx + 44, hy + 242, { size: 22, color: 'rgba(255,255,255,.82)' });
      ui.btn('story', hx + 44, hy + 268, 190, 54, { label: 'Open Sketch', size: 22, r: 27, fill: 'rgba(255,255,255,.28)', hoverFill: 'rgba(255,255,255,.45)', onClick: function () { SOS.open('sketch'); } });
      c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30; c.shadowOffsetY = 10; ICONS.store(c, hx + 740, hy + 170, 130); c.restore();
      ui.text('Dive Into These Must-Have Apps', hx, 482, { size: 24, weight: 700 });
      [['sketch', 'Sketch', 'Draw in the air'], ['music', 'Music', 'Ambient synth'], ['breathe', 'Breathe', 'Slow down']].forEach(function (a, i) {
        const x = hx + i * 316, y = 512, id = 'card' + i;
        ui.hit(id, x, y, 300, 130, { onClick: function () { SOS.open(a[0]); } });
        ui.rect(x, y, 300, 130, 26, ui.hover(id) ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)'); ICONS[a[0]](c, x + 66, y + 65, 38);
        ui.text(a[1], x + 124, y + 52, { size: 28, weight: 700 }); ui.text(a[2], x + 124, y + 88, { size: 21, color: WHITE2 });
      });
    }
  });

  /* ---------- Breathe ---------- */
  reg({
    id: 'breathe', title: 'Breathe', w: 820, h: 620, animated: true,
    draw(ui, win) {
      const c = ui.c, cx = win.w / 2, cy = 300, ph = (SOS.t % 8) / 8, k = ph < 0.5 ? ph * 2 : 2 - ph * 2, e = U.ease(k);
      const bg = c.createRadialGradient(cx, cy, 20, cx, cy, 420); bg.addColorStop(0, 'rgba(94,234,212,.25)'); bg.addColorStop(1, 'rgba(15,154,166,.05)'); c.fillStyle = bg; c.fillRect(0, 0, win.w, win.h);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + SOS.t * 0.15, r = 70 + e * 70; c.fillStyle = 'rgba(94,234,212,' + (0.18 + e * 0.1) + ')'; c.beginPath(); c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 80 + e * 40, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(cx, cy, 30 + e * 22, 0, 7); c.fill();
      ui.text(ph < 0.5 ? 'Breathe in' : 'Breathe out', cx, 530, { size: 40, align: 'center', weight: 300 });
      ui.text('Breathe', 48, 52, { size: 34, weight: 700 });
    }
  });

  /* ---------- Compass ---------- */
  reg({
    id: 'compass', title: 'Compass', w: 640, h: 640, animated: true,
    draw(ui, win) {
      const c = ui.c, cx = 320, cy = 320, R = 230; let hd = ((-(SOS.yawRaw) * 180 / Math.PI) % 360 + 360) % 360; if (!SOS.nativeOK) hd = ((-(SOS.yawRaw) * 180 / Math.PI) % 360 + 360) % 360;
      ui.text('Compass', 48, 52, { size: 34, weight: 700 });
      c.save(); c.translate(cx, cy); c.rotate(-hd * Math.PI / 180);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
      for (let i = 0; i < 72; i++) { const a = i * 5 * Math.PI / 180, l = i % 6 === 0 ? 26 : 12; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = i % 6 === 0 ? 4 : 2; c.beginPath(); c.moveTo(Math.sin(a) * R, -Math.cos(a) * R); c.lineTo(Math.sin(a) * (R - l), -Math.cos(a) * (R - l)); c.stroke(); }
      [['N', 0, '#ff453a'], ['E', 90, '#fff'], ['S', 180, '#fff'], ['W', 270, '#fff']].forEach(function (d) { const a = d[1] * Math.PI / 180; c.save(); c.translate(Math.sin(a) * (R - 62), -Math.cos(a) * (R - 62)); c.rotate(hd * Math.PI / 180); ui.text(d[0], 0, 0, { size: 42, align: 'center', weight: 700, color: d[2] }); c.restore(); });
      c.restore();
      c.fillStyle = '#ff453a'; c.beginPath(); c.moveTo(cx, cy - R - 16); c.lineTo(cx + 14, cy - R + 14); c.lineTo(cx - 14, cy - R + 14); c.fill();
      ui.text(Math.round(hd) + '°', cx, cy - 6, { size: 84, align: 'center', weight: 300 });
      ui.text('Tilt ' + Math.round(SOS.pitchRaw * 180 / Math.PI) + '°', cx, cy + 62, { size: 26, align: 'center', color: WHITE2 });
    }
  });
})();
