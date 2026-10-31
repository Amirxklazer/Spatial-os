'use strict';
/* SpatialOS core: stereo renderer, lens distortion, camera passthrough, window manager, pointers */
(function () {
  const T = THREE;
  const SOS = (window.SOS = { apps: {}, wins: {}, hands: [], env: 'passthrough', videoReady: false, video: null, t: 0, fps: 60, zc: 1, vidAspect: 16 / 9, yawRaw: 0, pitchRaw: 0 });

  /* ---------- settings ---------- */
  const DEF = { ipd: 63, fov: 82, distortion: true, lens: 0.5, resScale: 0.9, divider: true, winScale: 1, bright: 1, hands: true, magnet: true, magnetT: 45, dwell: false, dwellT: 1.4, handCursor: false, volume: 0.7, sound: true, env: 'passthrough' };
  SOS.settings = Object.assign({}, DEF);
  try { Object.assign(SOS.settings, JSON.parse(localStorage.getItem('sos.settings') || '{}')); } catch (e) {}
  SOS.save = function () { try { localStorage.setItem('sos.settings', JSON.stringify(SOS.settings)); } catch (e) {} };
  SOS.resetSettings = function () { Object.assign(SOS.settings, DEF); SOS.save(); SOS.applySettings(); };

  /* ---------- utils ---------- */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  SOS.util = { clamp, lerp, ease, rr };
  const FONT = '"Inter","SF Pro Display",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  SOS.FONT = FONT;

  /* ---------- audio ---------- */
  let actx = null;
  SOS.audio = function () {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume().catch(function () {});
    return actx;
  };
  SOS.tick = function (f, d, v) {
    if (!SOS.settings.sound) return;
    const a = SOS.audio(); if (!a) return;
    f = f || 1500; d = d || 0.05; v = v == null ? 0.05 : v;
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, a.currentTime); o.frequency.exponentialRampToValueAtTime(f * 0.7, a.currentTime + d);
    g.gain.setValueAtTime(v * SOS.settings.volume, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + d + 0.02);
  };

  /* ---------- renderer ---------- */
  const canvas = document.getElementById('gl');
  const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.autoClear = false; renderer.setPixelRatio(1); renderer.setClearColor(0x000000, 1);
  const scene = new T.Scene(), bgScene = new T.Scene(), bgCam = new T.Camera(), distScene = new T.Scene(), distCam = new T.Camera();
  const eyeCams = [new T.PerspectiveCamera(80, 1, 0.05, 120), new T.PerspectiveCamera(80, 1, 0.05, 120)];
  const headCam = new T.PerspectiveCamera(80, 1, 0.05, 120);
  SOS.scene = scene; SOS.headCam = headCam;

  const bgMat = new T.ShaderMaterial({
    uniforms: { map: { value: null }, uvS: { value: new T.Vector2(1, 1) }, bright: { value: 1 }, has: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: 'uniform sampler2D map; uniform vec2 uvS; uniform float bright; uniform float has; varying vec2 vUv;' +
      'void main(){ vec2 uv=(vUv-0.5)*uvS+0.5; vec3 c = has>0.5 ? texture2D(map,uv).rgb*bright : mix(vec3(.05,.06,.09),vec3(.16,.18,.26),vUv.y); gl_FragColor=vec4(c,1.); }',
    depthTest: false, depthWrite: false
  });
  const bgMesh = new T.Mesh(new T.PlaneGeometry(2, 2), bgMat); bgMesh.frustumCulled = false; bgScene.add(bgMesh);

  const distMat = new T.ShaderMaterial({
    uniforms: { tex: { value: null }, k1: { value: 0.2 }, k2: { value: 0.1 }, asp: { value: 1.1 }, on: { value: 1 }, zoom: { value: 0.86 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: 'uniform sampler2D tex; uniform float k1,k2,asp,on,zoom; varying vec2 vUv;' +
      'void main(){ float eye=step(0.5,vUv.x); vec2 e=vec2(vUv.x*2.-eye, vUv.y); vec2 c=e*2.-1.; vec2 q=vec2(c.x*asp,c.y);' +
      ' float r2=dot(q,q)/(asp*asp+1.); float f= on>.5 ? (1.+k1*r2+k2*r2*r2)*zoom : 1.; q*=f; vec2 s=vec2(q.x/asp,q.y)*.5+.5;' +
      ' if(s.x<0.||s.x>1.||s.y<0.||s.y>1.){ gl_FragColor=vec4(0.,0.,0.,1.); return; } s.x=(s.x+eye)*.5; gl_FragColor=vec4(texture2D(tex,s).rgb,1.); }',
    depthTest: false, depthWrite: false
  });
  const distMesh = new T.Mesh(new T.PlaneGeometry(2, 2), distMat); distMesh.frustumCulled = false; distScene.add(distMesh);

  let W = 0, H = 0, rt = null, eyeAsp = 1;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = Math.max(64, Math.round(innerWidth * dpr)), ch = Math.max(64, Math.round(innerHeight * dpr));
    renderer.setSize(cw, ch, false);
    W = Math.max(64, Math.round(cw * SOS.settings.resScale)); H = Math.max(64, Math.round(ch * SOS.settings.resScale));
    if (rt) rt.dispose();
    rt = new T.WebGLRenderTarget(W, H, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat, depthBuffer: true, stencilBuffer: false });
    distMat.uniforms.tex.value = rt.texture;
    eyeAsp = (W / 2) / H;
    distMat.uniforms.asp.value = eyeAsp;
    SOS.eyeAsp = eyeAsp;
    applyCams();
  }
  function applyCams() {
    const s = SOS.settings;
    [eyeCams[0], eyeCams[1], headCam].forEach(function (c) { c.fov = s.fov; c.aspect = eyeAsp; c.updateProjectionMatrix(); });
    distMat.uniforms.on.value = s.distortion ? 1 : 0;
    distMat.uniforms.k1.value = 0.36 * s.lens; distMat.uniforms.k2.value = 0.18 * s.lens;
    distMat.uniforms.zoom.value = 1 / (1 + 0.5 * s.lens) * 1.05;
    bgMat.uniforms.bright.value = s.bright;
    const dv = document.getElementById('divider'); if (dv) dv.style.display = s.divider ? 'block' : 'none';
  }
  SOS.applySettings = function () { applyCams(); };
  SOS.setResScale = function () { resize(); };
  addEventListener('resize', resize);

  /* ---------- camera passthrough bg ---------- */
  let vtex = null;
  SOS.attachVideo = function (video) {
    SOS.video = video;
    vtex = new T.VideoTexture(video); vtex.minFilter = T.LinearFilter; vtex.magFilter = T.LinearFilter; vtex.generateMipmaps = false;
    bgMat.uniforms.map.value = vtex;
  };
  // camera uv (0..1, y down) -> eye-normalised coords (0..1, y down) given cover-fit
  SOS.camToEye = function (u, v) {
    const va = SOS.vidAspect, ea = eyeAsp;
    const sx = Math.min(1, ea / va), sy = Math.min(1, va / ea);
    return [(u - 0.5) / sx + 0.5, (v - 0.5) / sy + 0.5];
  };
  function updateBg() {
    const v = SOS.video;
    const ready = !!(v && vtex && v.readyState >= 2 && v.videoWidth > 0);
    SOS.videoReady = ready;
    if (ready) SOS.vidAspect = v.videoWidth / v.videoHeight;
    const va = SOS.vidAspect, ea = eyeAsp;
    bgMat.uniforms.uvS.value.set(Math.min(1, ea / va), Math.min(1, va / ea));
    bgMat.uniforms.has.value = ready ? 1 : 0;
  }

  /* ---------- environments (procedural) ---------- */
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function ridge(c, w, h, base, amp, seed, col, ks) {
    const r = mulberry(seed); const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const a = x / w * Math.PI * 2;
      const y = base - amp * (0.5 + 0.28 * Math.sin(a * ks[0] + ph[0]) + 0.17 * Math.sin(a * ks[1] + ph[1]) + 0.08 * Math.sin(a * ks[2] + ph[2]) + 0.04 * Math.sin(a * 41 + ph[3]));
      c.lineTo(x, y);
    }
    c.lineTo(w, h); c.closePath(); c.fillStyle = col; c.fill();
  }
  SOS.drawEnv = function (kind, cv) {
    const w = cv.width, h = cv.height, c = cv.getContext('2d'), hz = h * 0.5, fx = w * 0.75;
    c.clearRect(0, 0, w, h);
    if (kind === 'sunset') {
      const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#1b2658'); g.addColorStop(0.45, '#6a58a3'); g.addColorStop(0.8, '#ff9a63'); g.addColorStop(1, '#ffd8a2');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      const sg = c.createRadialGradient(fx, hz - h * 0.03, 0, fx, hz - h * 0.03, h * 0.32); sg.addColorStop(0, 'rgba(255,245,210,1)'); sg.addColorStop(0.15, 'rgba(255,200,130,.85)'); sg.addColorStop(1, 'rgba(255,150,90,0)');
      c.fillStyle = sg; c.fillRect(0, 0, w, h);
      const r = mulberry(7); c.save(); c.filter = 'blur(14px)';
      for (let i = 0; i < 46; i++) { const x = r() * w, y = hz - h * (0.06 + r() * 0.34), rw = 70 + r() * 220, rh = 8 + r() * 18; const a = 0.1 + r() * 0.3; c.fillStyle = 'rgba(' + (255 - r() * 40 | 0) + ',' + (210 - r() * 70 | 0) + ',' + (200 - r() * 40 | 0) + ',' + a + ')'; c.beginPath(); c.ellipse(x, y, rw, rh, 0, 0, 7); c.fill(); }
      c.restore();
      ridge(c, w, h, hz + h * 0.02, h * 0.12, 11, '#8a5f86', [5, 13, 23]);
      ridge(c, w, h, hz + h * 0.05, h * 0.1, 21, '#5b4577', [7, 17, 29]);
      ridge(c, w, h, hz + h * 0.09, h * 0.09, 33, '#352c54', [9, 19, 31]);
      ridge(c, w, h, hz + h * 0.14, h * 0.07, 45, '#1d1a38', [11, 23, 37]);
      const gg = c.createLinearGradient(0, hz + h * 0.1, 0, h); gg.addColorStop(0, 'rgba(20,18,45,0)'); gg.addColorStop(0.3, '#15132c'); gg.addColorStop(1, '#0b0a1a'); c.fillStyle = gg; c.fillRect(0, hz + h * 0.1, w, h);
    } else if (kind === 'night') {
      const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#02030a'); g.addColorStop(0.6, '#0b1233'); g.addColorStop(1, '#1d2d5e'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      const r = mulberry(3); for (let i = 0; i < 900; i++) { const x = r() * w, y = Math.pow(r(), 1.4) * hz * 0.98; const a = 0.25 + r() * 0.75; c.fillStyle = 'rgba(255,255,' + (220 + r() * 35 | 0) + ',' + a + ')'; const s = r() < 0.04 ? 2.6 : 1.3; c.fillRect(x, y, s, s); }
      const mg = c.createRadialGradient(fx, hz * 0.55, 0, fx, hz * 0.55, 190); mg.addColorStop(0, 'rgba(235,240,255,.95)'); mg.addColorStop(0.12, 'rgba(210,225,255,.7)'); mg.addColorStop(1, 'rgba(120,150,255,0)'); c.fillStyle = mg; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f4f6ff'; c.beginPath(); c.arc(fx, hz * 0.55, 44, 0, 7); c.fill();
      ridge(c, w, h, hz + h * 0.03, h * 0.08, 5, '#14224a', [3, 9, 17]);
      ridge(c, w, h, hz + h * 0.08, h * 0.07, 9, '#0c1634', [4, 11, 21]);
      const gg = c.createLinearGradient(0, hz + h * 0.06, 0, h); gg.addColorStop(0, '#0a1230'); gg.addColorStop(1, '#03050f'); c.fillStyle = gg; c.fillRect(0, hz + h * 0.06, w, h);
    } else { // studio
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4b4f5c'); g.addColorStop(0.5, '#2b2d36'); g.addColorStop(0.5, '#1c1d23'); g.addColorStop(1, '#101115'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      const lg = c.createRadialGradient(fx, hz * 0.7, 0, fx, hz * 0.7, h * 0.5); lg.addColorStop(0, 'rgba(255,255,255,.35)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = lg; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 2;
      for (let i = 0; i < 24; i++) { const x = i / 24 * w; c.beginPath(); c.moveTo(x, hz); c.lineTo(x, h); c.stroke(); }
      for (let j = 1; j < 8; j++) { const y = hz + Math.pow(j / 8, 1.8) * hz; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    }
  };
  const envCanvas = document.createElement('canvas'); envCanvas.width = 2048; envCanvas.height = 1024;
  const envTex = new T.CanvasTexture(envCanvas); envTex.minFilter = T.LinearFilter; envTex.generateMipmaps = false;
  const envMesh = new T.Mesh(new T.SphereGeometry(60, 48, 32), new T.MeshBasicMaterial({ map: envTex, side: T.BackSide, depthWrite: false, fog: false }));
  envMesh.scale.x = -1; envMesh.renderOrder = -100; envMesh.visible = false; scene.add(envMesh);
  SOS.setEnv = function (kind, temp) {
    SOS.env = kind; if (!temp) { SOS.settings.env = kind; SOS.save(); }
    if (kind === 'passthrough') { envMesh.visible = false; return; }
    SOS.drawEnv(kind, envCanvas); envTex.needsUpdate = true; envMesh.visible = true;
  };

  /* ---------- head pose ---------- */
  const headQ = new T.Quaternion(), rawQ = new T.Quaternion(), yawOffQ = new T.Quaternion();
  let yawOff = 0, mouseYaw = 0, mousePitch = 0;
  const tmpM = new T.Matrix4(), tmpV = new T.Vector3();
  const hasNative = typeof window.NativeBridge !== 'undefined' && window.NativeBridge && typeof window.NativeBridge.pose === 'function';
  function updatePose() {
    if (hasNative) {
      let s = ''; try { s = window.NativeBridge.pose(); } catch (e) {}
      if (s) {
        const p = s.split(',').map(Number);
        if (p.length === 9 && p.every(isFinite)) {
          // R maps device->ENU world. three basis = M*R with M: x=E, y=U, z=-N
          tmpM.set(p[0], p[1], p[2], 0, p[6], p[7], p[8], 0, -p[3], -p[4], -p[5], 0, 0, 0, 0, 1);
          rawQ.setFromRotationMatrix(tmpM);
          SOS.nativeOK = true;
        }
      }
    } else {
      rawQ.setFromEuler(new T.Euler(mousePitch, mouseYaw, 0, 'YXZ'));
    }
    tmpV.set(0, 0, -1).applyQuaternion(rawQ);
    SOS.yawRaw = Math.atan2(-tmpV.x, -tmpV.z); SOS.pitchRaw = Math.asin(clamp(tmpV.y, -1, 1));
    yawOffQ.setFromAxisAngle(new T.Vector3(0, 1, 0), yawOff);
    headQ.copy(yawOffQ).multiply(rawQ);
    headCam.quaternion.copy(headQ); headCam.position.set(0, 0, 0); headCam.updateMatrixWorld(true);
    const ipd = SOS.settings.ipd / 1000;
    for (let i = 0; i < 2; i++) {
      eyeCams[i].quaternion.copy(headQ);
      eyeCams[i].position.set((i ? 1 : -1) * ipd / 2, 0, 0).applyQuaternion(headQ);
      eyeCams[i].updateMatrixWorld(true);
    }
  }
  SOS.recenter = function () {
    tmpV.set(0, 0, -1).applyQuaternion(rawQ);
    yawOff = -Math.atan2(-tmpV.x, -tmpV.z);
  };
  SOS.headDir = function () { return new T.Vector3(0, 0, -1).applyQuaternion(headQ); };
  SOS.headYawPitch = function () { const d = SOS.headDir(); return { yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(clamp(d.y, -1, 1)) }; };

  /* ---------- windows ---------- */
  const PPM = 470, CHROME_H = 80;
  const winMeshes = [];
  class Win {
    constructor(app, o) {
      o = o || {};
      this.app = app; this.id = app.id; this.w = o.w || app.w || 1024; this.h = o.h || app.h || 640;
      this.chrome = app.chrome !== false; this.cw = this.w; this.ch = this.h + (this.chrome ? CHROME_H : 0);
      this.canvas = document.createElement('canvas'); this.canvas.width = this.cw; this.canvas.height = this.ch;
      this.ctx = this.canvas.getContext('2d');
      this.tex = new T.CanvasTexture(this.canvas); this.tex.minFilter = T.LinearFilter; this.tex.generateMipmaps = false;
      this.mat = new T.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false });
      this.mesh = new T.Mesh(new T.PlaneGeometry(this.cw / PPM, this.ch / PPM), this.mat);
      this.mesh.userData.win = this; scene.add(this.mesh); winMeshes.push(this.mesh);
      this.yaw = o.yaw || 0; this.pitch = o.pitch || 0; this.dist = o.dist || 2.3; this.tilt = o.tilt || 0;
      this.hits = []; this.hovers = new Set(); this.downs = new Set(); this.dirty = true;
      this.scrollY = 0; this.maxScroll = 0; this.anim = 0; this.closing = false; this.z = ++SOS.zc; this.mesh.renderOrder = this.z;
      this.state = {}; this.ui = new UI(this); this.kb = false;
      this.place();
      if (app.create) app.create(this);
    }
    place() {
      const cp = Math.cos(this.pitch), d = this.dist, m = this.mesh;
      m.position.set(-Math.sin(this.yaw) * cp * d, Math.sin(this.pitch) * d, -Math.cos(this.yaw) * cp * d);
      m.lookAt(0, 0, 0); if (this.tilt) m.rotateX(this.tilt);
      m.updateMatrixWorld(true);
    }
    scaleNow() { return (this.dist / 2.3) * SOS.settings.winScale * (0.9 + 0.1 * ease(this.anim)); }
    hitTest(px, py) {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const e = this.hits[i];
        if (px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) {
          if (e.clip && (px < e.clip[0] || px > e.clip[0] + e.clip[2] || py < e.clip[1] || py > e.clip[1] + e.clip[3])) continue;
          return e;
        }
      }
      return null;
    }
    redraw() {
      const c = this.ctx, ui = this.ui, app = this.app;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cw, this.ch);
      this.hits.length = 0; ui.oy = 0; ui.clip = null;
      c.save();
      if (app.glass !== false) { SOS.glass(c, 0, 0, this.w, this.h, app.radius || 40); rr(c, 0, 0, this.w, this.h, app.radius || 40); c.clip(); }
      c.textBaseline = 'middle';
      try { app.draw(ui, this); } catch (e) { console.error('draw ' + this.id, e); }
      c.restore();
      if (this.chrome) this.drawChrome();
      this.tex.needsUpdate = true; this.dirty = false;
    }
    drawChrome() {
      const c = this.ctx, ui = this.ui, cx = this.w / 2, y = this.h + 40;
      const gh = this.hovers.has('__grab'), gd = this.downs.has('__grab') || SOS.carry && SOS.carry.win === this;
      ui.hit('__grab', cx - 120, this.h + 10, 240, 60, { kind: 'grab', noDwell: true });
      c.save();
      c.fillStyle = gd ? 'rgba(255,255,255,.95)' : gh ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.5)';
      rr(c, cx - (gh ? 100 : 80), y - (gh ? 7 : 5), gh ? 200 : 160, gh ? 14 : 10, 7); c.fill();
      const xh = this.hovers.has('__close');
      ui.hit('__close', cx - 190, this.h + 16, 54, 54, { onClick: () => SOS.close(this.id) });
      c.fillStyle = xh ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(cx - 163, y, 20, 0, 7); c.fill();
      c.strokeStyle = xh ? '#222' : 'rgba(255,255,255,.9)'; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 171, y - 8); c.lineTo(cx - 155, y + 8); c.moveTo(cx - 155, y - 8); c.lineTo(cx - 171, y + 8); c.stroke();
      c.restore();
    }
  }
  SOS.Win = Win;

  SOS.glass = function (c, x, y, w, h, r) {
    c.save();
    rr(c, x, y, w, h, r);
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(66,68,76,.82)'); g.addColorStop(1, 'rgba(40,41,48,.82)');
    c.fillStyle = g; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.16)'; rr(c, x + 1, y + 1, w - 2, h - 2, r); c.stroke();
    const s = c.createLinearGradient(x, y, x + w, y + h * 0.6); s.addColorStop(0, 'rgba(255,255,255,.10)'); s.addColorStop(0.5, 'rgba(255,255,255,0)'); rr(c, x, y, w, h, r); c.fillStyle = s; c.fill();
    c.restore();
  };

  /* ---------- UI drawing helper ---------- */
  class UI {
    constructor(win) { this.win = win; this.oy = 0; this.clip = null; }
    get c() { return this.win.ctx; }
    hit(id, x, y, w, h, o) { const e = Object.assign({ id: id, x: x, y: y + this.oy, w: w, h: h }, o || {}); if (this.clip) e.clip = this.clip.slice(); this.win.hits.push(e); return e; }
    hover(id) { return this.win.hovers.has(id); }
    down(id) { return this.win.downs.has(id); }
    text(s, x, y, o) {
      o = o || {}; const c = this.c; c.save();
      c.font = (o.weight || 500) + ' ' + (o.size || 28) + 'px ' + (o.font || FONT);
      c.fillStyle = o.color || '#fff'; c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'middle';
      if (o.shadow) { c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 8; }
      c.fillText(s, x, y + this.oy * 0, o.maxW); c.restore();
    }
    measure(s, size, weight) { const c = this.c; c.save(); c.font = (weight || 500) + ' ' + (size || 28) + 'px ' + FONT; const w = c.measureText(s).width; c.restore(); return w; }
    rect(x, y, w, h, r, fill, stroke, lw) {
      const c = this.c; c.save(); rr(c, x, y, w, h, r);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); }
      c.restore();
    }
    // generic button: draws hover/press fill, label; returns hover
    btn(id, x, y, w, h, o) {
      o = o || {}; const hv = this.hover(id), dn = this.down(id), r = o.r == null ? 18 : o.r;
      this.hit(id, x, y, w, h, { onClick: o.onClick, noDwell: o.noDwell });
      const base = o.fill || 'rgba(255,255,255,0.08)';
      this.rect(x, y, w, h, r, dn ? (o.downFill || 'rgba(255,255,255,0.3)') : hv ? (o.hoverFill || 'rgba(255,255,255,0.2)') : base);
      if (o.label) this.text(o.label, x + w / 2, y + h / 2 + 1, { size: o.size || 28, align: 'center', weight: o.weight || 600, color: o.color || '#fff' });
      if (o.draw) o.draw(this.c, x, y, w, h, hv, dn);
      return hv;
    }
    toggle(id, x, y, on, onClick) {
      const hv = this.hover(id), c = this.c;
      this.hit(id, x - 6, y - 6, 100, 56, { onClick: onClick });
      c.save(); rr(c, x, y, 84, 44, 22); c.fillStyle = on ? '#30d158' : 'rgba(255,255,255,.22)'; c.fill();
      c.beginPath(); c.arc(x + (on ? 62 : 22), y + 22, hv ? 20 : 18, 0, 7); c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 6; c.fill(); c.restore();
    }
    slider(id, x, y, w, v, min, max, onChange, step) {
      const hv = this.hover(id) || this.down(id), c = this.c, t = clamp((v - min) / (max - min), 0, 1);
      this.hit(id, x - 14, y - 26, w + 28, 52, { kind: 'slider', noDwell: true, onDrag: function (px) { let nv = min + clamp((px - x) / w, 0, 1) * (max - min); if (step) nv = Math.round(nv / step) * step; onChange(nv); } });
      c.save(); rr(c, x, y - 5, w, 10, 5); c.fillStyle = 'rgba(255,255,255,.2)'; c.fill();
      rr(c, x, y - 5, Math.max(10, w * t), 10, 5); c.fillStyle = '#0a84ff'; c.fill();
      c.beginPath(); c.arc(x + w * t, y, hv ? 17 : 14, 0, 7); c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; c.fill(); c.restore();
    }
    scroll(x, y, w, h, contentH, fn) {
      const win = this.win; win.maxScroll = Math.max(0, contentH - h); win.scrollY = clamp(win.scrollY, 0, win.maxScroll);
      const c = this.c; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      c.translate(0, -win.scrollY); const pc = this.clip, po = this.oy; this.clip = [x, y, w, h]; this.oy = -win.scrollY;
      fn(); this.oy = po; this.clip = pc; c.restore();
      if (win.maxScroll > 0) { const th = Math.max(40, h * h / contentH), ty = y + (h - th) * (win.scrollY / win.maxScroll); this.rect(x + w - 8, ty, 5, th, 3, 'rgba(255,255,255,.35)'); }
    }
  }

  /* ---------- apps / windows api ---------- */
  SOS.registerApp = function (a) { SOS.apps[a.id] = a; };
  function sphericalToPos(yaw, pitch) { return { yaw: yaw, pitch: pitch }; }
  SOS.open = function (id, o) {
    o = o || {};
    const app = SOS.apps[id]; if (!app) return null;
    let w = SOS.wins[id];
    const hp = SOS.headYawPitch();
    if (w && w.closing) { w.closing = false; w.dirty = true; }
    if (w) { SOS.focus(w); if (o.bring !== false && app.id !== 'dock' && app.id !== 'keyboard') { w.yaw = hp.yaw; w.pitch = clamp(hp.pitch, -0.25, 0.25); w.place(); } return w; }
    let yaw = hp.yaw, pitch = clamp(hp.pitch, -0.25, 0.25);
    if (app.pitch != null) pitch = app.pitch;
    if (app.fixedYaw != null) yaw = app.fixedYaw;
    // nudge so the new window does not sit exactly on another one
    if (!o.exact) {
      for (const k in SOS.wins) { const q = SOS.wins[k]; if (q.closing || q.id === 'dock' || q.id === 'keyboard' || q.id === id) continue; if (Math.abs(q.yaw - yaw) < 0.35 && Math.abs(q.pitch - pitch) < 0.3) { yaw += 0.0; q.dist = Math.max(q.dist, 2.5); q.place(); } }
    }
    w = new Win(app, { yaw: o.yaw != null ? o.yaw : yaw, pitch: o.pitch != null ? o.pitch : pitch, dist: o.dist || app.dist || 2.3, tilt: app.tilt || 0 });
    SOS.wins[id] = w; SOS.focus(w);
    if (app.onOpen) app.onOpen(w);
    return w;
  };
  SOS.focus = function (w) { w.z = ++SOS.zc; w.mesh.renderOrder = w.z; if (w.id !== 'keyboard' && w.id !== 'dock') SOS.focused = w; };
  SOS.close = function (id) {
    const w = SOS.wins[id]; if (!w || w.closing) return;
    w.closing = true; if (w.app.onClose) w.app.onClose(w);
    if (SOS.kbFor === w) SOS.hideKeyboard();
    if (SOS.carry && SOS.carry.win === w) SOS.carry = null;
    SOS.tick(700, 0.05, 0.04);
  };
  function destroy(w) {
    scene.remove(w.mesh); const i = winMeshes.indexOf(w.mesh); if (i >= 0) winMeshes.splice(i, 1);
    w.tex.dispose(); w.mat.dispose(); w.mesh.geometry.dispose(); delete SOS.wins[w.id];
  }
  SOS.toggleHome = function () {
    const h = SOS.wins.home;
    if (h && !h.closing) {
      const hp = SOS.headYawPitch(); let dy = Math.abs(((h.yaw - hp.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (dy < 0.5) { SOS.close('home'); return; }
    }
    SOS.open('home', { bring: true });
  };
  SOS.showKeyboard = function (w) {
    SOS.kbFor = w; const kb = SOS.open('keyboard', { exact: true, yaw: w.yaw, pitch: clamp(w.pitch - 0.46, -0.9, 0.2), dist: Math.max(1.6, w.dist - 0.4) });
    kb.yaw = w.yaw; kb.pitch = clamp(w.pitch - 0.5, -0.9, 0.2); kb.dist = Math.max(1.6, w.dist - 0.4); kb.place(); kb.dirty = true; w.dirty = true;
  };
  SOS.hideKeyboard = function () { if (SOS.wins.keyboard) SOS.close('keyboard'); const w = SOS.kbFor; SOS.kbFor = null; if (w) w.dirty = true; };
  SOS.typeKey = function (k) { const w = SOS.kbFor; if (w && w.app.onKey) { w.app.onKey(w, k); w.dirty = true; } };

  /* ---------- pointers ---------- */
  const ray = new T.Raycaster(); ray.far = 60;
  function mkPointer(id) { return { id: id, active: false, origin: new T.Vector3(), dir: new T.Vector3(0, 0, -1), hit: null, down: null, dwell: 0, isHand: id !== 'gaze', pinch: false, lastSeen: 0 }; }
  const P = { gaze: mkPointer('gaze'), h0: mkPointer('h0'), h1: mkPointer('h1') };
  SOS.pointers = P;
  SOS.carry = null;

  function castPointer(p) {
    ray.set(p.origin, p.dir);
    const list = winMeshes.filter(function (m) { const w = m.userData.win; return !w.closing && w.anim > 0.35 && m.visible; });
    const hits = ray.intersectObjects(list, false);
    p.hit = null;
    // pick nearest hit where the pixel is non-transparent-ish (inside window rect) -> take first hit; prefer highest z among near-equal
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i], w = h.object.userData.win; if (!h.uv) continue;
      let best = h, bw = w;
      for (let j = i + 1; j < hits.length; j++) { if (hits[j].distance - h.distance > 0.25) break; const w2 = hits[j].object.userData.win; if (w2.z > bw.z && hits[j].uv) { best = hits[j]; bw = w2; } }
      const px = best.uv.x * bw.cw, py = (1 - best.uv.y) * bw.ch;
      p.hit = { win: bw, uv: best.uv, point: best.point, dist: best.distance, px: px, py: py, el: bw.hitTest(px, py) };
      break;
    }
  }
  function beginCarry(p, w, mode) { SOS.carry = { win: w, p: p, mode: mode }; w.dirty = true; SOS.tick(900, 0.05, 0.05); }
  function endCarry() { if (SOS.carry) { SOS.carry.win.dirty = true; SOS.carry = null; SOS.tick(600, 0.06, 0.05); } }

  function sendApp(w, type, p, extra) {
    const a = w.app; if (!a.onPointer || !p.hit || p.hit.win !== w) { if (!(extra && extra.force)) return; }
    const h = p.hit; a.onPointer(w, Object.assign({ type: type, x: h ? h.px : 0, y: h ? h.py : 0, ptype: p.isHand ? 'hand' : 'gaze', el: h ? h.el : null }, extra || {}));
  }
  function pDown(p) {
    if (SOS.carry && SOS.carry.mode === 'toggle' && !p.isHand) { endCarry(); return; }
    const h = p.hit; if (!h) { if (SOS.kbFor && !SOS.wins.keyboard) {} return; }
    const w = h.win, el = h.el; SOS.focus(w);
    p.down = { win: w, el: el, px: h.px, py: h.py, sy: w.scrollY, moved: false, t: SOS.t };
    if (el) w.downs.add(el.id); w.dirty = true;
    if (el && el.kind === 'grab') { beginCarry(p, w, p.isHand ? 'hold' : 'toggle'); p.down.carry = true; }
    else if (el && el.onDown) el.onDown(h.px, h.py);
    if (el && el.kind === 'slider') el.onDrag(h.px, h.py);
    if (!el || !el.kind) sendApp(w, 'down', p);
    SOS.tick(1800, 0.035, 0.05);
  }
  function pMove(p) {
    const d = p.down; if (!d) return;
    const h = p.hit;
    if (d.carry) return;
    if (!h || h.win !== d.win) return;
    const dy = h.py - d.py, dx = h.px - d.px;
    if (!d.moved && Math.hypot(dx, dy) > 22) d.moved = true;
    if (d.el && d.el.kind === 'slider') { d.el.onDrag(h.px, h.py); d.win.dirty = true; return; }
    if (d.moved && d.win.maxScroll > 0 && !(d.el && d.el.noScroll)) { d.win.scrollY = clamp(d.sy - dy, 0, d.win.maxScroll); d.win.dirty = true; }
    sendApp(d.win, 'move', p);
  }
  function pUp(p) {
    const d = p.down; if (!d) return; p.down = null;
    if (d.carry) { if (d.win.downs) d.win.downs.delete('__grab'); if (p.isHand) endCarry(); d.win.dirty = true; return; }
    if (d.el) d.win.downs.delete(d.el.id); d.win.dirty = true;
    const h = p.hit;
    if (!d.moved && d.el && h && h.win === d.win && h.el && h.el.id === d.el.id && d.el.onClick) { d.el.onClick(h.px, h.py, p); SOS.tick(1100, 0.06, 0.06); }
    if (!d.el || !d.el.kind) sendApp(d.win, 'up', p);
  }
  // gaze "click": touch tap / magnet / space
  SOS.click = function () {
    const p = P.gaze;
    if (SOS.carry && SOS.carry.mode === 'toggle') { endCarry(); return; }
    if (!p.hit) { return; }
    pDown(p);
    const d = p.down; const h = p.hit;
    if (d && !(d.el && d.el.kind === 'grab')) {
      p.down = null; if (d.el) d.win.downs.delete(d.el.id); d.win.dirty = true;
      if (d.el && d.el.onClick) { d.el.onClick(h.px, h.py, p); SOS.tick(1100, 0.06, 0.06); }
      else if (!d.el || !d.el.kind) sendApp(d.win, 'click', p);
      else if (d.el.kind === 'slider') { /* value already set on down */ }
    }
    if (SOS.kbFor && (!h.win || (h.win !== SOS.kbFor && h.win.id !== 'keyboard'))) { /* keep keyboard until app hides it */ }
  };
  SOS.gazeScroll = function (dyPx) {
    const h = P.gaze.hit; if (!h) return; const w = h.win;
    if (w.maxScroll > 0) { w.scrollY = clamp(w.scrollY + dyPx, 0, w.maxScroll); w.dirty = true; }
  };

  /* ---------- cursor ---------- */
  const curCv = document.createElement('canvas'); curCv.width = curCv.height = 128; const curC = curCv.getContext('2d');
  const curTex = new T.CanvasTexture(curCv);
  const cursor = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: curTex, transparent: true, depthTest: false, depthWrite: false }));
  cursor.renderOrder = 1000; scene.add(cursor);
  const hcursors = [0, 1].map(function () { const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: curTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0.8 })); m.renderOrder = 999; m.visible = false; scene.add(m); return m; });
  let lastProg = -1, lastHov = false;
  function drawCursor(prog, hov, dwelling) {
    const key = Math.round(prog * 50) + (hov ? 100 : 0);
    if (key === lastProg) return; lastProg = key;
    curC.clearRect(0, 0, 128, 128);
    curC.lineWidth = 7; curC.strokeStyle = 'rgba(0,0,0,.35)'; curC.beginPath(); curC.arc(64, 64, 36, 0, 7); curC.stroke();
    curC.lineWidth = 5; curC.strokeStyle = hov ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,.85)'; curC.beginPath(); curC.arc(64, 64, hov ? 34 : 28, 0, 7); curC.stroke();
    curC.fillStyle = '#fff'; curC.beginPath(); curC.arc(64, 64, hov ? 7 : 6, 0, 7); curC.fill();
    if (prog > 0) { curC.strokeStyle = '#0a84ff'; curC.lineWidth = 9; curC.beginPath(); curC.arc(64, 64, 46, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); curC.stroke(); }
    curTex.needsUpdate = true;
  }

  /* ---------- main update ---------- */
  const _d = new T.Vector3(), _o = new T.Vector3();
  function updatePointers(dt) {
    // gaze: centre of view
    const g = P.gaze; g.active = true; g.origin.set(0, 0, 0); g.dir.set(0, 0, -1).applyQuaternion(headQ);
    // hands
    const now = performance.now();
    for (let i = 0; i < 2; i++) {
      const p = i ? P.h1 : P.h0, hd = SOS.hands[i];
      if (hd && SOS.settings.hands && now - hd.t < 350) {
        p.active = true; p.lastSeen = now;
        const nx = hd.ex * 2 - 1, ny = 1 - hd.ey * 2;
        _d.set(nx, ny, 0.5).unproject(headCam).sub(headCam.position).normalize();
        p.origin.set(0, 0, 0); p.dir.copy(_d);
        // pinch edges
        if (hd.pinch && !p.pinch) { p.pinch = true; castPointer(p); pDown(p); }
        else if (!hd.pinch && p.pinch) { p.pinch = false; pUp(p); }
      } else if (p.active) {
        if (p.pinch) { p.pinch = false; pUp(p); }
        p.active = false; p.hit = null;
      }
    }
    // cast + hover
    const newHov = new Map();
    [g, P.h0, P.h1].forEach(function (p) {
      if (!p.active) return;
      const prev = p.hit && p.hit.el ? p.hit.el.id : null, prevWin = p.hit ? p.hit.win : null;
      castPointer(p);
      if (p.hit && p.hit.el) { if (!newHov.has(p.hit.win)) newHov.set(p.hit.win, new Set()); newHov.get(p.hit.win).add(p.hit.el.id); }
      const cur = p.hit && p.hit.el ? p.hit.el.id : null;
      if (cur !== prev || (p.hit ? p.hit.win : null) !== prevWin) { if (cur && !(p.hit.el.kind === 'grab')) SOS.tick(2400, 0.02, 0.018); p.dwell = 0; }
      if (p.down) pMove(p);
    });
    for (const k in SOS.wins) {
      const w = SOS.wins[k], nh = newHov.get(w) || new Set(); let ch = nh.size !== w.hovers.size;
      if (!ch) nh.forEach(function (v) { if (!w.hovers.has(v)) ch = true; });
      if (ch) { w.hovers = nh; w.dirty = true; }
    }
    // carry
    const cr = SOS.carry;
    if (cr) {
      const p = cr.p; if (!p.active) { endCarry(); }
      else {
        const d = p.dir, w = cr.win;
        w.yaw = Math.atan2(-d.x, -d.z); w.pitch = clamp(Math.asin(clamp(d.y, -1, 1)), -1.2, 1.2); w.place();
        if (SOS.kbFor === w && SOS.wins.keyboard) { const kb = SOS.wins.keyboard; kb.yaw = w.yaw; kb.pitch = clamp(w.pitch - 0.5, -0.9, 0.2); kb.place(); }
      }
    }
    // dwell (gaze only)
    let prog = 0;
    if (SOS.settings.dwell && g.hit && g.hit.el && g.hit.el.onClick && !g.hit.el.noDwell && !SOS.carry) {
      g.dwell += dt; if (g.dwell < 0) prog = 0; else prog = g.dwell / SOS.settings.dwellT;
      if (g.dwell >= SOS.settings.dwellT) { g.dwell = -0.7; SOS.click(); prog = 0; }
    } else g.dwell = 0;
    // cursor mesh
    const handHover = (P.h0.active && P.h0.hit) || (P.h1.active && P.h1.hit);
    cursor.visible = !handHover || !SOS.settings.hands;
    let dist = 2.2, pt = null;
    if (g.hit) { dist = g.hit.dist - 0.02; }
    pt = _o.copy(g.dir).multiplyScalar(dist);
    cursor.position.copy(pt); cursor.lookAt(0, 0, 0); cursor.scale.setScalar(0.085 * dist);
    drawCursor(prog, !!(g.hit && g.hit.el && g.hit.el.id !== undefined && g.hit.el.id !== '__none'), prog > 0);
    for (let i = 0; i < 2; i++) {
      const p = i ? P.h1 : P.h0, m = hcursors[i];
      m.visible = !!(SOS.settings.handCursor && p.active);
      if (m.visible) { const dd = p.hit ? p.hit.dist - 0.02 : 2.2; m.position.copy(p.dir).multiplyScalar(dd); m.lookAt(0, 0, 0); m.scale.setScalar(0.05 * dd * (p.pinch ? 0.6 : 1)); }
    }
  }

  function update(dt) {
    SOS.t += dt;
    updatePose();
    updatePointers(dt);
    const toKill = [];
    for (const k in SOS.wins) {
      const w = SOS.wins[k];
      if (w.closing) { w.anim -= dt * 5; if (w.anim <= 0) { toKill.push(w); continue; } }
      else if (w.anim < 1) w.anim = Math.min(1, w.anim + dt * 4.5);
      if (w.app.animated && !w.closing) w.dirty = true;
      if (w.app.tick) w.app.tick(w, dt);
      if (w.dirty) w.redraw();
      const s = w.scaleNow(); w.mesh.scale.set(s, s, 1); w.mat.opacity = ease(w.anim);
      if (w.id === 'keyboard' && SOS.kbFor) { /* follows */ }
    }
    toKill.forEach(destroy);
  }

  function render() {
    updateBg();
    renderer.setRenderTarget(rt); renderer.setScissorTest(true);
    for (let e = 0; e < 2; e++) {
      const x0 = e * (W >> 1), w = W >> 1;
      renderer.setViewport(x0, 0, w, H); renderer.setScissor(x0, 0, w, H);
      renderer.clear(true, true, true);
      renderer.render(bgScene, bgCam);
      renderer.clearDepth();
      renderer.render(scene, eyeCams[e]);
    }
    renderer.setScissorTest(false); renderer.setRenderTarget(null);
    const cw = canvas.width, ch = canvas.height; renderer.setViewport(0, 0, cw, ch);
    renderer.clear(true, true, true);
    renderer.render(distScene, distCam);
  }

  let last = performance.now(), fAcc = 0, fN = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    fAcc += dt; fN++; if (fAcc > 1) { SOS.fps = Math.round(fN / fAcc); fAcc = 0; fN = 0; }
    try { update(dt); render(); } catch (e) { console.error('frame', e); }
  }

  /* ---------- input: touch (Cardboard v2), mouse, keys, magnet ---------- */
  let touch = null;
  function gearZone(x, y) { return Math.abs(x - innerWidth / 2) < 56 && y > innerHeight - 90; }
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault(); SOS.audio();
    const t = e.touches[0]; touch = { x: t.clientX, y: t.clientY, lx: t.clientX, ly: t.clientY, t: performance.now(), moved: false, long: false };
    touch.timer = setTimeout(function () { if (touch && !touch.moved) { touch.long = true; SOS.toggleHome(); SOS.tick(500, 0.12, 0.06); } }, 800);
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    e.preventDefault(); if (!touch) return; const t = e.touches[0];
    const dy = t.clientY - touch.ly; touch.ly = t.clientY; touch.lx = t.clientX;
    if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 14) { touch.moved = true; clearTimeout(touch.timer); }
    if (touch.moved) SOS.gazeScroll(-dy * 2.2);
  }, { passive: false });
  canvas.addEventListener('touchend', function (e) {
    e.preventDefault(); if (!touch) return; clearTimeout(touch.timer);
    const t = touch; touch = null;
    if (!t.moved && !t.long) { if (gearZone(t.x, t.y)) SOS.open('settings'); else SOS.click(); }
  }, { passive: false });
  canvas.addEventListener('touchcancel', function () { if (touch) clearTimeout(touch.timer); touch = null; });
  // desktop testing: drag to look, click to select
  let md = null;
  canvas.addEventListener('mousedown', function (e) { md = { x: e.clientX, y: e.clientY, moved: false }; SOS.audio(); });
  addEventListener('mousemove', function (e) { if (!md) return; const dx = e.clientX - md.x, dy = e.clientY - md.y; if (Math.hypot(dx, dy) > 4) md.moved = true; if (md.moved && !hasNative) { mouseYaw -= dx * 0.004; mousePitch = clamp(mousePitch - dy * 0.004, -1.4, 1.4); md.x = e.clientX; md.y = e.clientY; } });
  addEventListener('mouseup', function (e) { if (md && !md.moved) { if (gearZone(e.clientX, e.clientY)) SOS.open('settings'); else SOS.click(); } md = null; });
  addEventListener('keydown', function (e) {
    const k = e.key;
    if (k === 'ArrowLeft') mouseYaw += 0.06; else if (k === 'ArrowRight') mouseYaw -= 0.06; else if (k === 'ArrowUp') mousePitch = clamp(mousePitch + 0.05, -1.4, 1.4); else if (k === 'ArrowDown') mousePitch = clamp(mousePitch - 0.05, -1.4, 1.4);
    else if (k === ' ' || k === 'Enter') SOS.click(); else if (k === 'h' || k === 'H') SOS.toggleHome(); else if (k === 'r' || k === 'R') SOS.recenter();
  });
  SOS.setLook = function (yaw, pitch) { mouseYaw = yaw; mousePitch = pitch; };
  // magnet clicks from native
  setInterval(function () {
    if (!hasNative) return;
    try { const n = window.NativeBridge.takeClicks(); if (n > 0 && SOS.settings.magnet) SOS.click(); } catch (e) {}
  }, 30);

  /* ---------- boot ---------- */
  SOS.boot = function () {
    resize(); applySettingsNative();
    SOS.setEnv(SOS.settings.env || 'passthrough');
    requestAnimationFrame(function () {
      SOS.recenter();
      SOS.open('home', { exact: true, yaw: 0, pitch: 0.02, dist: 2.4 });
      SOS.open('dock', { exact: true, yaw: 0, pitch: -0.62, dist: 2.0 });
      last = performance.now(); requestAnimationFrame(loop);
    });
  };
  function applySettingsNative() { try { if (hasNative) window.NativeBridge.setMagnetThreshold(SOS.settings.magnetT); } catch (e) {} }
  SOS.pushNative = applySettingsNative;
  SOS.quit = function () { try { if (hasNative) window.NativeBridge.quit(); } catch (e) {} };
})();
