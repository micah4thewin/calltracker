/*
 * This file is part of Call Tracker.
 *
 * Copyright (C) 2024-2026 Micah Levason.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

/* ===========================================================================
 * ui.js — toasts, modals, confetti, sound and clipboard.
 * Hand-rolled so the app ships with zero third-party code and makes zero
 * network requests. Sounds are synthesised, not downloaded.
 * ======================================================================== */

var CT = window.CT || (window.CT = {});

(function () {
  'use strict';

  /* --------------------------------------------------------------------
   * DOM helpers
   * ------------------------------------------------------------------ */
  CT.$ = function (sel, root) { return (root || document).querySelector(sel); };
  CT.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  CT.el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  };

  CT.reduceMotion = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  CT.fmtDuration = function (sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return h ? h + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s);
  };

  CT.fmtClock = function (iso) {
    if (!iso) return '--:--';
    var d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  CT.fmtMoney = function (n) {
    n = Number(n) || 0;
    return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  CT.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  /* --------------------------------------------------------------------
   * Toasts
   * ------------------------------------------------------------------ */
  var toastRoot;
  CT.toast = function (opts) {
    if (!toastRoot) toastRoot = CT.$('#toasts');
    if (!toastRoot) return;
    var t = CT.el('div', { class: 'toast toast--' + (opts.tone || 'ok'), role: 'status' }, [
      CT.el('span', { class: 'toast__icon', text: opts.icon || '✔' }),
      CT.el('div', { class: 'toast__body' }, [
        CT.el('div', { class: 'toast__title', text: opts.title || '' }),
        opts.text ? CT.el('div', { class: 'toast__text', text: opts.text }) : null
      ])
    ]);
    toastRoot.appendChild(t);
    // Keep the stack short so the screen never floods mid-call.
    while (toastRoot.children.length > 3) toastRoot.removeChild(toastRoot.firstChild);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, opts.timeout || 2400);
  };

  /* --------------------------------------------------------------------
   * Modals
   * ------------------------------------------------------------------ */
  var openModals = [];

  CT.modal = function (opts) {
    var root = CT.$('#modalRoot');
    var lastFocus = document.activeElement;

    var body = CT.el('div', { class: 'modal__body' });
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    var footer = null;
    if (opts.actions && opts.actions.length) {
      footer = CT.el('div', { class: 'modal__footer' }, opts.actions.map(function (a) {
        return CT.el('button', {
          class: 'btn ' + (a.tone ? 'btn--' + a.tone : 'btn--ghost'),
          type: 'button',
          onclick: function () { if (!a.onClick || a.onClick() !== false) close(); }
        }, [a.label]);
      }));
    }

    var card = CT.el('div', {
      class: 'modal__card' + (opts.wide ? ' modal__card--wide' : ''),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog'
    }, [
      CT.el('div', { class: 'modal__head' }, [
        CT.el('h2', { class: 'modal__title', text: opts.title || '' }),
        CT.el('button', { class: 'modal__x', type: 'button', 'aria-label': 'Close', onclick: function () { close(); } }, ['×'])
      ]),
      body,
      footer
    ]);

    var scrim = CT.el('div', { class: 'modal' }, [card]);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim && opts.dismissable !== false) close(); });
    root.appendChild(scrim);
    document.body.classList.add('has-modal');
    openModals.push(close);

    requestAnimationFrame(function () {
      scrim.classList.add('is-in');
      var focusTarget = card.querySelector('[data-autofocus]') || card.querySelector('.modal__footer .btn') || card.querySelector('.modal__x');
      if (focusTarget) focusTarget.focus();
    });

    function close() {
      var i = openModals.indexOf(close);
      if (i === -1) return;
      openModals.splice(i, 1);
      scrim.classList.remove('is-in');
      setTimeout(function () {
        if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
        if (!openModals.length) document.body.classList.remove('has-modal');
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }, 180);
      if (opts.onClose) opts.onClose();
    }

    return { close: close, card: card, body: body };
  };

  CT.closeTopModal = function () {
    if (openModals.length) openModals[openModals.length - 1]();
    return openModals.length > 0;
  };
  CT.modalOpen = function () { return openModals.length > 0; };

  CT.confirm = function (opts) {
    return new Promise(function (resolve) {
      var settled = false;
      var done = function (v) { if (!settled) { settled = true; resolve(v); } };
      CT.modal({
        title: opts.title || 'Are you sure?',
        body: CT.el('p', { class: 'modal__lead', text: opts.text || '' }),
        onClose: function () { done(false); },
        actions: [
          { label: opts.cancelLabel || 'Cancel', tone: 'ghost', onClick: function () { done(false); } },
          { label: opts.confirmLabel || 'Confirm', tone: opts.tone || 'danger', onClick: function () { done(true); } }
        ]
      });
    });
  };

  CT.prompt = function (opts) {
    return new Promise(function (resolve) {
      var input = opts.multiline
        ? CT.el('textarea', { class: 'field field--area', rows: opts.rows || 5, 'data-autofocus': true })
        : CT.el('input', { class: 'field', type: opts.type || 'text', 'data-autofocus': true });
      input.value = opts.value || '';
      var settled = false;
      var done = function (v) { if (!settled) { settled = true; resolve(v); } };
      var m = CT.modal({
        title: opts.title || '',
        body: CT.el('div', {}, [
          opts.text ? CT.el('p', { class: 'modal__lead', text: opts.text }) : null,
          input
        ]),
        onClose: function () { done(null); },
        actions: [
          { label: 'Cancel', tone: 'ghost', onClick: function () { done(null); } },
          { label: opts.confirmLabel || 'Save', tone: 'primary', onClick: function () { done(input.value); } }
        ]
      });
      if (!opts.multiline) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); done(input.value); m.close(); }
        });
      }
    });
  };

  /* --------------------------------------------------------------------
   * Clipboard — secure-context API first, execCommand second, and a
   * select-it-yourself modal as the guaranteed last resort.
   * ------------------------------------------------------------------ */
  function legacyCopy(text) {
    var ta = CT.el('textarea', { class: 'sr-clip' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  CT.copy = function (text, label) {
    var announce = function (ok) {
      if (ok) {
        CT.sound('copy');
        CT.toast({ icon: '\u{1F4CB}', title: label || 'Copied — paste it in Teams', tone: 'ok' });
      } else {
        CT.copyFallback(text);
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text)
        .then(function () { announce(true); return true; })
        .catch(function () { var ok = legacyCopy(text); announce(ok); return ok; });
    }
    var ok = legacyCopy(text);
    announce(ok);
    return Promise.resolve(ok);
  };

  CT.copyFallback = function (text) {
    var ta = CT.el('textarea', { class: 'field field--area field--mono', rows: 10, readonly: true, 'data-autofocus': true });
    ta.value = text;
    CT.modal({
      title: 'Copy this manually',
      body: CT.el('div', {}, [
        CT.el('p', { class: 'modal__lead', text: 'Your browser blocked the clipboard. Everything is selected — hit Ctrl+C.' }),
        ta
      ]),
      actions: [{ label: 'Done', tone: 'primary' }]
    });
    setTimeout(function () { ta.focus(); ta.select(); }, 60);
  };

  /* --------------------------------------------------------------------
   * Sound — synthesised with WebAudio. No files, no requests, off by
   * default because nobody wants chiptunes leaking into a live call.
   * ------------------------------------------------------------------ */
  var actx = null;
  function ctx() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  var TONES = {
    on:      { seq: [[660, 0.05], [990, 0.07]], gain: 0.05, type: 'square' },
    off:     { seq: [[420, 0.06]], gain: 0.035, type: 'sine' },
    combo:   { seq: [[660, 0.05], [880, 0.05], [1320, 0.09]], gain: 0.06, type: 'square' },
    core:    { seq: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.16]], gain: 0.07, type: 'square' },
    level:   { seq: [[523, 0.09], [784, 0.09], [1047, 0.09], [1319, 0.24]], gain: 0.08, type: 'sawtooth' },
    trophy:  { seq: [[880, 0.07], [1109, 0.07], [1319, 0.18]], gain: 0.07, type: 'triangle' },
    copy:    { seq: [[1200, 0.03]], gain: 0.03, type: 'sine' },
    start:   { seq: [[392, 0.07], [523, 0.11]], gain: 0.05, type: 'triangle' },
    end:     { seq: [[523, 0.08], [392, 0.14]], gain: 0.05, type: 'triangle' },
    alert:   { seq: [[300, 0.12], [240, 0.16]], gain: 0.05, type: 'sawtooth' }
  };

  CT.sound = function (name) {
    if (!CT.state.settings.sound) return;
    var spec = TONES[name];
    if (!spec) return;
    var ac = ctx();
    if (!ac) return;
    var t = ac.currentTime;
    spec.seq.forEach(function (step) {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(step[0], t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(spec.gain, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + step[1]);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + step[1] + 0.02);
      t += step[1];
    });
  };

  /* --------------------------------------------------------------------
   * Confetti — one canvas, particles, no library.
   * ------------------------------------------------------------------ */
  var canvas, cctx, particles = [], rafId = null;

  function ensureCanvas() {
    if (canvas) return;
    canvas = CT.$('#confetti');
    if (!canvas) return;
    cctx = canvas.getContext('2d');
    var resize = function () {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  CT.confetti = function (amount, palette) {
    if (!CT.state.settings.confetti || CT.reduceMotion()) return;
    ensureCanvas();
    if (!cctx) return;
    var colors = palette || ['#e20074', '#ff3ea5', '#22d3ee', '#a3e635', '#fbbf24', '#ffffff'];
    var n = amount || 90;
    for (var i = 0; i < n; i++) {
      particles.push({
        x: canvas.width * (0.15 + Math.random() * 0.7),
        y: canvas.height * 0.35 + (Math.random() - 0.5) * 120,
        vx: (Math.random() - 0.5) * 11,
        vy: -6 - Math.random() * 9,
        g: 0.26 + Math.random() * 0.14,
        w: 4 + Math.random() * 6,
        h: 6 + Math.random() * 9,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        life: 90 + Math.random() * 50,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    if (!rafId) rafId = requestAnimationFrame(step);
  };

  function step() {
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(function (p) { return p.life > 0 && p.y < canvas.height + 60; });
    particles.forEach(function (p) {
      p.life--;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.995;
      p.rot += p.vr;
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.globalAlpha = Math.max(0, Math.min(1, p.life / 45));
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cctx.restore();
    });
    if (particles.length) {
      rafId = requestAnimationFrame(step);
    } else {
      cctx.clearRect(0, 0, canvas.width, canvas.height);
      rafId = null;
    }
  }

  /* Screen-wide flash used for big moments. */
  CT.flash = function (tone) {
    if (CT.reduceMotion()) return;
    var f = CT.el('div', { class: 'screenflash screenflash--' + (tone || 'mag') });
    document.body.appendChild(f);
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 620);
  };

  /* Floating "+12 XP" chip that drifts off a node. */
  CT.floatXp = function (node, text, tone) {
    if (!node || CT.reduceMotion()) return;
    var rect = node.getBoundingClientRect();
    var chip = CT.el('div', { class: 'xpfloat ' + (tone ? 'xpfloat--' + tone : ''), text: text });
    chip.style.left = (rect.left + rect.width / 2) + 'px';
    chip.style.top = (rect.top) + 'px';
    document.body.appendChild(chip);
    setTimeout(function () { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 1100);
  };

  /* Download a blob without touching the network. */
  CT.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = CT.el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };
})();
