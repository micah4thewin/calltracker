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
 * app.js — wiring, rendering and the game loop.
 * ======================================================================== */

var CT = window.CT || (window.CT = {});

(function () {
  'use strict';

  var $ = CT.$, el = CT.el;

  /* Live session state (not persisted except through CT.state.activeCall). */
  var call = null;
  var pending = null;          // intake answers before the call starts
  var tick = null;
  var holdStartedAt = null;
  var momentum = 1;
  var warned15 = false;
  var lastRecap = '';

  /* ====================================================================
   * INTAKE (pre-call)
   * ================================================================== */
  function freshPending() {
    return { raw: '', verified: null, escalated: false, cancelIntent: false, reason: null };
  }

  function pendingAsCall() {
    var c = CT.blankCall();
    c.identifier = { type: CT.detectIdType(pending.raw), raw: pending.raw, norm: CT.normalizeId(pending.raw) };
    c.reason = pending.reason;
    c.flags.verified = pending.verified;
    c.flags.escalated = pending.escalated;
    c.flags.cancelIntent = pending.cancelIntent;
    return c;
  }

  /* ====================================================================
   * TEAMS TEMPLATES
   * ================================================================== */
  function templateText(id) {
    var t = CT.TEMPLATES.filter(function (x) { return x.id === id; })[0];
    if (!t) return '';
    return CT.state.templates[id] || t.text;
  }

  function buildRef(target) {
    var c = target || call || (pending ? pendingAsCall() : null);
    var bits = [];
    if (c) {
      bits.push(c.identifier && c.identifier.raw ? CT.idLabel(c) : 'no customer ID yet');
      if (c.reason) bits.push((CT.REASON_BY_ID[c.reason] || {}).name);
    }
    bits.push(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    return '[' + bits.join(' · ') + ']';
  }

  function fillTemplate(id, target) {
    var amount = target && target.collectedAmount ? CT.fmtMoney(target.collectedAmount)
      : (call && call.collectedAmount ? CT.fmtMoney(call.collectedAmount) : 'a payment');
    return templateText(id)
      .replace('{ref}', buildRef(target))
      .replace('{amount}', amount)
      .replace('{quip}', CT.pick(CT.MONEY_QUIPS))
      .trim();
  }

  function fireTemplate(id, target) {
    var t = CT.TEMPLATES.filter(function (x) { return x.id === id; })[0];
    CT.copy(fillTemplate(id, target), (t ? t.label : 'Message') + ' copied — paste in Teams');
  }

  /* ====================================================================
   * SEGMENTED CONTROLS
   * ================================================================== */
  function segment(opts) {
    // opts: { value, tri, yes, no, onChange }
    var wrap = el('div', { class: 'seg', role: 'group' });
    var mk = function (val, label, tone) {
      var b = el('button', {
        class: 'seg__btn seg__btn--' + tone + (opts.value === val ? ' is-on' : ''),
        type: 'button',
        'aria-pressed': opts.value === val ? 'true' : 'false',
        onclick: function () { opts.onChange(opts.value === val && opts.clearable ? null : val); }
      }, [label]);
      return b;
    };
    wrap.appendChild(mk(true, opts.yes || 'Yes', 'yes'));
    wrap.appendChild(mk(false, opts.no || 'No', 'no'));
    if (opts.tri) wrap.appendChild(mk(null, '?', 'unk'));
    return wrap;
  }

  /* ====================================================================
   * RENDER — top bar
   * ================================================================== */
  function renderTop() {
    var rank = CT.rankFor(CT.state.profile.xp);
    $('#rankBadge').textContent = rank.level;
    $('#rankTitle').textContent = rank.title;
    $('#xpFill').style.width = rank.pct + '%';
    $('#xpText').textContent = CT.state.profile.xp.toLocaleString() + ' XP · ' + (rank.ceil - CT.state.profile.xp).toLocaleString() + ' to LV.' + (rank.level + 1);

    var today = CT.callsForDay();
    var st = CT.computeStats(today);
    $('#statCalls').textContent = today.length;
    $('#statStreak').textContent = CT.state.profile.streak;
    $('#statScore').textContent = st.avgScore + '%';
    $('#statResolved').textContent = st.resolutionRate + '%';
    $('#btnSound').textContent = CT.state.settings.sound ? '\u{1F50A}' : '\u{1F507}';
    $('#btnSound').setAttribute('aria-label', 'Sound ' + (CT.state.settings.sound ? 'on' : 'off'));

    var flame = $('#streakFlame');
    flame.classList.toggle('is-hot', CT.state.profile.streak >= 3);
  }

  /* ====================================================================
   * RENDER — console (idle intake / live call)
   * ================================================================== */
  function renderConsole() {
    var idle = $('#idleView'), live = $('#liveView');
    idle.hidden = !!call;
    live.hidden = !call;
    document.body.classList.toggle('mode-call', !!call);
    if (call) renderLive(); else renderIdle();
  }

  function renderIdle() {
    var input = $('#callIdInput');
    if (input.value !== pending.raw) input.value = pending.raw;

    var type = CT.detectIdType(pending.raw);
    var hint = $('#idHint');
    hint.textContent = !pending.raw
      ? 'Blank is fine — the call logs as an unidentified caller.'
      : (type === 'phone' ? 'Looks like a phone number. Matched on the last 10 digits.'
        : type === 'account' ? 'Looks like an account number.'
          : 'Saved as a free-form reference.');

    // Repeat-caller lookup preview
    var prior = CT.findPrior(CT.normalizeId(pending.raw));
    var box = $('#priorPreview');
    box.innerHTML = '';
    if (prior.length) {
      var lastCall = prior[0];
      var since = lastCall.startedAt ? timeAgo(lastCall.startedAt) : 'earlier';
      box.appendChild(el('div', { class: 'alertbox alertbox--warn' }, [
        el('div', { class: 'alertbox__title', text: '\u{1F501} REPEAT CALLER — ' + prior.length + ' prior call' + (prior.length === 1 ? '' : 's') }),
        el('div', { class: 'alertbox__text', text: 'Last one ' + since + ' about ' +
          (lastCall.reason ? (CT.REASON_BY_ID[lastCall.reason] || {}).name : 'an unlogged reason') +
          ' — ' + (lastCall.flags.resolved === true ? 'marked resolved.' : 'was NOT resolved.') }),
        lastCall.notes ? el('div', { class: 'alertbox__note', text: '“' + lastCall.notes + '”' }) : null,
        el('div', { class: 'alertbox__text alertbox__text--dim', text: 'Read the last call before you read the customer.' })
      ]));
      box.hidden = false;
    } else {
      box.hidden = true;
    }

    // Intake questions
    var qs = $('#intakeQuestions');
    qs.innerHTML = '';
    qs.appendChild(intakeRow('Is the customer verified?', segment({
      value: pending.verified, yes: '\u{1F513} Verified', no: '\u{1F512} Not verified',
      onChange: function (v) { pending.verified = v; renderIdle(); CT.sound('on'); }
    }), pending.verified === null ? 'Answer this before you touch the account.' : null, pending.verified === null));

    qs.appendChild(intakeRow('Escalated caller?', segment({
      value: pending.escalated, yes: '\u{1F525} Escalated', no: 'Calm',
      onChange: function (v) {
        pending.escalated = v;
        if (v === true) { fireTemplate('escalated'); CT.sound('alert'); }
        renderIdle();
      }
    }), pending.escalated ? 'Heads-up copied for Teams.' : null));

    qs.appendChild(intakeRow('Cancel / port-out call?', segment({
      value: pending.cancelIntent, yes: '\u{1F6AA} Cancel call', no: 'Not cancelling',
      onChange: function (v) {
        pending.cancelIntent = v;
        if (v === true) {
          pending.reason = pending.reason || 'cancel';
          fireTemplate('cancel');
          CT.sound('alert');
        }
        renderIdle();
      }
    }), pending.cancelIntent ? 'Churn heads-up copied for Teams.' : null));

    renderReasonChips($('#reasonChips'), pending.reason, function (id) {
      pending.reason = pending.reason === id ? null : id;
      renderIdle();
    });
  }

  function intakeRow(label, control, note, alert) {
    return el('div', { class: 'intake' + (alert ? ' intake--alert' : '') }, [
      el('div', { class: 'intake__label', text: label }),
      control,
      note ? el('div', { class: 'intake__note', text: note }) : null
    ]);
  }

  function renderReasonChips(container, selected, onPick) {
    container.innerHTML = '';
    CT.REASONS.forEach(function (r) {
      container.appendChild(el('button', {
        class: 'chip' + (selected === r.id ? ' is-on' : ''),
        type: 'button', title: r.name,
        onclick: function () { onPick(r.id); }
      }, [el('span', { class: 'chip__icon', text: r.icon }), el('span', { text: r.name })]));
    });
  }

  function timeAgo(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'seconds ago';
    if (mins < 60) return mins + ' min ago';
    var h = Math.round(mins / 60);
    if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
    var d = Math.round(h / 24);
    return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  }

  /* ====================================================================
   * RENDER — live call panel
   * ================================================================== */
  function renderLive() {
    $('#liveId').textContent = CT.idLabel(call);
    var rep = $('#liveRepeat');
    rep.hidden = !(call.repeatOf > 0);
    rep.textContent = 'REPEAT x' + (call.repeatOf + 1);

    $('#liveReasonLabel').textContent = call.reason ? (CT.REASON_BY_ID[call.reason] || {}).name : 'Pick a reason';
    $('#liveNotes').value = call.notes || '';
    $('#liveSub').value = call.subReason || '';
    $('#liveTenure').value = (call.tenureYears === null || call.tenureYears === undefined) ? '' : call.tenureYears;

    renderFlags();
    updateTimer();
  }

  function renderFlags() {
    var host = $('#flagList');
    host.innerHTML = '';
    CT.FLAGS.forEach(function (f) {
      if (typeof f.showIf === 'function' && !f.showIf(call)) return;
      var value = call.flags[f.id];
      var rowEl = el('div', {
        class: 'flag' + (f.critical && value === null ? ' flag--todo' : '') +
               (f.id === 'resolved' && value === true ? ' flag--good' : '') +
               (f.id === 'resolved' && value !== true ? ' flag--warn' : '')
      }, [
        el('div', { class: 'flag__label' }, [
          el('span', { text: f.label }),
          el('span', { class: 'flag__hint', text: f.hint })
        ]),
        segment({
          value: value, tri: f.tri, yes: f.yes, no: f.no,
          onChange: function (v) { setFlag(f, v); }
        })
      ]);
      host.appendChild(rowEl);

      if (f.id === 'collected' && call.flags.collected === true) {
        host.appendChild(el('div', { class: 'flag flag--sub' }, [
          el('label', { class: 'flag__label', for: 'collectAmt', text: 'How much did you collect?' }),
          el('input', {
            class: 'field field--sm', id: 'collectAmt', type: 'number', min: '0', step: '0.01',
            value: call.collectedAmount || '',
            oninput: function (e) { call.collectedAmount = Number(e.target.value) || 0; persistActive(); }
          })
        ]));
      }
    });
  }

  /* A behavior that stops applying (reason changed, past due cleared) should
   * not keep scoring or earning XP in the background. */
  function pruneInapplicable() {
    if (!call) return;
    var allowed = CT.applicableBehaviors(call).map(function (b) { return b.id; });
    call.behaviors = call.behaviors.filter(function (id) { return allowed.indexOf(id) !== -1; });
    call.coreCombo = CT.hasCoreCombo(call);
    call.score = CT.scoreCall(call);
  }

  function setFlag(f, v) {
    var was = call.flags[f.id];
    call.flags[f.id] = v;

    if (f.id === 'pastDue' && v !== true) {
      call.flags.hasArrangement = null;
      call.flags.collected = false;
      call.collectedAmount = 0;
    }
    if (f.id === 'verified') toggleBehaviorById('verifyCustomer', v === true);

    if (f.alertOn && v === true && was !== true && f.template) {
      if (f.id === 'collected') {
        CT.prompt({
          title: 'Nice. How much?', text: 'Just the number — it stays on this device.',
          type: 'number', value: call.collectedAmount || '', confirmLabel: 'Log it'
        }).then(function (val) {
          if (val !== null) call.collectedAmount = Number(val) || 0;
          fireTemplate('collected');
          CT.confetti(70, ['#a3e635', '#fbbf24', '#22d3ee', '#ffffff']);
          CT.sound('trophy');
          renderAll();
          persistActive();
        });
      } else {
        fireTemplate(f.template);
        CT.sound('alert');
      }
    }
    if (f.id === 'resolved' && v === true && was !== true) {
      CT.sound('combo');
      CT.floatXp($('#flagList'), 'RESOLVED', 'good');
    }
    pruneInapplicable();
    renderAll();
    persistActive();
  }

  /* ====================================================================
   * TIMER
   * ================================================================== */
  function elapsed() {
    if (!call || !call.startedAt) return 0;
    return Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000);
  }

  function currentHold() {
    return (call.holdSeconds || 0) + (holdStartedAt ? Math.floor((Date.now() - holdStartedAt) / 1000) : 0);
  }

  function updateTimer() {
    if (!call) return;
    var sec = elapsed();
    var t = $('#callTimer');
    t.textContent = CT.fmtDuration(sec);
    t.classList.toggle('is-warn', sec >= 8 * 60 && sec < 15 * 60);
    t.classList.toggle('is-hot', sec >= 15 * 60);

    var hold = currentHold();
    $('#holdReadout').textContent = hold ? 'hold ' + CT.fmtDuration(hold) : '';
    $('#btnHold').classList.toggle('is-on', !!holdStartedAt);
    $('#btnHold').textContent = holdStartedAt ? '▶ Resume' : '⏸ Hold';
    document.body.classList.toggle('is-holding', !!holdStartedAt);

    if (sec >= 15 * 60 && !warned15) {
      warned15 = true;
      CT.toast({ icon: '⏱', title: '15 minutes in', text: 'Check in with the customer — tell them where you are.', tone: 'warn', timeout: 6000 });
      CT.sound('alert');
    }
  }

  function startTicking() {
    stopTicking();
    tick = setInterval(function () {
      updateTimer();
      persistActive(true);
    }, 1000);
  }
  function stopTicking() { if (tick) { clearInterval(tick); tick = null; } }

  /* ====================================================================
   * QUEST BOARD (behaviors)
   * ================================================================== */
  function renderBoard() {
    var host = $('#board');
    host.innerHTML = '';

    if (!call) {
      host.appendChild(renderReadyState());
      return;
    }

    CT.PHASES.forEach(function (phase) {
      var items = CT.BEHAVIORS.filter(function (b) { return b.phase === phase.id; });
      var visible = items.filter(function (b) { return typeof b.applies !== 'function' || b.applies(call); });
      if (!visible.length) return;
      var done = visible.filter(function (b) { return call.behaviors.indexOf(b.id) !== -1; }).length;

      var group = el('section', { class: 'phase', 'data-phase': phase.id }, [
        el('header', { class: 'phase__head' }, [
          el('span', { class: 'phase__icon', text: phase.icon }),
          el('h3', { class: 'phase__name', text: phase.name }),
          el('span', { class: 'phase__count', text: done + '/' + visible.length }),
          el('span', { class: 'phase__blurb', text: phase.blurb })
        ])
      ]);

      var list = el('div', { class: 'phase__items' });
      visible.forEach(function (b) { list.appendChild(behaviorCard(b)); });
      group.appendChild(list);
      host.appendChild(group);
    });

    renderNudge();
  }

  function behaviorCard(b) {
    var on = call.behaviors.indexOf(b.id) !== -1;
    var card = el('button', {
      class: 'bcard' + (on ? ' is-on' : '') + (b.core ? ' bcard--core' : ''),
      type: 'button',
      'aria-pressed': on ? 'true' : 'false',
      'data-behavior': b.id,
      title: b.hint,
      onclick: function () { toggleBehavior(b.id, card); }
    }, [
      el('span', { class: 'bcard__key', text: CT.state.settings.hotkeys ? b.key.toUpperCase() : '' }),
      el('span', { class: 'bcard__icon', text: b.icon }),
      el('span', { class: 'bcard__name', text: b.name }),
      el('span', { class: 'bcard__xp', text: '+' + b.xp }),
      b.core ? el('span', { class: 'bcard__core', text: 'CORE' }) : null,
      el('span', { class: 'bcard__script', text: CT.pick(b.scripts) })
    ]);
    return card;
  }

  function nextBest() {
    if (!call) return null;
    var order = ['open', 'discover', 'solve', 'close'];
    var pool = CT.applicableBehaviors(call).filter(function (b) { return call.behaviors.indexOf(b.id) === -1; });
    pool.sort(function (a, b) {
      if (a.core !== b.core) return a.core ? -1 : 1;
      return order.indexOf(a.phase) - order.indexOf(b.phase);
    });
    return pool[0] || null;
  }

  function renderNudge() {
    var host = $('#nudge');
    host.innerHTML = '';
    if (!call) { host.hidden = true; return; }
    var b = nextBest();
    host.hidden = false;
    if (!b) {
      host.appendChild(el('div', { class: 'nudge__done' }, [
        el('strong', { text: 'Everything on the board is done.' }),
        el('span', { text: ' Close it out and end the call.' })
      ]));
      return;
    }
    host.appendChild(el('div', { class: 'nudge__inner' }, [
      el('span', { class: 'nudge__tag', text: 'DO THIS NEXT' }),
      el('span', { class: 'nudge__icon', text: b.icon }),
      el('div', { class: 'nudge__body' }, [
        el('div', { class: 'nudge__name', text: b.name + (CT.state.settings.hotkeys ? '  [' + b.key.toUpperCase() + ']' : '') }),
        el('div', { class: 'nudge__script', text: '“' + CT.pick(b.scripts) + '”' })
      ]),
      el('button', {
        class: 'btn btn--ghost btn--sm', type: 'button',
        onclick: function () { CT.copy('“' + CT.pick(b.scripts) + '”', 'Script copied'); }
      }, ['Copy line'])
    ]));
  }

  function renderReadyState() {
    var todays = CT.callsForDay();
    var adoption = CT.behaviorAdoption(CT.callsInScope('week'));
    var weak = adoption.filter(function (a) { return a.pct !== null && a.n >= 3; })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, 3);

    return el('div', { class: 'ready' }, [
      el('div', { class: 'ready__glyph', text: '◤' }),
      el('h2', { class: 'ready__title', text: todays.length ? 'Ready for the next one' : 'Ready when you are' }),
      el('p', { class: 'ready__sub', text: CT.pick(CT.IDLE_TIPS) }),
      weak.length ? el('div', { class: 'ready__focus' }, [
        el('h4', { text: 'Your weakest behaviors this week' }),
        el('div', { class: 'ready__bars' }, weak.map(function (w) {
          return el('div', { class: 'minibar' }, [
            el('span', { class: 'minibar__label', text: w.short }),
            el('span', { class: 'minibar__track' }, [el('span', { class: 'minibar__fill', style: 'width:' + w.pct + '%' })]),
            el('span', { class: 'minibar__pct', text: w.pct + '%' })
          ]);
        }))
      ]) : null,
      el('p', { class: 'ready__hint', text: CT.state.settings.hotkeys ? 'Tip: press / to jump to the ID field, then Enter to start.' : '' })
    ]);
  }

  /* ====================================================================
   * BEHAVIOR TOGGLING
   * ================================================================== */
  function toggleBehaviorById(id, force) {
    if (!call) return;
    var has = call.behaviors.indexOf(id) !== -1;
    if (force === true && has) return;
    if (force === false && !has) return;
    var node = document.querySelector('[data-behavior="' + id + '"]');
    toggleBehavior(id, node, force);
  }

  function toggleBehavior(id, node, force) {
    if (!call) return;
    var b = CT.BEHAVIOR_BY_ID[id];
    if (!b) return;
    var idx = call.behaviors.indexOf(id);
    var turningOn = force === undefined ? idx === -1 : force;

    if (turningOn && idx === -1) {
      call.behaviors.push(id);
      momentum = Math.min(2, Math.round((momentum + 0.1) * 100) / 100);
      call.maxCombo = Math.max(call.maxCombo || 1, momentum);
      CT.sound('on');
      if (node) CT.floatXp(node, '+' + Math.round(b.xp * momentum) + ' XP');
      CT.toast({ icon: b.icon, title: CT.pick(b.cheers), tone: 'ok', timeout: 1600 });

      if (CT.hasCoreCombo(call) && !call.coreCombo) {
        call.coreCombo = true;
        CT.sound('core');
        CT.flash('mag');
        CT.confetti(60);
        CT.toast({ icon: '⭐', title: 'CORE 5 COMBO', text: 'Restate · Audit · Balance · Guarantee · No-callback', tone: 'gold', timeout: 3200 });
      }
      if (CT.hasSDL(call) && !call._sdlCelebrated) {
        call._sdlCelebrated = true;
        CT.sound('combo');
        CT.toast({ icon: '\u{1F9ED}', title: 'SDL TRIAGE COMPLETE', text: 'Situation · Duration · Location', tone: 'cyan', timeout: 2600 });
      }
    } else if (!turningOn && idx !== -1) {
      call.behaviors.splice(idx, 1);
      call.coreCombo = CT.hasCoreCombo(call);
      CT.sound('off');
    } else {
      return;
    }

    call.score = CT.scoreCall(call);
    renderBoard();
    renderProgress();
    persistActive();
  }

  function renderProgress() {
    if (!call) {
      $('#progressRing').style.setProperty('--pct', 0);
      $('#progressPct').textContent = '0%';
      $('#progressCount').textContent = '0 / 0';
      $('#momentum').textContent = '';
      $('#coreTrack').innerHTML = '';
      return;
    }
    var app = CT.applicableBehaviors(call);
    var done = app.filter(function (b) { return call.behaviors.indexOf(b.id) !== -1; }).length;
    var p = app.length ? Math.round((done / app.length) * 100) : 0;
    $('#progressRing').style.setProperty('--pct', p);
    $('#progressPct').textContent = p + '%';
    $('#progressCount').textContent = done + ' / ' + app.length;
    $('#momentum').textContent = momentum > 1 ? 'x' + momentum.toFixed(1) + ' momentum' : '';

    var track = $('#coreTrack');
    track.innerHTML = '';
    CT.CORE_IDS.forEach(function (id) {
      var b = CT.BEHAVIOR_BY_ID[id];
      var on = call.behaviors.indexOf(id) !== -1;
      track.appendChild(el('span', {
        class: 'corepip' + (on ? ' is-on' : ''), title: b.name, text: b.icon
      }));
    });
  }

  /* ====================================================================
   * START / END CALL
   * ================================================================== */
  function startCall() {
    if (call) return;
    call = pendingAsCall();
    var prior = CT.findPrior(call.identifier.norm, call.id);
    call.repeatOf = prior.length;
    if (call.flags.verified === true) call.behaviors.push('verifyCustomer');
    call.score = CT.scoreCall(call);

    momentum = 1;
    warned15 = false;
    holdStartedAt = null;
    persistActive(false, true);

    CT.sound('start');
    renderAll();
    startTicking();

    if (call.repeatOf > 0) {
      CT.toast({
        icon: '\u{1F501}', title: 'Repeat caller', tone: 'warn', timeout: 5000,
        text: call.repeatOf + ' prior call' + (call.repeatOf === 1 ? '' : 's') + ' on this ID. Check what was missed.'
      });
    }
    if (call.flags.verified === null) {
      CT.toast({ icon: '\u{1F512}', title: 'Verification not set', text: 'Answer it in the flags panel once you know.', tone: 'warn', timeout: 4500 });
    }
    pending = freshPending();
  }

  function endCall() {
    if (!call) return;
    if (holdStartedAt) { call.holdSeconds = currentHold(); holdStartedAt = null; }
    stopTicking();

    call.duration = elapsed();
    call.endedAt = new Date().toISOString();
    call.score = CT.scoreCall(call);
    call.coreCombo = CT.hasCoreCombo(call);
    delete call._sdlCelebrated;

    var xpResult = CT.computeCallXp(call, call.maxCombo || 1);
    call.xp = xpResult.xp;

    var before = CT.rankFor(CT.state.profile.xp);
    CT.state.profile.xp += call.xp;
    CT.state.profile.lastCallAt = call.endedAt;
    if (call.coreCombo) {
      CT.state.profile.streak += 1;
      CT.state.profile.bestStreak = Math.max(CT.state.profile.bestStreak, CT.state.profile.streak);
    } else {
      CT.state.profile.streak = 0;
    }

    CT.state.calls.push(call);
    CT.state.activeCall = null;
    var trophies = CT.checkTrophies();
    CT.save(true);

    var after = CT.rankFor(CT.state.profile.xp);
    var finished = call;
    var streak = CT.state.profile.streak;

    lastRecap = CT.buildRecap(finished, { streak: streak });
    CT.copy(lastRecap, 'Call recap copied');

    call = null;
    pending = freshPending();
    renderAll();

    showEndCard(finished, xpResult, before, after, trophies, streak);
  }

  function showEndCard(finished, xpResult, before, after, trophies, streak) {
    var missed = CT.applicableBehaviors(finished)
      .filter(function (b) { return finished.behaviors.indexOf(b.id) === -1; });

    var grade = finished.score >= 90 ? 'S' : finished.score >= 78 ? 'A' : finished.score >= 62 ? 'B' : finished.score >= 45 ? 'C' : 'D';

    var body = el('div', { class: 'endcard' }, [
      el('div', { class: 'endcard__hero' }, [
        el('div', { class: 'endcard__grade endcard__grade--' + grade, text: grade }),
        el('div', { class: 'endcard__stats' }, [
          el('div', { class: 'endcard__score', text: finished.score + '%' }),
          el('div', { class: 'endcard__meta', text: CT.fmtDuration(finished.duration) + ' on the line' +
            (finished.holdSeconds ? ' · ' + CT.fmtDuration(finished.holdSeconds) + ' hold' : '') }),
          el('div', { class: 'endcard__xp', text: '+' + finished.xp + ' XP' })
        ])
      ]),
      finished.coreCombo ? el('div', { class: 'endcard__combo', text: '⭐ CORE 5 COMBO' + (streak > 1 ? '  ·  STREAK x' + streak : '') }) : null,
      xpResult.bonuses.length ? el('ul', { class: 'endcard__bonuses' }, xpResult.bonuses.map(function (b) {
        return el('li', {}, [el('span', { text: b[0] }), el('b', { text: '+' + b[1] })]);
      })) : null,
      after.level > before.level ? el('div', { class: 'endcard__level', text: '\u{1F389} RANK UP — LV.' + after.level + ' ' + after.title }) : null,
      missed.length ? el('div', { class: 'endcard__missed' }, [
        el('h4', { text: 'Next call, catch these' }),
        el('div', { class: 'endcard__chips' }, missed.slice(0, 6).map(function (b) {
          return el('span', { class: 'misschip' + (b.core ? ' misschip--core' : ''), text: b.icon + ' ' + b.short });
        }))
      ]) : el('div', { class: 'endcard__perfect', text: 'Nothing missed. That is a flawless call.' })
    ]);

    CT.modal({
      title: 'Call complete',
      body: body,
      actions: [
        { label: 'Copy recap', tone: 'ghost', onClick: function () { CT.copy(lastRecap, 'Recap copied'); return false; } },
        { label: 'Next call →', tone: 'primary' }
      ]
    });

    CT.sound('end');
    if (finished.score >= 90 || finished.coreCombo) { CT.confetti(110); CT.sound('level'); }
    if (after.level > before.level) { CT.flash('gold'); CT.confetti(160, ['#fbbf24', '#e20074', '#ffffff']); CT.sound('level'); }
    trophies.forEach(function (t, i) {
      setTimeout(function () {
        CT.sound('trophy');
        CT.toast({ icon: t.icon, title: 'TROPHY — ' + t.name, text: t.desc, tone: 'gold', timeout: 5200 });
      }, 400 + i * 900);
    });
  }

  /* Keep the in-flight call recoverable across a refresh or a crash. */
  function persistActive(quiet, immediate) {
    if (!call) { CT.state.activeCall = null; CT.save(immediate); return; }
    call.duration = elapsed();
    call.holdSeconds = currentHold();
    CT.state.activeCall = call;
    if (!quiet || immediate) CT.save(immediate);
  }

  /* ====================================================================
   * RAIL — emergency help, quests, trophies
   * ================================================================== */
  function renderRail() {
    var host = $('#sosList');
    host.innerHTML = '';
    CT.TEMPLATES.forEach(function (t) {
      var edited = !!CT.state.templates[t.id];
      host.appendChild(el('div', { class: 'sos sos--' + t.tone }, [
        el('button', {
          class: 'sos__main', type: 'button', title: fillTemplate(t.id),
          onclick: function () { fireTemplate(t.id); }
        }, [
          el('span', { class: 'sos__icon', text: t.icon }),
          el('span', { class: 'sos__label', text: t.label }),
          edited ? el('span', { class: 'sos__edited', text: 'edited' }) : null
        ]),
        el('button', {
          class: 'sos__edit', type: 'button', 'aria-label': 'Edit ' + t.label,
          onclick: function () { editTemplate(t); }
        }, ['✎'])
      ]));
    });

    renderQuests();
    renderTrophyStrip();
  }

  function editTemplate(t) {
    CT.prompt({
      title: 'Edit: ' + t.label, multiline: true, rows: 5,
      text: 'Placeholders: {ref} customer + reason + time · {amount} · {quip}',
      value: templateText(t.id), confirmLabel: 'Save message'
    }).then(function (v) {
      if (v === null) return;
      if (!v.trim() || v.trim() === t.text) delete CT.state.templates[t.id];
      else CT.state.templates[t.id] = v.trim();
      CT.save();
      renderRail();
      CT.toast({ icon: '✎', title: 'Message saved', tone: 'ok' });
    });
  }

  function renderQuests() {
    var host = $('#questList');
    host.innerHTML = '';
    CT.questsForToday().forEach(function (q) {
      var p = Math.round((q.progress / q.goal) * 100);
      host.appendChild(el('div', { class: 'quest' + (q.done ? ' is-done' : '') + (q.claimed ? ' is-claimed' : '') }, [
        el('div', { class: 'quest__top' }, [
          el('span', { class: 'quest__name', text: q.name }),
          el('span', { class: 'quest__xp', text: '+' + q.xp + ' XP' })
        ]),
        el('div', { class: 'quest__desc', text: q.desc }),
        el('div', { class: 'quest__track' }, [el('div', { class: 'quest__fill', style: 'width:' + p + '%' })]),
        el('div', { class: 'quest__foot' }, [
          el('span', { text: q.raw + (q.unit || '') + ' / ' + q.goal + (q.unit || '') }),
          q.done && !q.claimed ? el('button', {
            class: 'btn btn--gold btn--sm', type: 'button',
            onclick: function () {
              var xp = CT.claimQuest(q.id);
              if (xp) {
                CT.confetti(80, ['#fbbf24', '#ffffff', '#e20074']);
                CT.sound('level');
                CT.toast({ icon: '\u{1F3C6}', title: 'Quest complete', text: '+' + xp + ' XP', tone: 'gold' });
              }
              renderAll();
            }
          }, ['Claim']) : q.claimed ? el('span', { class: 'quest__claimed', text: 'claimed' }) : null
        ])
      ]));
    });
  }

  function renderTrophyStrip() {
    var host = $('#trophyStrip');
    host.innerHTML = '';
    var unlocked = CT.ACHIEVEMENTS.filter(function (a) { return CT.state.trophies[a.id]; });
    var locked = CT.ACHIEVEMENTS.filter(function (a) { return !CT.state.trophies[a.id]; });
    $('#trophyCount').textContent = unlocked.length + '/' + CT.ACHIEVEMENTS.length;
    unlocked.slice(-6).reverse().concat(locked.slice(0, 3)).forEach(function (a) {
      var got = !!CT.state.trophies[a.id];
      host.appendChild(el('span', {
        class: 'trophy' + (got ? '' : ' is-locked'),
        title: a.name + ' — ' + a.desc + (got ? '' : ' (locked)'),
        text: got ? a.icon : '?'
      }));
    });
  }

  /* ====================================================================
   * DASHBOARD
   * ================================================================== */
  function renderDash() {
    var scope = $('#dashScope').value;
    var calls = CT.callsInScope(scope);
    var s = CT.computeStats(calls);

    var tiles = [
      ['Calls', s.total, ''],
      ['Avg score', s.avgScore + '%', ''],
      ['Resolved', s.resolutionRate + '%', s.resolved + ' of ' + s.total],
      ['AHT', CT.fmtDuration(s.aht), 'total ' + CT.fmtDuration(s.duration)],
      ['Core combos', s.coreCalls, s.total ? Math.round((s.coreCalls / s.total) * 100) + '%' : '0%'],
      ['Repeat callers', s.repeats, s.repeatRate + '%'],
      ['Escalated', s.escalated, s.cancels + ' cancel risk'],
      ['Collected', CT.fmtMoney(s.collectedTotal), s.collections + ' payment' + (s.collections === 1 ? '' : 's')]
    ];
    var tileHost = $('#statTiles');
    tileHost.innerHTML = '';
    tiles.forEach(function (t) {
      tileHost.appendChild(el('div', { class: 'tile' }, [
        el('div', { class: 'tile__label', text: t[0] }),
        el('div', { class: 'tile__value', text: String(t[1]) }),
        el('div', { class: 'tile__sub', text: t[2] })
      ]));
    });

    var barHost = $('#adoptionBars');
    barHost.innerHTML = '';
    CT.behaviorAdoption(calls)
      .filter(function (a) { return a.pct !== null; })
      .sort(function (a, b) { return b.pct - a.pct; })
      .forEach(function (a) {
        barHost.appendChild(el('div', { class: 'abar' + (a.core ? ' abar--core' : '') }, [
          el('span', { class: 'abar__name', text: a.short }),
          el('span', { class: 'abar__track' }, [
            el('span', {
              class: 'abar__fill' + (a.pct >= 85 ? ' is-good' : a.pct < 50 ? ' is-bad' : ''),
              style: 'width:' + a.pct + '%'
            })
          ]),
          el('span', { class: 'abar__pct', text: a.pct + '%' }),
          el('span', { class: 'abar__n', text: a.done + '/' + a.n })
        ]));
      });

    var reasonHost = $('#reasonBars');
    reasonHost.innerHTML = '';
    var reasons = Object.keys(s.reasonCounts).map(function (k) {
      return { id: k, n: s.reasonCounts[k] };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var top = reasons[0];
    if (!reasons.length) {
      reasonHost.appendChild(el('p', { class: 'muted', text: 'No reasons logged in this window yet.' }));
    }
    reasons.forEach(function (r) {
      var meta = CT.REASON_BY_ID[r.id] || { name: r.id, icon: '•' };
      reasonHost.appendChild(el('div', { class: 'abar' }, [
        el('span', { class: 'abar__name', text: meta.icon + ' ' + meta.name }),
        el('span', { class: 'abar__track' }, [
          el('span', { class: 'abar__fill is-alt', style: 'width:' + Math.round((r.n / top.n) * 100) + '%' })
        ]),
        el('span', { class: 'abar__pct', text: r.n }),
        el('span', { class: 'abar__n', text: Math.round((r.n / s.total) * 100) + '%' })
      ]));
    });

    $('#storageNote').textContent = 'Local only · ' + CT.state.calls.length + ' calls stored · ' +
      (CT.storageBytes() / 1024).toFixed(0) + ' KB · retention ' + CT.state.settings.retentionDays + ' days';
  }

  /* ====================================================================
   * REPORT / SETTINGS / HELP
   * ================================================================== */
  function openReport(scope) {
    scope = scope || 'today';
    var pre = el('pre', { class: 'reportpre', text: CT.buildReport(scope) });
    var select = el('select', { class: 'field field--sm' }, [
      el('option', { value: 'today', text: 'Today' }),
      el('option', { value: 'week', text: 'Last 7 days' }),
      el('option', { value: 'month', text: 'Last 30 days' }),
      el('option', { value: 'all', text: 'All time' })
    ]);
    select.value = scope;
    select.addEventListener('change', function () {
      scope = select.value;
      pre.textContent = CT.buildReport(scope);
    });

    CT.modal({
      title: 'Shift debrief',
      wide: true,
      body: el('div', {}, [
        el('div', { class: 'reportbar' }, [
          el('label', { class: 'reportbar__label', text: 'Window' }),
          select,
          el('label', { class: 'switch' }, [
            (function () {
              var cb = el('input', { type: 'checkbox' });
              cb.checked = !CT.state.settings.maskIds;
              cb.addEventListener('change', function () {
                CT.state.settings.maskIds = !cb.checked;
                CT.save();
                pre.textContent = CT.buildReport(scope);
              });
              return cb;
            })(),
            el('span', { text: 'Show full customer IDs' })
          ])
        ]),
        pre
      ]),
      actions: [
        { label: 'Download .txt', tone: 'ghost', onClick: function () {
          CT.download('call-tracker-' + scope + '-' + CT.dayKey() + '.txt', CT.buildReport(scope));
          return false;
        } },
        { label: 'Copy report', tone: 'ghost', onClick: function () { CT.copy(CT.buildReport(scope), 'Report copied'); return false; } },
        { label: 'Close', tone: 'primary' }
      ]
    });
  }

  function openSettings() {
    var nameInput = el('input', { class: 'field', type: 'text', placeholder: 'Shows up on your reports' });
    nameInput.value = CT.state.settings.agentName || '';

    var retention = el('input', { class: 'field field--sm', type: 'number', min: '7', max: '3650' });
    retention.value = CT.state.settings.retentionDays;

    var toggles = [
      ['sound', 'Sound effects', 'Off by default so nothing leaks into a live call.'],
      ['confetti', 'Confetti and flashes', 'Turn off for a calmer screen.'],
      ['maskIds', 'Mask customer IDs in reports', 'Shows only the last four digits anywhere text is copied.'],
      ['hotkeys', 'Keyboard shortcuts', 'Single-key behavior toggles while a call is live.']
    ];

    var body = el('div', { class: 'settings' }, [
      el('label', { class: 'settings__label', text: 'Your name' }), nameInput,
      el('div', { class: 'settings__toggles' }, toggles.map(function (t) {
        var cb = el('input', { type: 'checkbox' });
        cb.checked = !!CT.state.settings[t[0]];
        cb.addEventListener('change', function () {
          CT.state.settings[t[0]] = cb.checked;
          CT.save();
          renderAll();
        });
        return el('label', { class: 'switch switch--block' }, [
          cb,
          el('span', {}, [el('b', { text: t[1] }), el('small', { text: t[2] })])
        ]);
      })),
      el('label', { class: 'settings__label', text: 'Keep history for (days)' }), retention,
      el('p', { class: 'settings__note', text: 'Older calls are dropped automatically to stay inside the browser storage limit.' }),
      el('hr', { class: 'settings__rule' }),
      el('h4', { class: 'settings__h', text: 'Your data' }),
      el('p', { class: 'settings__note', text: 'Everything lives in this browser on this device. Nothing is uploaded, there is no analytics, and the app makes no network requests at all. Clearing your browser data deletes it — export a backup if that matters to you.' }),
      el('div', { class: 'settings__row' }, [
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: function () {
          CT.download('call-tracker-backup-' + CT.dayKey() + '.json', CT.exportJSON(), 'application/json');
        } }, ['Export backup']),
        (function () {
          var file = el('input', { type: 'file', accept: '.json,application/json', class: 'sr-only' });
          file.addEventListener('change', function () {
            var f = file.files[0];
            if (!f) return;
            var reader = new FileReader();
            reader.onload = function () {
              try {
                CT.importJSON(String(reader.result));
                renderAll();
                CT.toast({ icon: '✔', title: 'Backup restored', text: CT.state.calls.length + ' calls loaded.', tone: 'ok' });
              } catch (e) {
                CT.toast({ icon: '⚠', title: 'Could not read that file', text: e.message, tone: 'bad', timeout: 6000 });
              }
            };
            reader.readAsText(f);
          });
          var btn = el('button', { class: 'btn btn--ghost', type: 'button', onclick: function () { file.click(); } }, ['Import backup']);
          return el('span', {}, [btn, file]);
        })(),
        el('button', { class: 'btn btn--danger', type: 'button', onclick: function () {
          CT.confirm({
            title: 'Erase everything?',
            text: 'All calls, XP, streaks and trophies on this device. There is no undo and no copy anywhere else.',
            confirmLabel: 'Erase it all'
          }).then(function (ok) {
            if (!ok) return;
            try { window.localStorage.removeItem(CT.STORAGE_KEY); } catch (e) { /* noop */ }
            window.location.reload();
          });
        } }, ['Erase all data'])
      ]),
      el('div', { class: 'settings__row' }, [
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: function () {
          CT.state.templates = {};
          CT.save();
          renderRail();
          CT.toast({ icon: '↺', title: 'Teams messages reset to defaults', tone: 'ok' });
        } }, ['Reset Teams messages'])
      ])
    ]);

    CT.modal({
      title: 'Settings',
      body: body,
      actions: [{ label: 'Done', tone: 'primary', onClick: function () {
        CT.state.settings.agentName = nameInput.value.trim();
        var days = parseInt(retention.value, 10);
        if (days >= 7 && days <= 3650) CT.state.settings.retentionDays = days;
        CT.save(true);
        renderAll();
      } }]
    });
  }

  function openHelp() {
    var rows = CT.BEHAVIORS.map(function (b) {
      return el('tr', {}, [
        el('td', {}, [el('kbd', { text: b.key.toUpperCase() })]),
        el('td', { text: b.icon + ' ' + b.name })
      ]);
    });
    var globals = [
      ['/', 'Jump to the customer ID field'],
      ['Enter', 'Start the call (from the ID field)'],
      ['H', 'Hold / resume'],
      ['X', 'End the call'],
      ['G', 'Open the shift debrief'],
      ['Esc', 'Close whatever is open']
    ].map(function (g) {
      return el('tr', {}, [el('td', {}, [el('kbd', { text: g[0] })]), el('td', { text: g[1] })]);
    });

    CT.modal({
      title: 'How this thing works',
      wide: true,
      body: el('div', { class: 'help' }, [
        el('p', { class: 'modal__lead', text: 'Start a call, tick what you actually did, end the call. The recap lands on your clipboard automatically. Everything else — XP, streaks, trophies, the debrief — builds itself from those ticks.' }),
        el('div', { class: 'help__cols' }, [
          el('div', {}, [
            el('h4', { text: 'While a call is live' }),
            el('table', { class: 'keys' }, [el('tbody', {}, rows)])
          ]),
          el('div', {}, [
            el('h4', { text: 'Anywhere' }),
            el('table', { class: 'keys' }, [el('tbody', {}, globals)]),
            el('h4', { text: 'The CORE 5' }),
            el('p', { class: 'help__note', text: 'Restate · Account audit · Balance check · Personal guarantee · "So you do not have to call back". Land all five and the call scores a combo and extends your streak.' }),
            el('h4', { text: 'Emergency help' }),
            el('p', { class: 'help__note', text: 'The red rail copies a ready-to-paste Teams message in one click. Marking a caller escalated or a call a cancel copies the right message automatically. Every message is editable with the pencil.' }),
            el('h4', { text: 'Privacy' }),
            el('p', { class: 'help__note', text: 'This app has no server, no analytics and no third-party scripts. It makes zero network requests — you can run it with the network unplugged. Customer IDs stay in this browser and are masked to the last four digits in anything you copy.' })
          ])
        ])
      ]),
      actions: [{ label: 'Got it', tone: 'primary' }]
    });
  }

  /* ====================================================================
   * KEYBOARD
   * ================================================================== */
  function onKey(e) {
    if (e.key === 'Escape') { CT.closeTopModal(); return; }
    var t = e.target;
    var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (CT.modalOpen()) return;

    var k = e.key.toLowerCase();

    if (k === '/') { e.preventDefault(); var f = $('#callIdInput'); if (f && !call) f.focus(); return; }
    if (k === '?') { e.preventDefault(); openHelp(); return; }
    if (k === 'g') { e.preventDefault(); openReport('today'); return; }

    if (!call) {
      if (k === 'enter') { e.preventDefault(); startCall(); }
      return;
    }
    if (k === 'h') { e.preventDefault(); toggleHold(); return; }
    if (k === 'x') { e.preventDefault(); endCall(); return; }

    if (!CT.state.settings.hotkeys) return;
    var b = CT.BEHAVIORS.filter(function (x) { return x.key === k; })[0];
    if (b) {
      var applies = typeof b.applies !== 'function' || b.applies(call);
      if (!applies) {
        CT.toast({ icon: '\u{1F512}', title: b.short + ' is not in play', text: 'It unlocks from the flags panel.', tone: 'warn', timeout: 2200 });
        return;
      }
      e.preventDefault();
      toggleBehavior(b.id, document.querySelector('[data-behavior="' + b.id + '"]'));
    }
  }

  function toggleHold() {
    if (!call) return;
    if (holdStartedAt) {
      call.holdSeconds = currentHold();
      holdStartedAt = null;
      CT.sound('on');
    } else {
      holdStartedAt = Date.now();
      CT.sound('off');
      CT.toast({ icon: '⏸', title: 'On hold', text: 'Come back before they wonder if you left.', tone: 'cyan', timeout: 2200 });
    }
    updateTimer();
    persistActive();
  }

  /* ====================================================================
   * WIRING
   * ================================================================== */
  function wire() {
    $('#callIdInput').addEventListener('input', function (e) {
      pending.raw = e.target.value;
      renderIdle();
    });
    $('#callIdInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); startCall(); }
    });
    $('#startCallBtn').addEventListener('click', startCall);
    $('#endCallBtn').addEventListener('click', endCall);
    $('#btnHold').addEventListener('click', toggleHold);

    $('#liveNotes').addEventListener('input', function (e) { call.notes = e.target.value; persistActive(true); });
    $('#liveSub').addEventListener('input', function (e) { call.subReason = e.target.value; persistActive(true); });
    $('#liveTenure').addEventListener('input', function (e) {
      var v = e.target.value === '' ? null : Number(e.target.value);
      call.tenureYears = (v === null || isNaN(v)) ? null : v;
      persistActive(true);
    });

    $('#liveReasonBtn').addEventListener('click', function () {
      var host = el('div', { class: 'chipgrid chipgrid--modal' });
      var m = CT.modal({ title: 'Why are they calling?', body: host, actions: [{ label: 'Done', tone: 'primary' }] });
      var pick = function (id) {
        call.reason = call.reason === id ? null : id;
        pruneInapplicable();
        renderReasonChips(host, call.reason, pick);
        renderAll();
        persistActive();
        if (call.reason) m.close();
      };
      renderReasonChips(host, call.reason, pick);
    });

    $('#btnReport').addEventListener('click', function () { openReport('today'); });
    $('#btnSettings').addEventListener('click', openSettings);
    $('#btnHelp').addEventListener('click', openHelp);
    $('#btnSound').addEventListener('click', function () {
      CT.state.settings.sound = !CT.state.settings.sound;
      CT.save();
      renderTop();
      CT.sound('on');
    });
    $('#btnCopyLast').addEventListener('click', function () {
      if (!lastRecap) {
        CT.toast({ icon: 'ℹ', title: 'No recap yet', text: 'Finish a call first.', tone: 'warn' });
        return;
      }
      CT.copy(lastRecap, 'Last recap copied');
    });
    $('#dashScope').addEventListener('change', renderDash);
    $('#btnDashReport').addEventListener('click', function () { openReport($('#dashScope').value); });

    document.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', function () { persistActive(false, true); });
  }

  /* ====================================================================
   * BOOT
   * ================================================================== */
  function renderAll() {
    renderTop();
    renderConsole();
    renderBoard();
    renderProgress();
    renderRail();
    renderDash();
  }
  CT.renderAll = renderAll;

  function resumePrompt(saved) {
    var since = CT.fmtDuration(Math.floor((Date.now() - new Date(saved.startedAt).getTime()) / 1000));
    CT.modal({
      title: 'A call was still running',
      dismissable: false,
      body: el('div', {}, [
        el('p', { class: 'modal__lead', text: 'Call Tracker closed while a call was live. It has been ' + since + ' since it started.' }),
        el('p', { class: 'modal__lead', text: CT.idLabel(saved) + (saved.behaviors.length ? ' · ' + saved.behaviors.length + ' behaviors already ticked' : '') })
      ]),
      actions: [
        { label: 'Discard it', tone: 'ghost', onClick: function () {
          CT.state.activeCall = null;
          CT.save(true);
          renderAll();
        } },
        { label: 'Save as finished', tone: 'ghost', onClick: function () {
          call = saved;
          endCall();
        } },
        { label: 'Resume the call', tone: 'primary', onClick: function () {
          call = saved;
          momentum = call.maxCombo || 1;
          holdStartedAt = null;
          warned15 = elapsed() >= 15 * 60;
          renderAll();
          startTicking();
        } }
      ]
    });
  }

  function boot() {
    CT.load();
    pending = freshPending();
    wire();

    var saved = CT.state.activeCall;
    renderAll();

    CT.importLegacy(function (n) {
      if (n > 0) {
        renderAll();
        CT.toast({ icon: '\u{1F4E6}', title: 'Imported ' + n + ' calls from the old version', text: 'They count toward your all-time totals.', tone: 'ok', timeout: 6000 });
      }
    });

    if (saved && saved.startedAt) resumePrompt(saved);

    if (CT.storageBlocked) {
      CT.toast({ icon: '⚠', title: 'Storage is blocked', text: 'Private mode or blocked cookies — nothing will be saved.', tone: 'bad', timeout: 9000 });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
