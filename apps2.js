'use strict';
/* Orbit OS apps: Toast, Camera, Gallery (photos + videos, stored on the device) */
(function () {
  const SOS = window.SOS, S = SOS.settings, U = SOS.util, FONT = SOS.FONT;
  const clamp = U.clamp, rr = U.rr, reg = SOS.registerApp;
  const WHITE2 = 'rgba(255,255,255,.62)';
  const pad = function (n) { return String(n).padStart(2, '0'); };

  /* ---------- Toast ---------- */
  reg({
    id: 'toast', w: 960, h: 150, chrome: false, radius: 46, dist: 1.8, ghost: true,
    create(win) { win.state = { msg: '', until: 0 }; },
    show(msg, secs) {
      const hp = SOS.headYawPitch(), pitch = clamp(hp.pitch - 0.14, -0.8, 0.6);
      const w = SOS.open('toast', { yaw: hp.yaw, pitch: pitch, dist: 1.8 });
      w.state.msg = msg; w.state.until = SOS.t + secs; w.o.copy(SOS.headPos); w.yaw = hp.yaw; w.pitch = pitch; w.place(); w.dirty = true; SOS.focus(w);
    },
    tick(win) { if (!win.closing && SOS.t > win.state.until) SOS.close('toast'); },
    draw(ui, win) {
      const c = ui.c; c.save(); c.font = '600 30px ' + FONT;
      const words = String(win.state.msg).split(' '), lines = []; let line = '';
      words.forEach(function (w) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > win.w - 110 && line) { lines.push(line); line = w; } else line = t; }); lines.push(line); c.restore();
      const h = lines.slice(0, 3).length, y0 = win.h / 2 - (h - 1) * 20;
      lines.slice(0, 3).forEach(function (l, i) { ui.text(l, win.w / 2, y0 + i * 40, { size: 30, align: 'center', weight: 600 }); });
    }
  });

  /* ---------- media library (IndexedDB, falls back to memory) ---------- */
  const MEDIA = { items: [], loaded: false, db: null, loading: null };
  MEDIA.open = function () {
    return new Promise(function (res) {
      try { const r = indexedDB.open('sos-media', 1); r.onupgradeneeded = function () { r.result.createObjectStore('items', { keyPath: 'id' }); }; r.onsuccess = function () { MEDIA.db = r.result; res(true); }; r.onerror = function () { res(false); }; r.onblocked = function () { res(false); }; } catch (e) { res(false); }
    });
  };
  MEDIA.load = function () {
    if (MEDIA.loading) return MEDIA.loading;
    MEDIA.loading = (async function () {
      await MEDIA.open();
      if (MEDIA.db) await new Promise(function (res) { try { const rq = MEDIA.db.transaction('items', 'readonly').objectStore('items').getAll(); rq.onsuccess = function () { MEDIA.items = (rq.result || []).sort(function (a, b) { return b.ts - a.ts; }); res(); }; rq.onerror = function () { res(); }; } catch (e) { res(); } });
      MEDIA.loaded = true;
    })();
    return MEDIA.loading;
  };
  MEDIA.add = function (rec) { MEDIA.items.unshift(rec); if (MEDIA.db) { try { MEDIA.db.transaction('items', 'readwrite').objectStore('items').put(rec); } catch (e) {} } };
  MEDIA.del = function (id) { MEDIA.items = MEDIA.items.filter(function (x) { return x.id !== id; }); if (MEDIA.db) { try { MEDIA.db.transaction('items', 'readwrite').objectStore('items').delete(id); } catch (e) {} } };
  SOS.media = MEDIA;

  const IMGS = new WeakMap();
  function thumbImg(rec) { let im = IMGS.get(rec); if (!im) { im = new Image(); im.src = rec.thumb; IMGS.set(rec, im); } return im.complete && im.naturalWidth ? im : null; }
  function makeThumb(src) {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180; const c = cv.getContext('2d');
    const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height; if (!sw || !sh) return '';
    let cw = sw, ch = sh, cx = 0, cy = 0; const ta = 320 / 180; if (sw / sh > ta) { cw = sh * ta; cx = (sw - cw) / 2; } else { ch = sw / ta; cy = (sh - ch) / 2; }
    c.drawImage(src, cx, cy, cw, ch, 0, 0, 320, 180); return cv.toDataURL('image/jpeg', 0.7);
  }
  function blobToB64(b) { return new Promise(function (res) { const r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1] || ''); }; r.readAsDataURL(b); }); }
  async function saveToPhone(rec) {
    const mime = (rec.blob.type || (rec.type === 'photo' ? 'image/jpeg' : 'video/webm')).split(';')[0];
    const ext = rec.type === 'photo' ? 'jpg' : (mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm'), d = new Date(rec.ts);
    const name = 'OrbitOS_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + '.' + ext;
    const NB = window.NativeBridge;
    try {
      if (NB && typeof NB.beginSave === 'function') {
        if (!NB.beginSave(name, mime)) { SOS.toast('Could not save to your phone.', 3); return false; }
        const CH = 196608;
        for (let o = 0; o < rec.blob.size; o += CH) { if (!NB.appendSave(await blobToB64(rec.blob.slice(o, o + CH)))) { SOS.toast('Saving to your phone failed.', 3); return false; } }
        SOS.toast('Saved to your phone: ' + NB.endSave(), 4); return true;
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(rec.blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); return true;
    } catch (e) { SOS.toast('Saving to your phone failed.', 3); return false; }
  }

  /* ---------- Camera ---------- */
  function coverDraw(c, v, x, y, w, h) {
    const vw = v.videoWidth, vh = v.videoHeight; if (!vw || !vh) return;
    let sw = vw, sh = vh, sx = 0, sy = 0; const ta = w / h; if (vw / vh > ta) { sw = vh * ta; sx = (vw - sw) / 2; } else { sh = vw / ta; sy = (vh - sh) / 2; }
    c.drawImage(v, sx, sy, sw, sh, x, y, w, h);
  }
  function stopRec(win) { const st = win.state; if (st.rec && st.rec.mr && st.rec.mr.state !== 'inactive') { try { st.rec.mr.stop(); } catch (e) {} } }
  function startRec(win) {
    const st = win.state;
    if (!SOS.stream || typeof MediaRecorder === 'undefined') { SOS.toast('Video recording is not available on this device.', 3); return; }
    const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'], mt = types.filter(function (t) { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } })[0] || '';
    let mr; try { mr = new MediaRecorder(SOS.stream, mt ? { mimeType: mt, videoBitsPerSecond: 3000000 } : { videoBitsPerSecond: 3000000 }); } catch (e) { SOS.toast('Recording could not start.', 3); return; }
    const chunks = [], rec = { mr: mr, t0: performance.now(), thumb: makeThumb(SOS.video) }; st.rec = rec;
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function () {
      const blob = new Blob(chunks, { type: mr.mimeType || mt || 'video/webm' }), item = { id: Date.now(), type: 'video', ts: Date.now(), dur: (performance.now() - rec.t0) / 1000, blob: blob, thumb: rec.thumb };
      MEDIA.add(item); if (st.rec === rec) st.rec = null; win.dirty = true; SOS.toast('Video saved to Gallery', 2.5); SOS.tick(900, 0.1, 0.08);
      if (st.auto) saveToPhone(item);
    };
    try { mr.start(1000); SOS.tick(700, 0.12, 0.08); } catch (e) { st.rec = null; SOS.toast('Recording could not start.', 3); }
  }
  function shoot(win) {
    const v = SOS.video, st = win.state; if (!v || !SOS.videoReady) return;
    const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
    const thumb = makeThumb(cv); st.flash = SOS.t; SOS.tick(1700, 0.06, 0.1); setTimeout(function () { SOS.tick(1100, 0.08, 0.08); }, 90);
    cv.toBlob(function (blob) { if (!blob) return; const item = { id: Date.now(), type: 'photo', ts: Date.now(), blob: blob, thumb: thumb }; MEDIA.add(item); win.dirty = true; if (st.auto) saveToPhone(item); }, 'image/jpeg', 0.92);
  }
  reg({
    id: 'camera', title: 'Camera', w: 1160, h: 680, animated: true,
    create(win) { win.state = { mode: 'photo', rec: null, flash: -9, auto: true }; MEDIA.load().then(function () { win.dirty = true; }); },
    onClose(win) { stopRec(win); },
    shoot() { const w = SOS.wins.camera; if (w && SOS.camState === 'on' && SOS.videoReady) { shoot(w); w.dirty = true; } else SOS.toast('Turn on the camera first.', 2.5); },
    tick(win) { const r = win.state.rec; if (r && performance.now() - r.t0 > 300000) stopRec(win); },
    draw(ui, win) {
      const c = ui.c, st = win.state, on = SOS.camState === 'on' && SOS.videoReady;
      ui.text('Camera', 48, 52, { size: 34, weight: 700 });
      const vx = 36, vy = 96, vw = 820, vh = 461;
      ui.rect(vx, vy, vw, vh, 26, 'rgba(0,0,0,.55)');
      if (on) { c.save(); rr(c, vx, vy, vw, vh, 26); c.clip(); coverDraw(c, SOS.video, vx, vy, vw, vh); if (SOS.t - st.flash < 0.25) { c.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - (SOS.t - st.flash) / 0.25)) + ')'; c.fillRect(vx, vy, vw, vh); } c.restore(); }
      else {
        ui.text(SOS.camState === 'asking' ? 'Asking for camera permission…' : 'The camera is off', vx + vw / 2, vy + vh / 2 - 40, { size: 32, align: 'center', weight: 600 });
        ui.text('Turn it on to take photos and videos.', vx + vw / 2, vy + vh / 2 + 6, { size: 24, align: 'center', color: WHITE2 });
        ui.btn('camon', vx + vw / 2 - 150, vy + vh / 2 + 50, 300, 62, { label: 'Turn on camera', size: 25, r: 31, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { SOS.enableCamera().then(function () { win.dirty = true; }); win.dirty = true; } });
      }
      if (st.rec) { const el = (performance.now() - st.rec.t0) / 1000; ui.rect(vx + 20, vy + 20, 150, 44, 22, 'rgba(0,0,0,.55)'); c.fillStyle = '#ff453a'; c.beginPath(); c.arc(vx + 44, vy + 42, 9, 0, 7); c.fill(); ui.text(pad(Math.floor(el / 60)) + ':' + pad(Math.floor(el % 60)), vx + 66, vy + 43, { size: 26, weight: 600 }); }
      // controls
      const px = 888, pw = 236;
      ['photo', 'video'].forEach(function (m, i) { const y = 104 + i * 66, id = 'm_' + m, sel = st.mode === m; ui.btn(id, px, y, pw, 56, { label: m === 'photo' ? 'Photo' : 'Video', size: 25, r: 28, fill: sel ? '#fff' : 'rgba(255,255,255,.1)', color: sel ? '#111' : '#fff', hoverFill: sel ? '#fff' : 'rgba(255,255,255,.22)', onClick: function () { if (!st.rec) { st.mode = m; win.dirty = true; } } }); if (sel) { /* colour fix for selected label */ } });
      const cx = px + pw / 2, cy = 330, hv = ui.hover('shutter');
      ui.hit('shutter', cx - 80, cy - 80, 160, 160, { noDwell: false, onClick: function () { if (!(SOS.camState === 'on' && SOS.videoReady)) { SOS.toast('Turn on the camera first.', 2.5); return; } if (st.mode === 'photo') shoot(win); else if (st.rec) stopRec(win); else startRec(win); win.dirty = true; } });
      c.save(); c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.arc(cx, cy, 68, 0, 7); c.stroke();
      if (st.mode === 'photo') { c.fillStyle = hv ? '#fff' : 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(cx, cy, hv ? 56 : 54, 0, 7); c.fill(); }
      else if (st.rec) { c.fillStyle = '#ff453a'; rr(c, cx - 28, cy - 28, 56, 56, 12); c.fill(); }
      else { c.fillStyle = hv ? '#ff6a60' : '#ff453a'; c.beginPath(); c.arc(cx, cy, hv ? 56 : 54, 0, 7); c.fill(); }
      c.restore();
      // last capture -> Gallery
      const last = MEDIA.items[0], tx = cx - 78, ty = 440;
      ui.hit('thumb', tx, ty, 156, 88, { onClick: function () { SOS.open('gallery'); } });
      ui.rect(tx, ty, 156, 88, 18, 'rgba(255,255,255,.1)', ui.hover('thumb') ? '#fff' : null, 3);
      const im = last && thumbImg(last); if (im) { c.save(); rr(c, tx, ty, 156, 88, 18); c.clip(); c.drawImage(im, tx, ty, 156, 88); c.restore(); } else ui.text('Gallery', cx, ty + 44, { size: 22, align: 'center', color: WHITE2, weight: 600 });
      ui.text('Also save to phone', px, 590, { size: 21, color: WHITE2 });
      ui.toggle('auto', px + pw - 84, 568, st.auto, function () { st.auto = !st.auto; win.dirty = true; });
    }
  });

  /* ---------- Gallery ---------- */
  function closeViewer(win) { const st = win.state; if (st.vid) { try { st.vid.pause(); st.vid.removeAttribute('src'); st.vid.load(); } catch (e) {} } if (st.url) { try { URL.revokeObjectURL(st.url); } catch (e) {} } st.vid = null; st.img = null; st.url = null; st.view = -1; st.confirm = false; win.scrollY = win.state.keepScroll || 0; }
  function openViewer(win, i) {
    const st = win.state, rec = MEDIA.items[i]; if (!rec) return; st.keepScroll = win.scrollY; closeViewer(win); st.keepScroll = 0;
    st.view = i; st.url = URL.createObjectURL(rec.blob); st.confirm = false;
    if (rec.type === 'photo') { const im = new Image(); im.onload = function () { win.dirty = true; }; im.src = st.url; st.img = im; }
    else { const v = document.createElement('video'); v.playsInline = true; v.loop = true; v.preload = 'auto'; v.src = st.url; v.onloadeddata = function () { win.dirty = true; }; v.play().catch(function () {}); st.vid = v; }
    win.scrollY = 0; win.dirty = true;
  }
  function containDraw(c, src, sw, sh, x, y, w, h) { const s = Math.min(w / sw, h / sh), dw = sw * s, dh = sh * s; c.drawImage(src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
  reg({
    id: 'gallery', title: 'Gallery', w: 1180, h: 700,
    create(win) { win.state = { view: -1, vid: null, img: null, url: null, confirm: false, keepScroll: 0, busy: false }; MEDIA.load().then(function () { win.dirty = true; }); },
    onOpen(win) { win.dirty = true; },
    onClose(win) { closeViewer(win); },
    tick(win) {
      const st = win.state;
      if (st.vid && !st.vid.paused) win.dirty = true;
      if (st.view < 0 && MEDIA.items.some(function (r) { const im = IMGS.get(r); return !im || !im.complete; })) { win._g = (win._g || 0) + 1; if (win._g % 10 === 0) win.dirty = true; }
    },
    draw(ui, win) {
      const c = ui.c, st = win.state, items = MEDIA.items;
      if (st.view >= 0 && items[st.view]) {
        const rec = items[st.view], mx = 140, my = 96, mw = 900, mh = 506;
        ui.btn('back', 36, 24, 130, 54, { label: '‹ Back', size: 24, r: 27, onClick: function () { closeViewer(win); win.dirty = true; } });
        ui.text(new Date(rec.ts).toLocaleString(), 190, 52, { size: 24, color: WHITE2, weight: 600 });
        ui.btn('save', win.w - 380, 24, 200, 54, { label: 'Save to phone', size: 22, r: 27, onClick: function () { if (st.busy) return; st.busy = true; saveToPhone(rec).then(function () { st.busy = false; }); } });
        ui.btn('del', win.w - 160, 24, 124, 54, { label: st.confirm ? 'Sure?' : 'Delete', size: 22, r: 27, fill: st.confirm ? '#ff453a' : 'rgba(255,255,255,.08)', hoverFill: st.confirm ? '#ff6a60' : undefined, onClick: function () { if (!st.confirm) { st.confirm = true; win.dirty = true; return; } const id = rec.id; closeViewer(win); MEDIA.del(id); win.dirty = true; } });
        ui.rect(mx, my, mw, mh, 26, 'rgba(0,0,0,.6)');
        c.save(); rr(c, mx, my, mw, mh, 26); c.clip();
        if (st.img && st.img.complete && st.img.naturalWidth) containDraw(c, st.img, st.img.naturalWidth, st.img.naturalHeight, mx, my, mw, mh);
        else if (st.vid && st.vid.readyState >= 2) containDraw(c, st.vid, st.vid.videoWidth, st.vid.videoHeight, mx, my, mw, mh);
        else ui.text('Loading…', mx + mw / 2, my + mh / 2, { size: 28, align: 'center', color: WHITE2 });
        c.restore();
        ui.btn('prev', 36, 300, 84, 110, { label: '‹', size: 56, r: 30, onClick: function () { openViewer(win, (st.view + 1) % items.length); } });
        ui.btn('next', win.w - 120, 300, 84, 110, { label: '›', size: 56, r: 30, onClick: function () { openViewer(win, (st.view - 1 + items.length) % items.length); } });
        if (st.vid) {
          const v = st.vid, dur = isFinite(v.duration) && v.duration > 0 ? v.duration : (rec.dur || 1);
          ui.btn('pp', mx, 622, 96, 56, { label: v.paused ? '▶' : '❚❚', size: 26, r: 28, onClick: function () { if (v.paused) v.play().catch(function () {}); else v.pause(); win.dirty = true; } });
          ui.slider('seek', mx + 130, 650, mw - 270, clamp(v.currentTime, 0, dur), 0, dur, function (t) { try { v.currentTime = t; } catch (e) {} win.dirty = true; });
          ui.text(pad(Math.floor(v.currentTime / 60)) + ':' + pad(Math.floor(v.currentTime % 60)), mx + mw, 650, { size: 22, align: 'right', color: WHITE2 });
        } else ui.text((st.view + 1) + ' / ' + items.length, win.w / 2, 650, { size: 22, align: 'center', color: WHITE2 });
        return;
      }
      ui.text('Gallery', 48, 52, { size: 34, weight: 700 });
      ui.text(items.length + (items.length === 1 ? ' item' : ' items'), 200, 54, { size: 22, color: WHITE2 });
      ui.btn('cam', win.w - 200, 24, 164, 54, { label: 'Camera', size: 23, r: 27, fill: '#0a84ff', hoverFill: '#2b95ff', onClick: function () { SOS.open('camera'); } });
      if (!MEDIA.loaded) { ui.text('Loading…', win.w / 2, 360, { size: 28, align: 'center', color: WHITE2 }); return; }
      if (!items.length) {
        ui.text('No photos or videos yet', win.w / 2, 320, { size: 34, align: 'center', weight: 600 }); ui.text('Take one with the Camera app.', win.w / 2, 370, { size: 24, align: 'center', color: WHITE2 });
        ui.btn('cam2', win.w / 2 - 130, 410, 260, 62, { label: 'Open Camera', size: 25, r: 31, onClick: function () { SOS.open('camera'); } }); return;
      }
      const cols = 5, tw = 200, th = 113, gap = 22, rows = Math.ceil(items.length / cols), contentH = 100 + rows * (th + gap) + 10;
      ui.scroll(36, 96, win.w - 56, win.h - 112, contentH - 96, function () {
        items.forEach(function (rec, i) {
          const x = 36 + (i % cols) * (tw + gap), y = 108 + Math.floor(i / cols) * (th + gap), id = 'it' + i, hv = ui.hover(id);
          ui.hit(id, x, y, tw, th, { onClick: function () { openViewer(win, i); } });
          ui.rect(x, y, tw, th, 16, 'rgba(255,255,255,.08)');
          const im = thumbImg(rec); if (im) { c.save(); rr(c, x, y, tw, th, 16); c.clip(); c.drawImage(im, x, y, tw, th); c.restore(); }
          if (rec.type === 'video') { ui.rect(x + 10, y + th - 38, 92, 28, 14, 'rgba(0,0,0,.6)'); ui.text('▶ ' + pad(Math.floor((rec.dur || 0) / 60)) + ':' + pad(Math.floor((rec.dur || 0) % 60)), x + 56, y + th - 23, { size: 18, align: 'center', weight: 600 }); }
          if (hv) ui.rect(x, y, tw, th, 16, 'rgba(255,255,255,.14)', '#fff', 3);
        });
      });
    }
  });
})();
