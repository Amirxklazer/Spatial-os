'use strict';
/* Orbit OS apps 5: Orbit Call (video calls), Calendar, Reminders, Tips, web apps (YouTube, Disney+, Zoom...) and the new Orbit Store */
(function () {
  const SOS = window.SOS, U = SOS.util, FONT = SOS.FONT, reg = SOS.registerApp, ICONS = SOS.ICONS, LABELS = SOS.LABELS;
  const clamp = U.clamp, rr = U.rr, WHITE2 = 'rgba(255,255,255,.62)';
  const NB = function () { return window.NativeBridge; };
  function base(c, x, y, r, a, b) { const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function glyph(a, b, txt) { return function (c, x, y, r) { base(c, x, y, r, a, b); c.save(); c.fillStyle = '#fff'; c.font = '800 ' + Math.round(r * (txt.length > 2 ? 0.6 : txt.length > 1 ? 0.78 : 0.9)) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + r * 0.04); c.restore(); }; }

  /* ---------- icons ---------- */
  ICONS.call = function (c, x, y, r) {
    base(c, x, y, r, '#22d3b6', '#2563eb'); c.fillStyle = '#fff'; rr(c, x - r * 0.52, y - r * 0.3, r * 0.68, r * 0.6, r * 0.14); c.fill();
    c.beginPath(); c.moveTo(x + r * 0.24, y - r * 0.08); c.lineTo(x + r * 0.58, y - r * 0.3); c.lineTo(x + r * 0.58, y + r * 0.3); c.lineTo(x + r * 0.24, y + r * 0.08); c.closePath(); c.fill();
  };
  ICONS.calendar = function (c, x, y, r) {
    base(c, x, y, r, '#ffffff', '#e8e8ee'); c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip(); c.fillStyle = '#ff453a'; c.fillRect(x - r, y - r, r * 2, r * 0.62); c.restore();
    c.fillStyle = '#fff'; c.font = '700 ' + Math.round(r * 0.26) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(new Date().toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(), x, y - r * 0.68 + r * 0.31);
    c.fillStyle = '#1c1c1e'; c.font = '300 ' + Math.round(r * 0.9) + 'px ' + FONT; c.fillText(String(new Date().getDate()), x, y + r * 0.22);
  };
  ICONS.reminders = function (c, x, y, r) {
    base(c, x, y, r, '#ffffff', '#ececf1'); const cols = ['#ff453a', '#ff9f0a', '#0a84ff']; c.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const yy = y - r * 0.4 + i * r * 0.4; c.fillStyle = cols[i]; c.beginPath(); c.arc(x - r * 0.42, yy, r * 0.1, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = r * 0.07; c.beginPath(); c.moveTo(x - r * 0.2, yy); c.lineTo(x + r * 0.5, yy); c.stroke(); }
  };
  ICONS.tips = function (c, x, y, r) {
    base(c, x, y, r, '#ffd60a', '#ff9f0a'); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y - r * 0.1, r * 0.3, 0, 7); c.fill(); rr(c, x - r * 0.16, y + r * 0.16, r * 0.32, r * 0.2, r * 0.05); c.fill(); rr(c, x - r * 0.11, y + r * 0.4, r * 0.22, r * 0.08, r * 0.04); c.fill();
  };

  /* ---------- web apps: open inside the Orbit Browser ---------- */
  const WEB = {
    w_yt: ['YouTube', 'Videos on a giant screen', 'Watch', 'https://www.youtube.com/', '#ff4d4d', '#b30000', '▶'],
    w_twitch: ['Twitch', 'Live streams', 'Watch', 'https://www.twitch.tv/', '#9146ff', '#5a1fb8', 'Tw'],
    w_disney: ['Disney+', 'Movies and shows', 'Watch', 'https://www.disneyplus.com/', '#2563eb', '#0b1e6b', 'D+'],
    w_max: ['Max', 'Series and films', 'Watch', 'https://www.max.com/', '#6d5df6', '#1e1b4b', 'max'],
    w_prime: ['Prime Video', 'Watch anywhere', 'Watch', 'https://www.primevideo.com/', '#0ea5e9', '#075985', 'P'],
    w_crunchy: ['Crunchyroll', 'Anime streaming', 'Watch', 'https://www.crunchyroll.com/', '#fb923c', '#c2410c', 'C'],
    w_spotify: ['Spotify', 'Music and podcasts', 'Watch', 'https://open.spotify.com/', '#34d399', '#047857', 'S'],
    w_zoom: ['Zoom', 'Meetings', 'Work', 'https://app.zoom.us/wc', '#3b82f6', '#1d4ed8', 'Z'],
    w_teams: ['Teams', 'Chat and meetings', 'Work', 'https://teams.microsoft.com/', '#7c6cf0', '#3730a3', 'T'],
    w_slack: ['Slack', 'Team messaging', 'Work', 'https://app.slack.com/', '#e879f9', '#86198f', 'Sl'],
    w_word: ['Word', 'Documents', 'Work', 'https://www.office.com/launch/word', '#3b82f6', '#1e3a8a', 'W'],
    w_excel: ['Excel', 'Spreadsheets', 'Work', 'https://www.office.com/launch/excel', '#22c55e', '#14532d', 'X'],
    w_ppt: ['PowerPoint', 'Presentations', 'Work', 'https://www.office.com/launch/powerpoint', '#f97316', '#9a3412', 'P'],
    w_maps: ['Maps', 'Explore places', 'Work', 'https://www.google.com/maps', '#4ade80', '#15803d', 'M'],
    w_wa: ['WhatsApp', 'Messages', 'Social', 'https://web.whatsapp.com/', '#4ade80', '#166534', 'Wa'],
    w_discord: ['Discord', 'Voice and chat', 'Social', 'https://discord.com/app', '#818cf8', '#3730a3', 'Di'],
    w_tiktok: ['TikTok', 'Short videos', 'Social', 'https://www.tiktok.com/', '#22d3ee', '#0f172a', 'Tk']
  };
  const noop = function () {};
  Object.keys(WEB).forEach(function (id) {
    const w = WEB[id]; LABELS[id] = w[0]; ICONS[id] = glyph(w[4], w[5], w[6]);
    reg({ id: id, title: w[0], w: 8, h: 8, draw: noop });
    SOS.CATALOG.push([id, w[0], w[1], w[2]]);
  });
  const openOrig = SOS.open;
  SOS.open = function (id, o) { if (WEB[id]) { SOS.openBrowser(WEB[id][3], true); return null; } return openOrig.apply(this, arguments); };

  [['call', 'Orbit Call', 'Video calls in your room', 'Social'], ['calendar', 'Calendar', 'Plan your days', 'Work'], ['reminders', 'Reminders', 'Never forget a thing', 'Work'], ['tips', 'Tips', 'Learn the gestures', 'Tools']].forEach(function (a) { LABELS[a[0]] = a[1]; SOS.CATALOG.push(a); });

  /* ---------- Orbit Call: peer-to-peer video calls with a 6 digit code ---------- */
  const CALL = { peer: null, call: null, local: null, vid: null, state: 'idle', code: '', input: '', msg: '', muted: false, win: null };
  const poke = function () { if (CALL.win) CALL.win.dirty = true; };
  function micPerm() { const nb = NB(); if (!nb || !nb.hasMicPermission || nb.hasMicPermission()) return Promise.resolve(true); return new Promise(function (res) { SOS._micRes = res; nb.requestMicPermission(); setTimeout(function () { if (SOS._micRes === res) { SOS._micRes = null; res(false); } }, 60000); }); }
  async function getLocal() {
    if (CALL.local) return CALL.local;
    if (!window.Peer) throw new Error('The call library did not load');
    if (!(await micPerm())) throw new Error('Microphone is blocked');
    if (SOS.camState !== 'on') { try { await SOS.enableCamera(); } catch (e) {} }
    const tracks = [];
    try { const a = await navigator.mediaDevices.getUserMedia({ audio: true }); a.getAudioTracks().forEach(function (t) { tracks.push(t); }); } catch (e) { throw new Error('No microphone access'); }
    try { if (SOS.camCv && SOS.camCv.captureStream) SOS.camCv.captureStream(15).getVideoTracks().forEach(function (t) { tracks.push(t); }); } catch (e) {}
    CALL.local = new MediaStream(tracks); return CALL.local;
  }
  function endCall(msg) {
    try { if (CALL.call) CALL.call.close(); } catch (e) {} try { if (CALL.peer) CALL.peer.destroy(); } catch (e) {}
    if (CALL.local) CALL.local.getAudioTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    if (CALL.vid) { try { CALL.vid.srcObject = null; } catch (e) {} }
    CALL.call = null; CALL.peer = null; CALL.local = null; CALL.state = 'idle'; CALL.msg = msg || ''; CALL.muted = false; poke();
  }
  function attach(c) {
    CALL.call = c;
    c.on('stream', function (rs) {
      if (!CALL.vid) { const v = document.createElement('video'); v.playsInline = true; v.autoplay = true; v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;'; document.body.appendChild(v); CALL.vid = v; }
      CALL.vid.srcObject = rs; CALL.vid.play().catch(function () {}); CALL.state = 'incall'; CALL.msg = ''; poke();
    });
    c.on('close', function () { endCall('Call ended'); }); c.on('error', function () { endCall('The call dropped'); });
  }
  async function host() {
    try {
      CALL.state = 'hosting'; CALL.msg = 'Starting…'; poke(); await getLocal();
      CALL.code = String(Math.floor(100000 + Math.random() * 900000)); const P = new window.Peer('orbitos-' + CALL.code); CALL.peer = P;
      P.on('open', function () { CALL.msg = 'Tell your friend this code and wait'; poke(); });
      P.on('call', function (c) { c.answer(CALL.local); attach(c); });
      P.on('error', function (e) { endCall('Call error: ' + (e.type || e.message)); });
    } catch (e) { endCall(String(e.message || e)); }
  }
  async function join() {
    try {
      CALL.state = 'connecting'; CALL.msg = 'Connecting…'; poke(); await getLocal();
      const P = new window.Peer(); CALL.peer = P;
      P.on('open', function () { attach(P.call('orbitos-' + CALL.input, CALL.local)); });
      P.on('error', function (e) { endCall(e.type === 'peer-unavailable' ? 'No call with that code' : 'Call error: ' + (e.type || e.message)); });
      setTimeout(function () { if (CALL.state === 'connecting') endCall('Nobody answered'); }, 25000);
    } catch (e) { endCall(String(e.message || e)); }
  }
  reg({
    id: 'call', title: 'Orbit Call', w: 1000, h: 780, animated: true,
    create(win) { CALL.win = win; win.state = {}; },
    draw(ui, win) {
      CALL.win = win; const c = ui.c, W = win.w, H = win.h, cx = W / 2;
      if (CALL.state === 'incall') {
        const v = CALL.vid, vx = 36, vy = 36, vw = W - 72, vh = H - 190;
        c.save(); rr(c, vx, vy, vw, vh, 36); c.clip(); c.fillStyle = '#0b0e18'; c.fillRect(vx, vy, vw, vh);
        if (v && v.videoWidth > 0 && v.readyState >= 2) { const s = Math.max(vw / v.videoWidth, vh / v.videoHeight), dw = v.videoWidth * s, dh = v.videoHeight * s; c.drawImage(v, vx + (vw - dw) / 2, vy + (vh - dh) / 2, dw, dh); }
        else { ui.text('Connected', cx, vy + vh / 2 - 16, { size: 44, align: 'center', weight: 700 }); ui.text('No video from the other side, audio only', cx, vy + vh / 2 + 34, { size: 24, align: 'center', color: WHITE2 }); }
        c.restore();
        if (SOS.camCv && SOS.camCv._ok) { const sw = 250, sh = 150, sx = vx + vw - sw - 20, sy = vy + vh - sh - 20; c.save(); rr(c, sx, sy, sw, sh, 24); c.clip(); c.drawImage(SOS.camCv, sx, sy, sw, sh); c.restore(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; rr(c, sx, sy, sw, sh, 24); c.stroke(); }
        ui.btn('mute', cx - 250, H - 130, 230, 76, { label: CALL.muted ? 'Unmute' : 'Mute', size: 28, r: 38, fill: CALL.muted ? '#ff9f0a' : 'rgba(255,255,255,.14)', onClick: function () { CALL.muted = !CALL.muted; if (CALL.local) CALL.local.getAudioTracks().forEach(function (t) { t.enabled = !CALL.muted; }); win.dirty = true; } });
        ui.btn('end', cx + 20, H - 130, 230, 76, { label: 'End call', size: 28, r: 38, fill: '#ff453a', hoverFill: '#ff6a60', onClick: function () { endCall('Call ended'); } });
        return;
      }
      ui.text('Orbit Call', cx, 90, { size: 56, align: 'center', weight: 800 });
      ui.text('Video call anyone with a 6 digit code', cx, 142, { size: 24, align: 'center', color: WHITE2 });
      if (CALL.state === 'idle') {
        ui.btn('start', cx - 240, 230, 480, 100, { label: 'Start a call', size: 34, r: 50, fill: '#22b8a0', hoverFill: '#34d1b8', onClick: host });
        ui.btn('joinb', cx - 240, 360, 480, 100, { label: 'Join with a code', size: 34, r: 50, onClick: function () { CALL.state = 'joining'; CALL.input = ''; win.dirty = true; } });
        if (CALL.msg) ui.text(CALL.msg, cx, 530, { size: 26, align: 'center', color: '#ffd60a' });
        ui.text('Uses your passthrough camera and the microphone', cx, H - 60, { size: 20, align: 'center', color: 'rgba(255,255,255,.4)' });
      } else if (CALL.state === 'hosting' || CALL.state === 'connecting') {
        if (CALL.state === 'hosting' && CALL.code) { ui.text(CALL.code.slice(0, 3) + ' ' + CALL.code.slice(3), cx, 300, { size: 130, align: 'center', weight: 700 }); }
        else ui.text('…', cx, 300, { size: 130, align: 'center', weight: 700 });
        ui.text(CALL.msg, cx, 420, { size: 28, align: 'center', color: WHITE2 });
        ui.btn('cancel', cx - 150, 520, 300, 80, { label: 'Cancel', size: 28, r: 40, onClick: function () { endCall(''); } });
      } else if (CALL.state === 'joining') {
        const disp = CALL.input.padEnd(6, '–').split('').join(' '); ui.text(disp, cx, 230, { size: 84, align: 'center', weight: 700 });
        const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'Call'];
        keys.forEach(function (k, i) {
          const kx = cx - 270 + (i % 3) * 190, ky = 300 + Math.floor(i / 3) * 106, go = k === 'Call', ok = CALL.input.length === 6;
          ui.btn('k' + k, kx, ky, 170, 92, { label: k, size: go ? 30 : 42, r: 46, fill: go ? (ok ? '#22b8a0' : 'rgba(255,255,255,.06)') : 'rgba(255,255,255,.12)', onClick: function () { if (k === '⌫') CALL.input = CALL.input.slice(0, -1); else if (go) { if (ok) join(); } else if (CALL.input.length < 6) CALL.input += k; win.dirty = true; } });
        });
        ui.btn('back', 36, 36, 130, 56, { label: 'Back', size: 24, r: 28, onClick: function () { CALL.state = 'idle'; win.dirty = true; } });
      }
    }
  });

  /* ---------- Calendar ---------- */
  reg({
    id: 'calendar', title: 'Calendar', w: 920, h: 860,
    create(win) { const d = new Date(); win.state = { y: d.getFullYear(), m: d.getMonth(), sel: d.getDate() }; },
    draw(ui, win) {
      const c = ui.c, st = win.state, W = win.w, now = new Date(), first = new Date(st.y, st.m, 1), days = new Date(st.y, st.m + 1, 0).getDate(), off = (first.getDay() + 6) % 7;
      ui.text(first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), 48, 70, { size: 46, weight: 800 });
      const go = function (d) { st.m += d; if (st.m < 0) { st.m = 11; st.y--; } if (st.m > 11) { st.m = 0; st.y++; } st.sel = 1; win.dirty = true; };
      ui.btn('prev', W - 300, 38, 100, 64, { label: '‹', size: 40, r: 32, onClick: function () { go(-1); } }); ui.btn('next', W - 184, 38, 100, 64, { label: '›', size: 40, r: 32, onClick: function () { go(1); } });
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d, i) { ui.text(d, 48 + i * 118 + 55, 150, { size: 22, align: 'center', color: i > 4 ? '#ff6b6b' : WHITE2, weight: 600 }); });
      for (let d = 1; d <= days; d++) {
        const i = off + d - 1, x = 48 + (i % 7) * 118, y = 190 + Math.floor(i / 7) * 96, id = 'd' + d, sel = st.sel === d, today = d === now.getDate() && st.m === now.getMonth() && st.y === now.getFullYear(), hv = ui.hover(id);
        ui.hit(id, x, y, 110, 88, { onClick: function () { st.sel = d; win.dirty = true; } });
        ui.rect(x + 4, y + 4, 102, 80, 28, sel ? 'rgba(10,132,255,.9)' : hv ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.06)', today && !sel ? '#ff453a' : null, 3);
        ui.text(String(d), x + 55, y + 44, { size: 34, align: 'center', weight: today ? 800 : 500 });
      }
      ui.text(new Date(st.y, st.m, st.sel).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), 48, win.h - 60, { size: 30, weight: 600 });
    }
  });

  /* ---------- Reminders ---------- */
  let REM = []; try { REM = JSON.parse(localStorage.getItem('sos.rem') || '[]'); } catch (e) {} if (!Array.isArray(REM)) REM = [];
  const remSave = function () { try { localStorage.setItem('sos.rem', JSON.stringify(REM)); } catch (e) {} };
  reg({
    id: 'reminders', title: 'Reminders', w: 860, h: 820,
    create(win) { win.state = { text: '' }; },
    onKey(win, k) { let t = win.state.text; if (k === 'Backspace') t = t.slice(0, -1); else if (k === 'Enter') { if (t.trim()) { REM.unshift({ t: t.trim(), d: false }); remSave(); } t = ''; } else if (t.length < 80 && k.length === 1) t += k; win.state.text = t; win.dirty = true; },
    tick(win) { if (SOS.kbFor === win) { const b = Math.floor(SOS.t * 2) % 2; if (b !== win._b) { win._b = b; win.dirty = true; } } },
    draw(ui, win) {
      const c = ui.c, st = win.state, W = win.w, kb = SOS.kbFor === win;
      ui.text('Reminders', 48, 62, { size: 44, weight: 800 });
      ui.rect(40, 110, W - 80, 76, 38, 'rgba(255,255,255,' + (ui.hover('add') ? '.16' : '.09') + ')', kb ? '#0a84ff' : null, 3);
      ui.hit('add', 40, 110, W - 80, 76, { onClick: function () { if (SOS.kbFor !== win) SOS.showKeyboard(win); win.dirty = true; } });
      ui.text(st.text || 'Tap to add a reminder…', 76, 149, { size: 30, color: st.text ? '#fff' : 'rgba(255,255,255,.4)', maxW: W - 160 });
      if (kb && Math.floor(SOS.t * 2) % 2 === 0) { c.save(); c.font = '500 30px ' + FONT; const tw = Math.min(c.measureText(st.text).width, W - 160); c.restore(); ui.rect(78 + tw, 128, 3, 42, 1, '#0a84ff'); }
      ui.scroll(0, 210, W, win.h - 230, REM.length * 92 + 20, function () {
        REM.forEach(function (r, i) {
          const y = 214 + i * 92, id = 'r' + i;
          ui.hit(id, 40, y, W - 80, 80, { onClick: function () { r.d = !r.d; remSave(); win.dirty = true; } });
          ui.rect(40, y, W - 80, 80, 28, ui.hover(id) ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.07)');
          c.save(); c.strokeStyle = r.d ? '#30d158' : 'rgba(255,255,255,.5)'; c.fillStyle = '#30d158'; c.lineWidth = 4; c.beginPath(); c.arc(86, y + 40, 20, 0, 7); if (r.d) c.fill(); c.stroke(); c.restore();
          ui.text(r.t, 126, y + 41, { size: 30, color: r.d ? 'rgba(255,255,255,.4)' : '#fff', maxW: W - 280 });
          ui.btn('x' + i, W - 150, y + 14, 90, 52, { label: '✕', size: 24, r: 26, onClick: function () { REM.splice(i, 1); remSave(); win.dirty = true; } });
        });
      });
      if (!REM.length) ui.text('Nothing to do. Enjoy the quiet.', W / 2, 340, { size: 28, align: 'center', color: WHITE2 });
    }
  });

  /* ---------- Tips ---------- */
  const TIPS = [['Tap', 'Tap the screen to click what your gaze dot is on.'], ['Hold on a window', 'Press and hold on an app, then turn your head to carry it. Lift your finger to drop it.'], ['Hold on a menu', 'On a scrolling or paged menu, hold and move your head to drag it. Sideways on Home flips pages.'], ['Open Home', 'Hold your finger on empty space for about a second, or show an open palm to the camera.'], ['Hand tracking', 'Pinch thumb and index to click. Pinch a free spot on a window to carry it. Two hands pinching resize it.'], ['Passthrough', 'Turn the camera on in Settings to see the room behind your apps.'], ['Orbit Call', 'Start a call, share the 6 digit code, and your friend joins from Orbit Call on their phone.'], ['Orbit Store', 'Get more apps, games and web apps like YouTube and Zoom. Everything opens right here.']];
  reg({
    id: 'tips', title: 'Tips', w: 880, h: 820,
    create(win) { win.state = {}; },
    draw(ui, win) {
      const W = win.w; ui.text('Tips', 48, 62, { size: 44, weight: 800 });
      ui.scroll(0, 110, W, win.h - 130, TIPS.length * 150 + 20, function () {
        TIPS.forEach(function (t, i) { const y = 116 + i * 150; ui.rect(40, y, W - 80, 134, 30, 'rgba(255,255,255,.07)'); ui.text(t[0], 76, y + 38, { size: 30, weight: 700 }); ui.text(t[1], 76, y + 88, { size: 22, color: WHITE2, maxW: W - 150 }); });
      });
    }
  });

  /* ---------- Orbit Store ---------- */
  const CATS = ['Discover', 'Watch', 'Work', 'Social', 'Games', 'Create', 'Tools'], ROW = 118;
  const HERO = [['call', 'Orbit Call', 'Video calls in your room', '#14b8a6', '#2563eb'], ['w_yt', 'YouTube', 'A giant screen for everything', '#ef4444', '#7f1d1d'], ['g2048', '2048', 'Slide, merge, relax', '#f59e0b', '#b45309']];
  function getBtn(ui, win, id, x, y, w, h) {
    const st = win.state, inst = SOS.isInstalled(id);
    if (st.dl[id] != null) { const p = clamp((SOS.t - st.dl[id]) / 1.4, 0, 1); ui.rect(x, y, w, h, h / 2, 'rgba(255,255,255,.14)'); ui.rect(x, y, Math.max(h, w * p), h, h / 2, '#0a84ff'); ui.text('Getting…', x + w / 2, y + h / 2 + 1, { size: 20, align: 'center', weight: 600 }); return; }
    ui.btn('g_' + id, x, y, w, h, { label: inst ? 'Open' : 'Get', size: 22, r: h / 2, fill: inst ? 'rgba(255,255,255,.16)' : '#0a84ff', hoverFill: inst ? 'rgba(255,255,255,.28)' : '#2b95ff', onClick: function () { if (SOS.isInstalled(id)) SOS.open(id); else { st.dl[id] = SOS.t; win.dirty = true; } } });
  }
  reg({
    id: 'store', title: 'Orbit Store', w: 1240, h: 860,
    create(win) { win.state = { dl: {}, cat: 'Discover' }; },
    tick(win) { const st = win.state; let any = false; for (const k in st.dl) { any = true; if (SOS.t - st.dl[k] > 1.4) { delete st.dl[k]; SOS.installApp(k); SOS.toast((LABELS[k] || k) + ' is ready. Find it on Home.', 3); } } if (any) win.dirty = true; },
    draw(ui, win) {
      const c = ui.c, st = win.state, W = win.w, px = 56, cat = st.cat, disc = cat === 'Discover';
      ui.text('Orbit Store', px, 62, { size: 46, weight: 800 });
      ui.text(SOS.CATALOG.filter(function (a) { return SOS.isInstalled(a[0]); }).length + ' of ' + SOS.CATALOG.length + ' installed', W - px, 62, { size: 22, align: 'right', color: WHITE2 });
      let x = px; CATS.forEach(function (k) { const w = ui.measure(k, 24, 600) + 46, on = cat === k; ui.btn('c_' + k, x, 106, w, 54, { label: k, size: 24, r: 27, fill: on ? '#fff' : 'rgba(255,255,255,.10)', hoverFill: on ? '#fff' : 'rgba(255,255,255,.22)', color: on ? '#0b0f1c' : '#fff', onClick: function () { st.cat = k; win.scrollY = 0; win.dirty = true; } }); x += w + 12; });
      const list = disc ? SOS.CATALOG.slice() : SOS.CATALOG.filter(function (a) { return a[3] === cat; });
      const heroH = disc ? 420 : 0, colW = (W - px * 2 - 30) / 2, rows = Math.ceil(list.length / 2);
      ui.scroll(0, 184, W, win.h - 184, heroH + rows * ROW + 40, function () {
        let y = 196;
        if (disc) {
          const cw = (W - px * 2 - 48) / 3;
          HERO.forEach(function (h, i) {
            const hx = px + i * (cw + 24); c.save(); rr(c, hx, y, cw, 330, 40); c.clip(); const g = c.createLinearGradient(hx, y, hx + cw, y + 330); g.addColorStop(0, h[3]); g.addColorStop(1, h[4]); c.fillStyle = g; c.fillRect(hx, y, cw, 330);
            const rg = c.createRadialGradient(hx + cw * 0.8, y + 40, 0, hx + cw * 0.8, y + 40, 260); rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(hx, y, cw, 330); c.restore();
            if (ICONS[h[0]]) ICONS[h[0]](c, hx + 70, y + 74, 40);
            ui.text(h[1], hx + 30, y + 190, { size: 36, weight: 800, maxW: cw - 50 }); ui.text(h[2], hx + 30, y + 232, { size: 21, color: 'rgba(255,255,255,.85)', maxW: cw - 50 });
            getBtn(ui, win, h[0], hx + 30, y + 262, 130, 50);
          });
          ui.text('All apps', px, y + 372, { size: 32, weight: 700 }); y += 410;
        }
        list.forEach(function (a, i) {
          const rx = px + (i % 2) * (colW + 30), ry = y + Math.floor(i / 2) * ROW, id = a[0];
          ui.rect(rx, ry, colW, ROW - 16, 30, 'rgba(255,255,255,.07)');
          if (ICONS[id]) ICONS[id](c, rx + 64, ry + (ROW - 16) / 2, 38);
          ui.text(a[1], rx + 124, ry + 36, { size: 28, weight: 700, maxW: colW - 300 }); ui.text(a[2], rx + 124, ry + 70, { size: 20, color: WHITE2, maxW: colW - 300 });
          getBtn(ui, win, id, rx + colW - 148, ry + 22, 120, 50);
        });
      });
    }
  });
  // first run of this version: put the new everyday apps on Home
  try { if (!localStorage.getItem('sos.seed5')) { ['call', 'calendar', 'reminders', 'tips'].forEach(function (id) { SOS.installApp(id); }); localStorage.setItem('sos.seed5', '1'); } } catch (e) {}
  if (SOS.wins.home) SOS.wins.home.dirty = true;
})();
