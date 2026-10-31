'use strict';
/* Hidden hand tracking (MediaPipe Hands, fully offline). Loads only when the camera is on. Nothing about the hands is drawn. */
(function () {
  const SOS = window.SOS, S = SOS.settings;
  SOS.handsState = 'Off';
  let hands = null, loading = false, running = false, gen = 0;
  const small = document.createElement('canvas'), sctx = small.getContext('2d');

  function loadScript(src) {
    return new Promise(function (res, rej) { if (window.Hands) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error(src)); }; document.body.appendChild(s); });
  }

  const slots = [null, null];
  const dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  let palmT = 0, palmCool = 0;
  function onResults(res) {
    const now = performance.now(), lm = res.multiHandLandmarks || [];
    const dets = lm.map(function (h) {
      const size = Math.max(0.02, dist(h[0], h[9])), pd = dist(h[4], h[8]) / size;
      let open = 0; [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(function (f) { if (dist(h[f[0]], h[0]) > dist(h[f[1]], h[0]) * 1.12) open++; });
      return { u: (h[4].x + h[8].x) / 2, v: (h[4].y + h[8].y) / 2, ratio: pd, open: open === 4 && pd > 0.8 };
    });
    const used = [false, false];
    let palm = false;
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
      const ptr = SOS.pointers && SOS.pointers[best ? 'h1' : 'h0'];
      if (d.open && !s.pinch && !(ptr && ptr.hit)) palm = true;
    });
    // hold an open palm over empty space = Home
    if (palm && S.palm) { palmT += 1; if (palmT > 14 && now > palmCool) { palmCool = now + 2500; palmT = 0; SOS.toggleHome(); } } else palmT = 0;
    SOS.handsState = lm.length ? 'Tracking ' + lm.length + (lm.length > 1 ? ' hands' : ' hand') : 'Ready';
  }

  SOS.startHands = async function () {
    if (running || loading || !S.hands || SOS.camState !== 'on') return;
    loading = true; const my = ++gen; SOS.handsState = 'Loading…';
    try { localStorage.setItem('sos.handsrun', '1'); } catch (e) {}
    try {
      await loadScript('mp_hands.js');
      if (my !== gen) { loading = false; return; }
      hands = new window.Hands({ locateFile: function (f) { return f; } });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5, selfieMode: false });
      hands.onResults(onResults);
      await hands.initialize();
      if (my !== gen) { try { hands.close(); } catch (e) {} hands = null; loading = false; return; }
      running = true; SOS.handsState = 'Ready';
      setTimeout(function () { try { localStorage.setItem('sos.handsrun', '0'); } catch (e) {} }, 6000);
      let busy = false, last = 0;
      const step = async function () {
        if (!running || my !== gen) return;
        requestAnimationFrame(step);
        const v = SOS.video;
        if (busy || !S.hands || !SOS.videoReady || !v) return;
        const now = performance.now(); if (now - last < 66) return; // ~15 fps is plenty for pointing
        busy = true; last = now;
        try {
          const w = 384, h = Math.round(w * v.videoHeight / v.videoWidth);
          if (small.width !== w || small.height !== h) { small.width = w; small.height = h; }
          sctx.drawImage(v, 0, 0, w, h);
          await hands.send({ image: small });
        } catch (e) { SOS.handsState = 'Error'; }
        busy = false;
      };
      requestAnimationFrame(step);
    } catch (e) { SOS.handsState = 'Unavailable'; console.error('hands', e); }
    loading = false;
  };
  SOS.stopHands = function () {
    running = false; gen++; SOS.hands.length = 0; slots[0] = slots[1] = null; SOS.handsState = 'Off';
    try { if (hands) hands.close(); } catch (e) {}
    hands = null;
  };
  // test hook (desktop): fake a hand at eye coords
  SOS.injectHand = function (i, ex, ey, pinch) { SOS.hands[i] = { ex: ex, ey: ey, pinch: !!pinch, t: performance.now() }; };
})();
