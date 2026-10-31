'use strict';
/* Native hand tracking client. The tracking itself runs in Android (MediaPipe Tasks) on the same camera frames as passthrough,
   completely outside the WebView. Nothing about the hands is drawn: you see your real hands through the camera. */
(function () {
  const SOS = window.SOS, S = SOS.settings;
  SOS.handsState = 'Off';
  let loading = false, running = false, timer = 0, gen = 0, lastSeq = -1, lastData = 0;
  const NB = function () { return window.NativeBridge && typeof window.NativeBridge.startHands === 'function' ? window.NativeBridge : null; };
  const slots = [null, null];
  const dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  let palmT = 0, palmCool = 0;

  function parse(s) {
    const i = s.indexOf(';'); if (i < 0) return null;
    const seq = +s.slice(0, i), body = s.slice(i + 1);
    const hands = body ? body.split('|').map(function (h) { const a = h.split(','), pts = []; for (let k = 0; k + 1 < a.length; k += 2) pts.push({ x: +a[k], y: +a[k + 1] }); return pts; }).filter(function (h) { return h.length === 21; }) : [];
    return { seq: seq, hands: hands };
  }

  // lm: array of hands, each 21 {x,y} points in 0..1 of the upright camera image
  function onHands(lm) {
    const now = performance.now();
    const dets = lm.map(function (h) {
      const size = Math.max(0.02, dist(h[0], h[9]));
      const pd = dist(h[4], h[8]) / size;
      const ext = function (t, p) { return dist(h[t], h[0]) > dist(h[p], h[0]) * 1.12; };
      const curled = function (t, p) { return dist(h[t], h[0]) < dist(h[p], h[0]) * 1.08; };
      const indexOut = ext(8, 6), others = curled(12, 10) && curled(16, 14) && curled(20, 18);
      let open = 0; [[8, 6], [12, 10], [16, 14], [20, 18]].forEach(function (f) { if (ext(f[0], f[1])) open++; });
      return { u: h[8].x, v: h[8].y, size: size, ratio: pd, point: indexOut && others, len: dist(h[8], h[5]) / size, open: open === 4 && pd > 0.8 };
    });
    const used = [false, false];
    let palm = false;
    dets.forEach(function (d) {
      let best = -1, bd = 0.3;
      for (let i = 0; i < 2; i++) { const s = slots[i]; if (s && !used[i] && now - s.t < 600) { const dd = Math.hypot(s.u - d.u, s.v - d.v); if (dd < bd) { bd = dd; best = i; } } }
      if (best < 0) { for (let i = 0; i < 2; i++) { if (!used[i] && (!slots[i] || now - slots[i].t >= 600)) { best = i; break; } } }
      if (best < 0) return;
      used[best] = true;
      const s = slots[best] || { u: d.u, v: d.v, pinch: false, hist: [], tapCool: 0, tap: null };
      const a = 0.6; s.u += (d.u - s.u) * a; s.v += (d.v - s.v) * a;
      if (!s.pinch && d.ratio < 0.34) s.pinch = true; else if (s.pinch && d.ratio > 0.5) s.pinch = false;
      s.t = now;
      // poke / tap detection: only from a pointing pose. Either the fingertip dips quickly, or the finger foreshortens (pokes away from you).
      s.hist.push({ t: now, u: s.u, v: s.v, pt: d.point && !s.pinch, len: d.len });
      while (s.hist.length && now - s.hist[0].t > 320) s.hist.shift();
      if (!s.pinch && now > s.tapCool) {
        let old = null; for (let k = 0; k < s.hist.length; k++) { if (now - s.hist[k].t <= 240 && now - s.hist[k].t >= 60) { old = s.hist[k]; break; } }
        if (old && old.pt) {
          const dv = (s.v - old.v) / d.size, du = Math.abs(s.u - old.u) / d.size, shrink = (old.len - d.len) / Math.max(0.3, old.len);
          if ((dv > 0.5 && du < 0.8) || (shrink > 0.38 && old.len > 0.7)) { s.tap = { u: old.u, v: old.v, t: now }; s.tapCool = now + 380; s.hist.length = 0; }
        }
      }
      slots[best] = s;
      const e = SOS.camToEye(s.u, s.v), hd = { ex: e[0], ey: e[1], pinch: s.pinch, point: d.point, t: now };
      if (s.tap) { const te = SOS.camToEye(s.tap.u, s.tap.v); hd.tap = { ex: te[0], ey: te[1], t: s.tap.t }; }
      SOS.hands[best] = hd;
      const ptr = SOS.pointers && SOS.pointers[best ? 'h1' : 'h0'];
      if (d.open && !s.pinch && !(ptr && ptr.hit)) palm = true;
    });
    if (palm && S.palm) { palmT += 1; if (palmT > 10 && now > palmCool) { palmCool = now + 2500; palmT = 0; SOS.toggleHome(); } } else palmT = 0;
    SOS.handsState = lm.length ? 'Tracking ' + lm.length + (lm.length > 1 ? ' hands' : ' hand') : 'Ready';
  }

  function poll() {
    const nb = NB(); if (!nb || !running) return;
    let s = ''; try { s = nb.hands(); } catch (e) { return; }
    if (!s) return;
    const r = parse(s); if (!r || r.seq === lastSeq) return;
    lastSeq = r.seq; lastData = performance.now();
    onHands(r.hands);
  }

  SOS.startHands = async function () {
    if (running || loading || !S.hands || SOS.camState !== 'on') return;
    const nb = NB(); if (!nb) { SOS.handsState = 'Needs the Android app'; return; }
    loading = true; const my = ++gen; SOS.handsState = 'Loading…';
    try { localStorage.setItem('sos.handsrun', '1'); } catch (e) {}
    try {
      nb.startHands();
      let st = 'loading';
      for (let i = 0; i < 160 && st === 'loading'; i++) { await new Promise(function (r) { setTimeout(r, 50); }); st = nb.handsStatus(); if (my !== gen) { loading = false; return; } }
      if (st !== 'on') { SOS.handsState = st.indexOf('error') === 0 ? 'Unavailable' : 'Not ready'; console.error('hands', st); loading = false; try { localStorage.setItem('sos.handsrun', '0'); } catch (e) {} return; }
      running = true; lastSeq = -1; SOS.handsState = 'Ready';
      clearInterval(timer); timer = setInterval(poll, 22);
      setTimeout(function () { try { localStorage.setItem('sos.handsrun', '0'); } catch (e) {} }, 6000);
    } catch (e) { SOS.handsState = 'Unavailable'; console.error('hands', e); }
    loading = false;
  };
  SOS.stopHands = function () {
    running = false; gen++; clearInterval(timer); SOS.hands.length = 0; slots[0] = slots[1] = null; SOS.handsState = 'Off';
    try { const nb = NB(); if (nb) nb.stopHands(); } catch (e) {}
  };
  // test hook (desktop): fake a hand at eye coords
  SOS.injectHand = function (i, ex, ey, pinch, tap) { const t = performance.now(); SOS.hands[i] = { ex: ex, ey: ey, pinch: !!pinch, point: true, t: t, tap: tap ? { ex: ex, ey: ey, t: t } : undefined }; };
})();
