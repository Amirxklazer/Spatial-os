'use strict';
/* SpatialOS 2.1 — Spiral: a real 3D orb you can grab and throw, powered by Google Gemini.
   "Hey Spiral" wake word, spoken answers, saved conversations, one-time API key setup. */
(function () {
  const SOS = window.SOS, T = window.THREE, U = SOS.util, FONT = SOS.FONT, reg = SOS.registerApp, ICONS = SOS.ICONS, S = SOS.settings;
  const clamp = U.clamp, rr = U.rr, WHITE2 = 'rgba(255,255,255,.62)';
  const NB = function () { return window.NativeBridge || null; };
  const lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

  /* ---------- icon ---------- */
  ICONS.spiral = ICONS.chat = function (c, x, y, r) {
    c.save(); let g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, '#9fb8ff'); g.addColorStop(0.55, '#4b4fe0'); g.addColorStop(1, '#14143a');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let a = 0; a < 3; a++) { c.beginPath(); for (let i = 0; i <= 30; i++) { const k = i / 30, ang = a * 2.094 + k * 5, rad = r * (0.06 + 0.72 * k); const px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad; if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.strokeStyle = 'hsla(' + (200 + a * 60) + ',95%,70%,.85)'; c.lineWidth = r * 0.12; c.stroke(); }
    c.globalCompositeOperation = 'source-over'; g = c.createRadialGradient(x - r * 0.38, y - r * 0.45, 0, x - r * 0.38, y - r * 0.45, r * 0.55); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  };
  Object.assign(SOS.LABELS, { spiral: 'Spiral', chat: 'Spiral', gsetup: 'Spiral setup' });

  /* ---------- conversations (saved on the device) ---------- */
  let chats = []; try { chats = JSON.parse(lsGet('sos.chats') || '[]'); } catch (e) { chats = []; } if (!Array.isArray(chats)) chats = [];
  let curId = lsGet('sos.chat.cur') || '';
  const saveChats = function () { if (chats.length > 40) chats.length = 40; lsSet('sos.chats', JSON.stringify(chats)); lsSet('sos.chat.cur', curId); if (SOS.wins.chat) SOS.wins.chat.dirty = true; };
  const cur = function () { return chats.find(function (c) { return c.id === curId; }); };
  const newChat = function () { const c = { id: 'c' + Date.now().toString(36), title: 'New chat', t: Date.now(), msgs: [] }; chats.unshift(c); curId = c.id; saveChats(); return c; };
  SOS.clearChats = function () { chats = []; curId = ''; saveChats(); };
  const addMsg = function (r, text) { let c = cur(); if (!c) c = newChat(); c.msgs.push({ r: r, t: text }); if (c.msgs.length > 80) c.msgs.splice(0, c.msgs.length - 80); if (r === 'u' && c.msgs.filter(function (m) { return m.r === 'u'; }).length === 1) c.title = text.slice(0, 40); c.t = Date.now(); chats.sort(function (a, b) { return b.t - a.t; }); saveChats(); return c; };
  SOS.chats = function () { return chats; };

  /* ---------- Gemini ---------- */
  const getKey = function () { return lsGet('sos.gkey') || ''; };
  const pending = {}; let netId = 0;
  SOS.onNetRes = function (id, status, body) { const p = pending[id]; if (!p) return; delete pending[id]; p.res({ status: status, body: body }); };
  function post(url, headers, body) {
    return new Promise(function (res, rej) {
      const nb = NB();
      if (nb && typeof nb.netPost === 'function') {
        const id = ++netId; pending[id] = { res: res, rej: rej };
        try { nb.netPost(id, url, JSON.stringify(headers), body); } catch (e) { delete pending[id]; rej(e); return; }
        setTimeout(function () { if (pending[id]) { delete pending[id]; rej(new Error('timeout')); } }, 40000);
      } else fetch(url, { method: 'POST', headers: headers, body: body }).then(function (r) { return r.text().then(function (t) { res({ status: r.status, body: t }); }); }).catch(rej);
    });
  }
  const SYS = 'You are Spiral, a friendly voice assistant that lives inside SpatialOS, a spatial computing OS on an Android phone worn in a cardboard headset. ' +
    'Your answers are spoken aloud, so keep them short (one to three sentences), plain text, no markdown, no emoji. Reply in the language the user speaks. ' +
    'You can control the OS by adding tags on their own at the very end of your reply, only when the user asks for it: ' +
    '[[open:APP]] with APP one of browser, camera, gallery, store, settings, notes, music, sketch, calc, clock, timer, convert, compass, breathe, snake, pong, memory, g2048, dice, ttt; ' +
    '[[web:URL or search words]] opens a new browser window (for example a recipe video on the wall: [[web:https://www.youtube.com/results?search_query=easy+pasta+recipe]]); ' +
    '[[theme:liquid|aurora|sunset|mint|midnight|graphite]]; [[env:night|sunset|studio|passthrough]]; [[recenter]].';
  async function askGemini(conv) {
    const key = getKey(), model = S.gmodel || 'gemini-flash-latest';
    const contents = conv.msgs.slice(-16).map(function (m) { return { role: m.r === 'u' ? 'user' : 'model', parts: [{ text: m.t }] }; });
    while (contents.length && contents[0].role !== 'user') contents.shift();
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: SYS + ' The time is ' + new Date().toLocaleString() + '.' }] }, contents: contents, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } });
    const r = await post('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body);
    let j = {}; try { j = JSON.parse(r.body); } catch (e) {}
    if (r.status === 400 && /API key/i.test(JSON.stringify(j))) { const e = new Error('badkey'); e.code = 'badkey'; throw e; }
    if (r.status === 401 || r.status === 403) { const e = new Error('badkey'); e.code = 'badkey'; throw e; }
    if (r.status === 429) { const e = new Error('Gemini is busy. Try again in a minute.'); throw e; }
    if (r.status === 404) throw new Error('Model "' + model + '" was not found.');
    if (r.status < 200 || r.status >= 300) throw new Error((j.error && j.error.message) || ('Gemini error ' + r.status));
    const cand = j.candidates && j.candidates[0], parts = cand && cand.content && cand.content.parts;
    const text = parts ? parts.map(function (p) { return p.text || ''; }).join('').trim() : '';
    if (!text) throw new Error('Gemini sent no answer.');
    return text;
  }
  function runTags(text) {
    const tags = []; const clean = text.replace(/\[\[([a-z]+)(?::([^\]]*))?\]\]/gi, function (m, k, v) { tags.push([k.toLowerCase(), (v || '').trim()]); return ''; }).trim();
    tags.forEach(function (t, i) {
      setTimeout(function () {
        if (t[0] === 'open' && t[1]) SOS.runCommand('open ' + t[1]);
        else if (t[0] === 'web') { if (SOS.openBrowser) SOS.openBrowser(t[1]); else SOS.runCommand('search ' + t[1]); }
        else if (t[0] === 'theme' && SOS.THEMES[t[1]]) { S.theme = t[1]; SOS.save(); SOS.redrawAll(); }
        else if (t[0] === 'env' && ['night', 'sunset', 'studio', 'passthrough'].indexOf(t[1]) >= 0) { if (t[1] === 'passthrough' && SOS.camState !== 'on') SOS.enableCamera(); else SOS.setEnv(t[1]); }
        else if (t[0] === 'recenter') SOS.recenterAll();
      }, 350 + i * 500);
    });
    return clean;
  }
  SOS.spiralBusy = false; SOS.spiralSpeaking = false;
  SOS.spiralAsk = async function (raw) {
    const text = String(raw || '').replace(/^(hey|hi|ok|okay)[, ]+spiral[,. ]*/i, '').trim(); if (!text) return;
    if (!getKey()) { SOS.pendingAsk = text; SOS.toast('Spiral needs a Gemini key first (one time).', 3); SOS.open('gsetup', { bring: true }); return; }
    const conv = addMsg('u', text); SOS.spiralBusy = true; if (SOS.wins.chat) SOS.wins.chat.state.stick = true;
    try {
      const out = runTags(await askGemini(conv)); addMsg('m', out || 'Done.');
      SOS.spiralBusy = false;
      if (SOS.wins.chat) SOS.wins.chat.state.stick = true;
      if (out) { SOS.speak(out); if (!SOS.wins.chat) SOS.toast(out.length > 150 ? out.slice(0, 147) + '…' : out, Math.min(9, 3 + out.length / 25)); }
    } catch (e) {
      SOS.spiralBusy = false;
      if (e.code === 'badkey') { lsSet('sos.gkey', ''); SOS.pendingAsk = text; SOS.toast('That Gemini key was rejected. Enter a new one.', 4); SOS.open('gsetup', { bring: true }); }
      else { const m = String(e.message || e); addMsg('m', 'Sorry — ' + (m === 'timeout' || /fetch|network/i.test(m) ? 'I could not reach Gemini. Check the internet.' : m)); SOS.toast('Spiral: ' + (m === 'timeout' ? 'no connection' : m), 4); }
    }
    if (SOS.wins.chat) SOS.wins.chat.dirty = true;
  };

  /* ---------- speech out / wake word ---------- */
  SOS.speak = function (t) { if (!S.speak) return; const nb = NB(); if (nb && nb.speak) { try { nb.speak(String(t).replace(/\s+/g, ' ').slice(0, 700)); SOS.spiralSpeaking = true; setTimeout(function () { SOS.spiralSpeaking = false; }, Math.min(30000, 1500 + t.length * 70)); } catch (e) {} } };
  SOS.stopSpeak = function () { const nb = NB(); SOS.spiralSpeaking = false; if (nb && nb.stopSpeak) try { nb.stopSpeak(); } catch (e) {} };
  SOS.setWake = async function (on) {
    const nb = NB(); S.wake = !!on; SOS.save(); if (!nb || !nb.startWake) { if (on) SOS.toast('Hey Spiral needs the Android app.', 3); return; }
    if (!on) { try { nb.stopWake(); } catch (e) {} return; }
    try {
      if (!nb.hasMicPermission()) { const ok = await new Promise(function (res) { SOS._micRes = res; nb.requestMicPermission(); setTimeout(function () { if (SOS._micRes === res) { SOS._micRes = null; res(false); } }, 60000); }); if (!ok) { S.wake = false; SOS.save(); SOS.toast('Microphone is blocked, so Hey Spiral is off.', 4); return; } }
      nb.startWake();
    } catch (e) {}
  };
  SOS.onWake = function (text) {
    const t = String(text || '').toLowerCase();
    const m = t.match(/\b(?:hey|hi|ok|okay|hay|a)?\s*(spiral|spirals|spiro|spy ?rel|sperrel)\b[,.! ]*(.*)$/);
    if (!m) return;
    SOS.tick(1800, 0.08, 0.1); wakeFlash = 1.2;
    const rest = (m[2] || '').trim();
    if (rest.length > 1) SOS.runCommand(rest); else { SOS.toast('Yes?', 1.2); setTimeout(function () { SOS.startVoice('command'); }, 250); }
  };
  SOS.pasteClipboard = function () { const nb = NB(); try { return nb && nb.clipboardText ? String(nb.clipboardText() || '') : ''; } catch (e) { return ''; } };

  /* ---------- the 3D orb ---------- */
  const R = 0.11;
  const orb = new T.Group(); orb.visible = false; SOS.world.add(orb);
  const vs = 'varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }';
  const fs = 'precision mediump float; uniform float t; uniform float listen; uniform float think; uniform float flash; varying vec3 vN; varying vec3 vP; varying vec3 vV;' +
    'void main(){ vec3 n = normalize(vN), v = normalize(vV); float nv = max(dot(n,v),0.0); float fr = pow(1.0-nv, 2.4);' +
    ' vec3 p = normalize(vP); float a = atan(p.z,p.x); float pol = acos(clamp(p.y,-1.0,1.0))/3.14159;' +
    ' float sp = sin(a*3.0 - pol*15.0 + t*(0.9 + listen*2.4 + think*4.5)); float arms = smoothstep(0.45,1.0,sp);' +
    ' float sp2 = sin(a*2.0 + pol*9.0 - t*0.7); float arms2 = smoothstep(0.7,1.0,sp2)*0.5;' +
    ' vec3 c1 = vec3(0.30,0.52,1.0), c2 = vec3(0.86,0.38,1.0), c3 = vec3(0.25,0.95,0.88);' +
    ' vec3 hue = mix(c1,c2,0.5+0.5*sin(a+t*0.6)); hue = mix(hue,c3,0.5+0.5*sin(pol*8.0-t*0.9));' +
    ' vec3 col = hue*(arms+arms2)*(0.55+0.9*pow(nv,1.4)) + hue*fr*0.95 + vec3(0.06,0.09,0.24)*(1.0-fr)*0.7 + vec3(0.6,0.75,1.0)*flash*0.35;' +
    ' vec3 L = normalize(vec3(-0.45,0.75,0.55)); float spec = pow(max(dot(reflect(-L,n),v),0.0),42.0); col += vec3(spec);' +
    ' float alpha = clamp(0.30 + fr*0.7 + (arms+arms2)*0.45 + spec + flash*0.2, 0.0, 1.0); gl_FragColor = vec4(col, alpha); }';
  const mat = new T.ShaderMaterial({ uniforms: { t: { value: 0 }, listen: { value: 0 }, think: { value: 0 }, flash: { value: 0 } }, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false });
  const body = new T.Mesh(new T.SphereGeometry(R, 40, 28), mat); orb.add(body);
  const coreM = new T.Mesh(new T.SphereGeometry(R * 0.17, 20, 14), new T.MeshBasicMaterial({ color: 0xbcd0ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false })); orb.add(coreM);
  function radialTex(a, b) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(cv); return t; }
  const halo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: radialTex('rgba(140,170,255,.55)', 'rgba(140,170,255,0)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); SOS.world.add(halo);
  const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,.55)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 1; shadow.visible = false; SOS.world.add(shadow);

  const O = { p: new T.Vector3(), v: new T.Vector3(), state: 'float', held: null, hold: 1.4, ctr: new T.Vector3(), floorY: -1.45, rest: 0, init: false, prev: new T.Vector3(), vs: new T.Vector3(), bounce: 0, gl: false };
  let wakeFlash = 0;
  const _a = new T.Vector3(), _b = new T.Vector3(), _hd = new T.Vector3();
  function homeSpot(out) { const hp = SOS.headYawPitch(); const yaw = hp.yaw + 0.5; return out.set(SOS.headPos.x - Math.sin(yaw) * 1.25, SOS.headPos.y - 0.3, SOS.headPos.z - Math.cos(yaw) * 1.25); }
  SOS.orbShow = function (on) { orb.visible = !!on; shadow.visible = !!on; halo.visible = !!on; if (on && !O.init) { O.init = true; homeSpot(O.p); O.ctr.copy(SOS.headPos); O.floorY = SOS.headPos.y - 1.45; } };
  SOS.orbHit = function (p) {
    if (!orb.visible) return -1;
    _a.copy(O.p).sub(SOS.headPos).sub(p.origin); const t = _a.dot(p.dir); if (t <= 0.05) return -1;
    const d2 = _a.lengthSq() - t * t, r = R * (p.isHand ? 1.8 : 1.3); return d2 < r * r ? t : -1;
  };
  SOS.orbClick = function () { SOS.tick(1600, 0.07, 0.08); if (SOS.spiralSpeaking) { SOS.stopSpeak(); return; } SOS.startVoice('command'); };
  SOS.orbDown = function (p) { O.held = p; O.state = 'held'; O.hold = clamp(_a.copy(O.p).sub(SOS.headPos).length(), 0.5, 3); O.vs.set(0, 0, 0); O.prev.copy(O.p); O.bounce = 0.6; SOS.tick(1800, 0.06, 0.07); };
  SOS.orbUp = function (p) {
    if (O.held !== p) return; O.held = null;
    const sp = O.vs.length(); if (sp > 9) O.vs.multiplyScalar(9 / sp);
    if (O.vs.length() > 0.7) { O.v.copy(O.vs).multiplyScalar(1.1); O.state = 'fly'; } else { O.v.set(0, 0, 0); O.state = 'fly'; }
    O.rest = 0; SOS.tick(1200, 0.05, 0.05);
  };
  SOS.hooks.push(function (dt) {
    if (!orb.visible) return;
    dt = Math.min(dt, 0.05); const t = SOS.t;
    if (O.state === 'held' && O.held) {
      _b.copy(O.held.dir).multiplyScalar(O.hold).add(SOS.headPos);
      O.prev.copy(O.p); O.p.lerp(_b, 1 - Math.exp(-26 * dt));
      _a.copy(O.p).sub(O.prev).multiplyScalar(1 / Math.max(dt, 0.004)); O.vs.lerp(_a, 0.35);
    } else if (O.state === 'fly') {
      O.v.y -= 6.8 * dt; O.v.multiplyScalar(1 - 0.12 * dt); O.p.addScaledVector(O.v, dt);
      const fl = O.floorY + R;
      if (O.p.y < fl) { O.p.y = fl; if (O.v.y < -0.9) { O.bounce = 1; SOS.tick(300 + Math.min(500, -O.v.y * 90), 0.05, 0.08); } O.v.y = -O.v.y * 0.68; O.v.x *= 0.9; O.v.z *= 0.9; if (Math.abs(O.v.y) < 0.6) O.v.y = 0; }
      const ce = O.floorY + 3.2; if (O.p.y > ce) { O.p.y = ce; O.v.y = -Math.abs(O.v.y) * 0.5; }
      _a.set(O.p.x - O.ctr.x, 0, O.p.z - O.ctr.z); const rad = _a.length();
      if (rad > 3.3) { _a.multiplyScalar(1 / rad); const vn = O.v.dot(_a); if (vn > 0) O.v.addScaledVector(_a, -1.7 * vn); O.p.x = O.ctr.x + _a.x * 3.3; O.p.z = O.ctr.z + _a.z * 3.3; SOS.tick(500, 0.04, 0.06); }
      if (O.p.y <= fl + 0.002 && O.v.lengthSq() < 0.2) { O.rest += dt; if (O.rest > 1.1) O.state = 'float'; } else O.rest = 0;
    } else {
      // floating: settle at a comfortable height, drift gently; when you have walked far away it glides to you
      const far = _a.copy(O.p).sub(SOS.headPos); const dh = Math.hypot(far.x, far.z);
      if (dh > 3.4) { homeSpot(_b); O.ctr.copy(SOS.headPos); } else { _b.copy(O.p); _b.y = Math.max(O.p.y, SOS.headPos.y - 0.7); _b.y += Math.sin(t * 1.1) * 0.012; }
      O.p.lerp(_b, 1 - Math.exp(-(dh > 3.4 ? 1.6 : 1.8) * dt));
    }
    // visuals
    const hpos = _hd.copy(O.p).sub(SOS.headPos);
    orb.position.copy(O.p); orb.rotation.y = t * 0.5; orb.rotation.x = Math.sin(t * 0.4) * 0.3;
    O.bounce = Math.max(0, O.bounce - dt * 3); const sq = 1 + Math.sin(O.bounce * 9) * 0.06 * O.bounce, lis = SOS.listening ? 1 : 0, thk = SOS.spiralBusy || SOS.voiceState === 'thinking' ? 1 : 0;
    const pulse = 1 + (lis ? 0.07 * Math.sin(t * 9) : 0) + (SOS.spiralSpeaking ? 0.05 * Math.sin(t * 13) : 0) + (O.held ? 0.08 : 0);
    orb.scale.set(pulse / sq, pulse * sq, pulse / sq);
    mat.uniforms.t.value = t; mat.uniforms.listen.value += (lis - mat.uniforms.listen.value) * 0.1; mat.uniforms.think.value += (thk - mat.uniforms.think.value) * 0.1;
    wakeFlash = Math.max(0, wakeFlash - dt); mat.uniforms.flash.value = wakeFlash;
    coreM.scale.setScalar(1 + 0.15 * Math.sin(t * 3) + (lis ? 0.2 * Math.sin(t * 10) : 0));
    // halo faces the head, soft shadow on the floor
    halo.position.copy(O.p); halo.scale.setScalar(R * (5 + (lis ? 1.2 : 0))); halo.quaternion.copy(SOS.headCam.quaternion); halo.visible = true;
    const hgt = Math.max(0, O.p.y - O.floorY - R); shadow.position.set(O.p.x, O.floorY + 0.01, O.p.z); shadow.scale.setScalar(R * (3.2 + hgt * 1.2)); shadow.material.opacity = clamp(0.8 - hgt * 0.35, 0.1, 0.8);
    // draw order: behind a window the orb is hidden by it, in front of every window it is drawn last
    _b.copy(hpos).normalize(); const wd = SOS.firstWinDist(_b), od = hpos.length(); const ro = wd < od ? 0 : 99990; body.renderOrder = ro; coreM.renderOrder = ro + 1; halo.renderOrder = ro - 1;
  });

  /* ---------- API key setup (one time) ---------- */
  reg({
    id: 'gsetup', title: 'Spiral setup', w: 980, h: 700, animated: false, dist: 2.2,
    create(win) { win.state = { key: '' }; },
    onKey(win, k) { const st = win.state; if (k === 'Backspace') st.key = st.key.slice(0, -1); else if (k === 'Enter') save(win); else if (k.length === 1) st.key += k; win.dirty = true; },
    tick(win) { if (SOS.kbFor === win) { const b = Math.floor(SOS.t * 2) % 2; if (b !== win._b) { win._b = b; win.dirty = true; } } },
    draw(ui, win) {
      const c = ui.c, st = win.state, has = !!getKey();
      ICONS.spiral(c, 96, 96, 46);
      ui.text('Meet Spiral', 170, 74, { size: 44, weight: 700 }); ui.text(has ? 'A key is saved. Paste a new one to replace it.' : 'Spiral thinks with Google Gemini. You only do this once.', 170, 124, { size: 25, color: WHITE2 });
      [['1', 'Open aistudio.google.com/apikey and sign in (free).'], ['2', 'Tap “Create API key” and copy it.'], ['3', 'Come back here and tap Paste.']].forEach(function (s, i) {
        const y = 210 + i * 76; ui.rect(48, y - 26, 52, 52, 26, 'rgba(255,255,255,.16)'); ui.text(s[0], 74, y + 1, { size: 28, weight: 700, align: 'center' }); ui.text(s[1], 124, y + 1, { size: 28 });
      });
      ui.btn('open', 640, 190, 290, 56, { label: 'Open the page', size: 24, r: 28, onClick: function () { if (SOS.openBrowser) SOS.openBrowser('https://aistudio.google.com/apikey'); else SOS.runCommand('search aistudio google api key'); } });
      const ky = 372, shown = st.key ? (st.key.length > 34 ? st.key.slice(0, 8) + '••••••••' + st.key.slice(-4) : st.key) : '', kb = SOS.kbFor === win;
      ui.rect(48, ky, win.w - 96, 76, 38, 'rgba(255,255,255,' + (ui.hover('field') ? '.16' : '.09') + ')', kb ? '#0a84ff' : null, 3);
      ui.hit('field', 48, ky, win.w - 96, 76, { onClick: function () { SOS.showKeyboard(win); win.dirty = true; } });
      ui.text(shown ? shown + (kb && Math.floor(SOS.t * 2) % 2 === 0 ? '|' : '') : 'Your key appears here', 84, ky + 39, { size: 28, color: shown ? '#fff' : 'rgba(255,255,255,.4)', maxW: win.w - 190 });
      ui.btn('paste', 48, 478, 250, 64, { label: 'Paste', size: 28, r: 32, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { const t = SOS.pasteClipboard().trim(); if (t) { st.key = t; SOS.toast('Pasted.', 1.4); } else SOS.toast('Clipboard is empty. Copy the key first.', 3); win.dirty = true; } });
      ui.btn('type', 316, 478, 250, 64, { label: 'Type it', size: 28, r: 32, onClick: function () { SOS.showKeyboard(win); win.dirty = true; } });
      ui.btn('save', win.w - 48 - 250, 478, 250, 64, { label: 'Save', size: 28, r: 32, fill: st.key.length > 20 ? '#30d158' : 'rgba(255,255,255,.1)', hoverFill: '#4be06f', onClick: function () { save(win); } });
      ui.text('Your key stays on this phone and is only sent to Google.', win.w / 2, 590, { size: 22, color: WHITE2, align: 'center' });
    }
  });
  function save(win) {
    const k = win.state.key.trim();
    if (k.length < 20 || /\s/.test(k)) { SOS.toast('That does not look like a Gemini key.', 3); return; }
    lsSet('sos.gkey', k); win.state.key = ''; SOS.hideKeyboard(); SOS.close('gsetup'); SOS.toast('Spiral is ready. Tap the orb or say “Hey Spiral”.', 4);
    if (SOS.pendingAsk) { const q = SOS.pendingAsk; SOS.pendingAsk = null; setTimeout(function () { SOS.spiralAsk(q); }, 800); }
  }

  /* ---------- chat window ---------- */
  function wrap(c, text, maxW) { const out = []; String(text).split('\n').forEach(function (para) { let line = ''; para.split(' ').forEach(function (w) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); out.push(line); }); return out; }
  reg({
    id: 'chat', title: 'Spiral', w: 1180, h: 760, animated: false, dist: 2.4,
    create(win) { win.state = { text: '', stick: true }; if (!cur() && chats.length) curId = chats[0].id; },
    onKey(win, k) { const st = win.state; if (k === 'Backspace') st.text = st.text.slice(0, -1); else if (k === 'Enter') { const t = st.text.trim(); if (t) { st.text = ''; SOS.spiralAsk(t); } } else if (st.text.length < 500) st.text += k; win.dirty = true; },
    tick(win) { if (SOS.kbFor === win || SOS.spiralBusy) { const b = Math.floor(SOS.t * 2) % 2; if (b !== win._b) { win._b = b; win.dirty = true; } } },
    draw(ui, win) {
      const c = ui.c, st = win.state, conv = cur(), kb = SOS.kbFor === win, LW = 300;
      ui.rect(0, 0, LW, win.h, 40, 'rgba(0,0,0,.18)');
      ui.text('Spiral', 40, 56, { size: 36, weight: 700 });
      ui.btn('new', LW - 120, 28, 88, 56, { label: '+', size: 36, r: 28, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { newChat(); st.stick = true; win.dirty = true; } });
      chats.slice(0, 7).forEach(function (ch, i) {
        const y = 110 + i * 88, on = ch.id === curId, id = 'c_' + ch.id;
        ui.hit(id, 16, y, LW - 32 - 52, 78, { onClick: function () { curId = ch.id; saveChats(); st.stick = true; win.dirty = true; } });
        ui.rect(16, y, LW - 32, 78, 24, on ? 'rgba(10,132,255,.45)' : ui.hover(id) ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)');
        ui.text(ch.title || 'New chat', 36, y + 28, { size: 24, weight: 600, maxW: LW - 130 });
        ui.text(ch.msgs.length + ' messages', 36, y + 58, { size: 19, color: WHITE2 });
        ui.btn('x_' + ch.id, LW - 16 - 54, y + 12, 46, 54, { label: '×', size: 30, r: 20, fill: 'rgba(255,255,255,0)', onClick: function () { chats = chats.filter(function (q) { return q !== ch; }); if (curId === ch.id) curId = chats[0] ? chats[0].id : ''; saveChats(); win.dirty = true; } });
      });
      if (!chats.length) ui.text('No chats yet', 40, 130, { size: 22, color: WHITE2 });
      // messages
      const mx = LW + 30, mw = win.w - LW - 60, my = 24, mh = win.h - 24 - 170;
      c.save(); c.font = '500 28px ' + FONT; const lines = [];
      const msgs = conv ? conv.msgs.slice() : []; if (SOS.spiralBusy) msgs.push({ r: 'm', t: '…', busy: true });
      let total = 12; const layout = msgs.map(function (m) { const ls = wrap(c, m.t, mw * 0.72 - 48), bh = ls.length * 38 + 30, o = { m: m, ls: ls, y: total, h: bh }; total += bh + 16; return o; }); c.restore();
      if (!msgs.length) { ICONS.spiral(c, mx + mw / 2, my + mh / 2 - 40, 64); ui.text(getKey() ? 'Ask me anything. Tap the mic or say “Hey Spiral”.' : 'Tap the orb or the mic to set Spiral up.', mx + mw / 2, my + mh / 2 + 60, { size: 26, align: 'center', color: WHITE2 }); }
      ui.scroll(mx, my, mw, mh, total + 8, function () {
        layout.forEach(function (o) {
          const user = o.m.r === 'u', bw = Math.min(mw * 0.72, Math.max.apply(null, o.ls.map(function (l) { c.save(); c.font = '500 28px ' + FONT; const w = c.measureText(l).width; c.restore(); return w; })) + 48), x = user ? mx + mw - bw - 8 : mx + 8, y = my + o.y;
          ui.rect(x, y, bw, o.h, 28, user ? '#0a84ff' : 'rgba(255,255,255,.14)');
          o.ls.forEach(function (l, i) { ui.text(o.m.busy ? '.'.repeat(1 + Math.floor(SOS.t * 3) % 3) : l, x + 24, y + 15 + 19 + i * 38, { size: 28 }); });
        });
      });
      if (st.stick) { win.scrollY = win.maxScroll; st.stick = false; }
      // input row
      const iy = win.h - 130;
      ui.rect(mx, iy, mw - 230, 78, 39, 'rgba(255,255,255,' + (ui.hover('inp') ? '.16' : '.09') + ')', kb ? '#0a84ff' : null, 3);
      ui.hit('inp', mx, iy, mw - 230, 78, { onClick: function () { SOS.showKeyboard(win); win.dirty = true; } });
      const tx = st.text.length > 38 ? '…' + st.text.slice(-37) : st.text;
      ui.text(tx ? tx + (kb && Math.floor(SOS.t * 2) % 2 === 0 ? '|' : '') : 'Message Spiral', mx + 32, iy + 40, { size: 28, color: tx ? '#fff' : 'rgba(255,255,255,.4)' });
      ui.btn('mic', mx + mw - 214, iy, 90, 78, { r: 39, fill: SOS.listening ? '#ff453a' : 'rgba(255,255,255,.12)', onClick: function () { SOS.voiceAfter = function (t) { SOS.spiralAsk(t); }; SOS.startVoice('command'); }, draw: function (cc, x, y, w, h) { cc.save(); cc.fillStyle = '#fff'; cc.strokeStyle = '#fff'; cc.lineWidth = 4; cc.lineCap = 'round'; const mx2 = x + w / 2, my2 = y + h / 2; rr(cc, mx2 - 8, my2 - 22, 16, 30, 8); cc.fill(); cc.beginPath(); cc.arc(mx2, my2 - 4, 18, 0.15 * Math.PI, 0.85 * Math.PI); cc.stroke(); cc.beginPath(); cc.moveTo(mx2, my2 + 14); cc.lineTo(mx2, my2 + 24); cc.stroke(); cc.restore(); } });
      ui.btn('send', mx + mw - 112, iy, 112, 78, { label: 'Send', size: 26, r: 39, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { const t = st.text.trim(); if (t) { st.text = ''; SOS.spiralAsk(t); } else SOS.showKeyboard(win); win.dirty = true; } });
    }
  });
})();
