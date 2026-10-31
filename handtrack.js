'use strict';
/* Camera passthrough + hidden hand tracking (MediaPipe Hands, fully offline). Nothing about the hands is drawn. */
(function () {
  const SOS = window.SOS, S = SOS.settings;
  SOS.handsState = 'Starting…';
  const video = document.getElementById('cam');

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      video.srcObject = stream; video.muted = true; video.setAttribute('playsinline', '');
      await video.play();
      SOS.attachVideo(video); SOS.camOK = true;
    } catch (e) {
      SOS.camOK = false; SOS.camErr = String(e);
      if (SOS.env === 'passthrough') SOS.setEnv('studio', true);
      SOS.handsState = 'No camera';
    }
  }

  const slots = [null, null];
  const dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  function onResults(res) {
    const now = performance.now(), lm = res.multiHandLandmarks || [];
    const dets = lm.map(function (h) {
      const size = Math.max(0.02, dist(h[0], h[9])), pd = dist(h[4], h[8]) / size;
      const mu = (h[4].x + h[8].x) / 2, mv = (h[4].y + h[8].y) / 2;
      return { u: mu, v: mv, ratio: pd };
    });
    const used = [false, false];
    dets.forEach(function (d) {
      let best = -1, bd = 0.3;
      for (let i = 0; i < 2; i++) { const s = slots[i]; if (s && !used[i] && now - s.t < 600) { const dd = Math.hypot(s.u - d.u, s.v - d.v); if (dd < bd) { bd = dd; best = i; } } }
      if (best < 0) { for (let i = 0; i < 2; i++) { if (!used[i] && (!slots[i] || now - slots[i].t >= 600)) { best = i; break; } } }
      if (best < 0) return;
      used[best] = true;
      const s = slots[best] || { u: d.u, v: d.v, pinch: false };
      const a = 0.55; s.u += (d.u - s.u) * a; s.v += (d.v - s.v) * a;
      if (!s.pinch && d.ratio < 0.34) s.pinch = true; else if (s.pinch && d.ratio > 0.5) s.pinch = false;
      s.t = now; slots[best] = s;
      const e = SOS.camToEye(s.u, s.v);
      SOS.hands[best] = { ex: e[0], ey: e[1], pinch: s.pinch, t: now };
    });
    SOS.handsState = lm.length ? 'Tracking ' + lm.length + (lm.length > 1 ? ' hands' : ' hand') : 'Ready';
  }

  async function startHands() {
    if (typeof Hands === 'undefined') { SOS.handsState = 'Unavailable'; return; }
    try {
      const hands = new Hands({ locateFile: function (f) { return f; } });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5, selfieMode: false });
      hands.onResults(onResults);
      await hands.initialize();
      SOS.handsState = 'Ready';
      let busy = false, last = 0;
      const step = async function () {
        requestAnimationFrame(step);
        if (busy || !S.hands || !SOS.videoReady) return;
        const now = performance.now(); if (now - last < 40) return;
        busy = true; last = now;
        try { await hands.send({ image: video }); } catch (e) { SOS.handsState = 'Error'; }
        busy = false;
      };
      requestAnimationFrame(step);
    } catch (e) { SOS.handsState = 'Unavailable'; console.error('hands', e); }
  }

  // test hook (desktop): fake a hand at eye coords
  SOS.injectHand = function (i, ex, ey, pinch) { SOS.hands[i] = { ex: ex, ey: ey, pinch: !!pinch, t: performance.now() }; };

  SOS.boot();
  startCamera().then(function () { setTimeout(startHands, 400); });
})();
