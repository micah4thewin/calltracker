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
 * store.js — local-only persistence, scoring, stats and analytics.
 *
 * PRIVACY: this file contains no fetch, no XHR, no beacon, no websocket.
 * Everything lives in window.localStorage on this device and never moves.
 * ======================================================================== */

var CT = window.CT || (window.CT = {});

(function () {
  'use strict';

  /* --------------------------------------------------------------------
   * Defaults & shape
   * ------------------------------------------------------------------ */
  function defaultState() {
    return {
      version: 3,
      profile: { xp: 0, streak: 0, bestStreak: 0, lastCallAt: null },
      settings: {
        agentName: '',
        sound: false,
        confetti: true,
        maskIds: true,
        retentionDays: 180,
        hotkeys: true
      },
      calls: [],
      trophies: {},           // id -> ISO unlocked timestamp
      questState: {},         // 'YYYY-MM-DD' -> { claimed: [ids] }
      templates: {},          // id -> user-edited text
      activeCall: null,       // survives a refresh mid-call
      legacyImported: false,
      createdAt: new Date().toISOString()
    };
  }

  CT.state = defaultState();

  /* --------------------------------------------------------------------
   * Load / save
   * ------------------------------------------------------------------ */
  CT.load = function () {
    var raw = null;
    try {
      raw = window.localStorage.getItem(CT.STORAGE_KEY);
    } catch (e) {
      CT.storageBlocked = true;
      return CT.state;
    }
    if (!raw) return CT.state;
    try {
      var parsed = JSON.parse(raw);
      CT.state = migrate(parsed);
    } catch (e) {
      // Corrupt blob: keep a copy so nothing is silently destroyed.
      try { window.localStorage.setItem(CT.STORAGE_KEY + '.broken.' + Date.now(), raw); } catch (e2) { /* full */ }
      CT.state = defaultState();
    }
    return CT.state;
  };

  function migrate(s) {
    var base = defaultState();
    var out = Object.assign(base, s || {});
    out.profile = Object.assign(base.profile, s.profile || {});
    out.settings = Object.assign(base.settings, s.settings || {});
    out.calls = Array.isArray(s.calls) ? s.calls : [];
    out.calls = out.calls.map(normalizeCall);
    out.version = 3;
    return out;
  }

  function normalizeCall(c) {
    c = c || {};
    c.behaviors = Array.isArray(c.behaviors) ? c.behaviors.map(function (id) {
      return CT.LEGACY_BEHAVIOR_MAP[id] || id;
    }) : [];
    c.flags = c.flags || {};
    c.duration = Number(c.duration) || 0;
    return c;
  }

  var saveTimer = null;
  CT.save = function (immediate) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!immediate) { saveTimer = setTimeout(writeNow, 250); return; }
    writeNow();
  };

  function writeNow() {
    saveTimer = null;
    prune();
    try {
      window.localStorage.setItem(CT.STORAGE_KEY, JSON.stringify(CT.state));
      CT.storageBlocked = false;
    } catch (e) {
      // Quota or private mode. Drop the oldest half of history and retry once.
      if (CT.state.calls.length > 40) {
        CT.state.calls = CT.state.calls.slice(Math.floor(CT.state.calls.length / 2));
        try {
          window.localStorage.setItem(CT.STORAGE_KEY, JSON.stringify(CT.state));
          if (CT.toast) CT.toast({ icon: '\u{1F5C4}', title: 'Storage was full', text: 'Trimmed the oldest calls. Export a backup soon.', tone: 'warn', timeout: 9000 });
          return;
        } catch (e2) { /* fall through */ }
      }
      CT.storageBlocked = true;
      if (CT.toast) CT.toast({ icon: '⚠', title: 'Could not save', text: 'Local storage is unavailable or full.', tone: 'bad', timeout: 9000 });
    }
  }

  function prune() {
    var days = Number(CT.state.settings.retentionDays) || 0;
    if (!days) return;
    var cutoff = Date.now() - days * 86400000;
    CT.state.calls = CT.state.calls.filter(function (c) {
      if (!c.startedAt) return true;              // legacy rows have no date
      return new Date(c.startedAt).getTime() >= cutoff;
    });
  }

  CT.storageBytes = function () {
    try { return (window.localStorage.getItem(CT.STORAGE_KEY) || '').length; }
    catch (e) { return 0; }
  };

  /* --------------------------------------------------------------------
   * One-time import of pre-3.0 history (localforage / IndexedDB).
   * Best effort: if anything goes wrong we simply carry on.
   * ------------------------------------------------------------------ */
  CT.importLegacy = function (done) {
    if (CT.state.legacyImported || !window.indexedDB) { done(0); return; }
    var finished = false;
    var finish = function (n) {
      if (finished) return;
      finished = true;
      CT.state.legacyImported = true;
      CT.save(true);
      done(n);
    };
    setTimeout(function () { finish(0); }, 2500);

    var req;
    try { req = window.indexedDB.open('tMobileCallTracker'); }
    catch (e) { finish(0); return; }

    req.onerror = function () { finish(0); };
    req.onupgradeneeded = function (ev) {
      // The DB did not exist — abort so we do not create an empty one.
      try { ev.target.transaction.abort(); } catch (e) { /* noop */ }
      finish(0);
    };
    req.onsuccess = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains('keyvaluepairs')) { db.close(); finish(0); return; }
      var getReq;
      try { getReq = db.transaction('keyvaluepairs', 'readonly').objectStore('keyvaluepairs').get('dailyData'); }
      catch (e) { db.close(); finish(0); return; }
      getReq.onerror = function () { db.close(); finish(0); };
      getReq.onsuccess = function () {
        var data = getReq.result;
        var n = 0;
        if (data && Array.isArray(data.calls)) {
          data.calls.forEach(function (old) {
            var call = blankCall();
            call.id = 'legacy-' + (n++) + '-' + Math.random().toString(36).slice(2, 8);
            call.legacy = true;
            call.startedAt = null;
            call.endedAt = null;
            call.duration = Number(old.duration) || 0;
            call.identifier = { type: 'other', raw: String(old.id || ''), norm: CT.normalizeId(String(old.id || '')) };
            call.behaviors = (old.behaviors || []).map(function (b) { return CT.LEGACY_BEHAVIOR_MAP[b] || b; });
            call.score = CT.scoreCall(call);
            CT.state.calls.push(call);
          });
        }
        db.close();
        finish(n);
      };
    };
  };

  /* --------------------------------------------------------------------
   * Call factory
   * ------------------------------------------------------------------ */
  function blankCall() {
    var flags = {};
    CT.FLAGS.forEach(function (f) { flags[f.id] = f.def; });
    return {
      id: CT.uid(),
      startedAt: new Date().toISOString(),
      endedAt: null,
      duration: 0,
      holdSeconds: 0,
      identifier: { type: 'none', raw: '', norm: '' },
      reason: null,
      subReason: '',
      tenureYears: null,
      flags: flags,
      collectedAmount: 0,
      behaviors: [],
      notes: '',
      repeatOf: 0,
      coreCombo: false,
      score: 0,
      xp: 0,
      maxCombo: 1
    };
  }
  CT.blankCall = blankCall;

  CT.uid = function () {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  };

  /* --------------------------------------------------------------------
   * Identifiers — normalized locally for repeat-caller matching, and
   * masked whenever they are rendered into anything copyable.
   * ------------------------------------------------------------------ */
  CT.normalizeId = function (raw) {
    if (!raw) return '';
    var digits = String(raw).replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);       // phone / BAN tail
    return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  };

  CT.detectIdType = function (raw) {
    var digits = String(raw || '').replace(/\D/g, '');
    if (!raw) return 'none';
    if (digits.length === 10 || digits.length === 11) return 'phone';
    if (digits.length >= 8 && digits.length === String(raw).replace(/\s|-/g, '').length) return 'account';
    return 'other';
  };

  CT.maskId = function (call) {
    var id = call && call.identifier;
    if (!id || !id.raw) return 'NO ID';
    if (!CT.state.settings.maskIds) return id.raw;
    var s = String(id.raw).replace(/\s+/g, '');
    if (s.length <= 4) return '••' + s;
    return '••••' + s.slice(-4);
  };

  CT.idLabel = function (call) {
    var t = call.identifier.type;
    var prefix = t === 'phone' ? 'MSISDN ' : t === 'account' ? 'Acct ' : t === 'none' ? '' : 'Ref ';
    return call.identifier.raw ? prefix + CT.maskId(call) : 'Unidentified caller';
  };

  /* Prior calls sharing this normalized identifier (most recent first). */
  CT.findPrior = function (norm, excludeId) {
    if (!norm) return [];
    return CT.state.calls.filter(function (c) {
      return c.identifier && c.identifier.norm === norm && c.id !== excludeId;
    }).sort(function (a, b) {
      return (new Date(b.startedAt || 0)) - (new Date(a.startedAt || 0));
    });
  };

  /* --------------------------------------------------------------------
   * Scoring
   * ------------------------------------------------------------------ */
  CT.applicableBehaviors = function (call) {
    return CT.BEHAVIORS.filter(function (b) {
      return typeof b.applies !== 'function' || b.applies(call);
    });
  };

  CT.scoreCall = function (call) {
    var app = CT.applicableBehaviors(call);
    if (!app.length) return 0;
    var done = app.filter(function (b) { return call.behaviors.indexOf(b.id) !== -1; }).length;
    return Math.round((done / app.length) * 100);
  };

  CT.hasCoreCombo = function (call) {
    return CT.CORE_IDS.every(function (id) { return call.behaviors.indexOf(id) !== -1; });
  };

  /* XP for a finished call: behaviors x combo, plus situational bonuses. */
  CT.computeCallXp = function (call, maxCombo) {
    var xp = 0;
    call.behaviors.forEach(function (id) {
      var b = CT.BEHAVIOR_BY_ID[id];
      if (b) xp += b.xp;
    });
    xp = Math.round(xp * (maxCombo || 1));
    var bonuses = [];
    if (CT.hasCoreCombo(call)) { xp += 25; bonuses.push(['CORE 5 COMBO', 25]); }
    if (CT.hasSDL(call)) { xp += 10; bonuses.push(['SDL TRIAGE', 10]); }
    if (call.flags.resolved === true) { xp += 15; bonuses.push(['RESOLVED', 15]); }
    if (call.flags.collected === true) { xp += 20; bonuses.push(['MONEY COLLECTED', 20]); }
    if (call.flags.cancelIntent === true && call.behaviors.indexOf('retentionSave') !== -1) { xp += 20; bonuses.push(['SAVE ATTEMPT', 20]); }
    if (call.flags.escalated === true && call.flags.resolved === true) { xp += 20; bonuses.push(['DEFUSED + RESOLVED', 20]); }
    if (call.score === 100) { xp += 30; bonuses.push(['FLAWLESS CALL', 30]); }
    return { xp: xp, bonuses: bonuses };
  };

  /* --------------------------------------------------------------------
   * Ranks
   * ------------------------------------------------------------------ */
  CT.rankFor = function (xp) {
    var last = CT.LEVELS[CT.LEVELS.length - 1];
    if (xp >= last.xp) {
      var over = xp - last.xp;
      var star = Math.floor(over / CT.PRESTIGE_STEP);
      var into = over - star * CT.PRESTIGE_STEP;
      return {
        level: CT.LEVELS.length + star,
        title: star > 0 ? last.title + ' ★' + star : last.title,
        floor: last.xp + star * CT.PRESTIGE_STEP,
        ceil: last.xp + (star + 1) * CT.PRESTIGE_STEP,
        into: into,
        span: CT.PRESTIGE_STEP,
        pct: Math.round((into / CT.PRESTIGE_STEP) * 100)
      };
    }
    for (var i = CT.LEVELS.length - 1; i >= 0; i--) {
      if (xp >= CT.LEVELS[i].xp) {
        var next = CT.LEVELS[i + 1];
        var span = next.xp - CT.LEVELS[i].xp;
        var into2 = xp - CT.LEVELS[i].xp;
        return {
          level: i + 1, title: CT.LEVELS[i].title,
          floor: CT.LEVELS[i].xp, ceil: next.xp,
          into: into2, span: span,
          pct: Math.round((into2 / span) * 100)
        };
      }
    }
    return { level: 1, title: CT.LEVELS[0].title, floor: 0, ceil: CT.LEVELS[1].xp, into: xp, span: CT.LEVELS[1].xp, pct: 0 };
  };

  /* --------------------------------------------------------------------
   * Date helpers
   * ------------------------------------------------------------------ */
  CT.dayKey = function (d) {
    d = d ? new Date(d) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  CT.callsForDay = function (key) {
    key = key || CT.dayKey();
    return CT.state.calls.filter(function (c) { return c.startedAt && CT.dayKey(c.startedAt) === key; });
  };

  CT.callsInScope = function (scope) {
    if (scope === 'all') return CT.state.calls.slice();
    if (scope === 'today') return CT.callsForDay();
    var days = scope === 'week' ? 7 : scope === 'month' ? 30 : 7;
    var cutoff = Date.now() - days * 86400000;
    return CT.state.calls.filter(function (c) {
      return c.startedAt && new Date(c.startedAt).getTime() >= cutoff;
    });
  };

  /* --------------------------------------------------------------------
   * Stats
   * ------------------------------------------------------------------ */
  CT.computeStats = function (calls) {
    var s = {
      total: calls.length,
      dated: 0,
      duration: 0, hold: 0,
      resolved: 0, escalated: 0, cancels: 0, saves: 0, saveAttempts: 0,
      verified: 0, unverified: 0,
      pastDue: 0, arrangements: 0, collections: 0, collectedTotal: 0, collectAttempts: 0,
      repeats: 0, unidentified: 0,
      hasTmobileId: 0, noTmobileId: 0, tlifeYes: 0, tlifeNo: 0, billingQ: 0,
      coreCalls: 0, sdlCalls: 0, perfectCalls: 0, speedruns: 0, marathons: 0, cleanDays: 0,
      scoreSum: 0, behaviorCounts: {}, reasonCounts: {}, hourCounts: new Array(24).fill(0),
      tenureSum: 0, tenureN: 0, longest: null, shortest: null, xpEarned: 0
    };

    calls.forEach(function (c) {
      s.duration += c.duration || 0;
      s.hold += c.holdSeconds || 0;
      s.scoreSum += c.score || 0;
      s.xpEarned += c.xp || 0;

      if (c.startedAt) {
        s.dated++;
        s.hourCounts[new Date(c.startedAt).getHours()]++;
      }
      if (c.flags.resolved === true) s.resolved++;
      if (c.flags.escalated === true) s.escalated++;
      if (c.flags.cancelIntent === true) s.cancels++;
      if (c.flags.verified === true) s.verified++;
      if (c.flags.verified === false) s.unverified++;
      if (c.flags.pastDue === true) {
        s.pastDue++;
        if (c.flags.hasArrangement === true) s.arrangements++;
        if (c.behaviors.indexOf('attemptedCollection') !== -1) s.collectAttempts++;
        if (c.flags.collected === true) { s.collections++; s.collectedTotal += Number(c.collectedAmount) || 0; }
      }
      if (c.flags.hasTmobileId === true) s.hasTmobileId++;
      if (c.flags.hasTmobileId === false) s.noTmobileId++;
      if (c.flags.canUseTlife === true) s.tlifeYes++;
      if (c.flags.canUseTlife === false) s.tlifeNo++;
      if (c.flags.billingQuestions === true) s.billingQ++;
      if (c.behaviors.indexOf('retentionSave') !== -1) s.saveAttempts++;
      if (c.flags.cancelIntent === true && c.flags.resolved === true) s.saves++;
      if (c.repeatOf > 0) s.repeats++;
      if (!c.identifier || !c.identifier.raw) s.unidentified++;
      if (c.coreCombo) s.coreCalls++;
      if (CT.hasSDL(c)) s.sdlCalls++;
      if (c.score === 100) s.perfectCalls++;
      if (c.coreCombo && c.duration > 0 && c.duration < 300) s.speedruns++;
      if (c.duration > 1800 && c.flags.resolved === true) s.marathons++;
      if (typeof c.tenureYears === 'number' && c.tenureYears >= 0) { s.tenureSum += c.tenureYears; s.tenureN++; }
      if (c.duration > 0) {
        if (!s.longest || c.duration > s.longest.duration) s.longest = c;
        if (!s.shortest || c.duration < s.shortest.duration) s.shortest = c;
      }
      c.behaviors.forEach(function (b) { s.behaviorCounts[b] = (s.behaviorCounts[b] || 0) + 1; });
      if (c.reason) s.reasonCounts[c.reason] = (s.reasonCounts[c.reason] || 0) + 1;
    });

    // Days where every logged call resolved (10+ calls).
    var byDay = {};
    calls.forEach(function (c) {
      if (!c.startedAt) return;
      var k = CT.dayKey(c.startedAt);
      byDay[k] = byDay[k] || { n: 0, r: 0 };
      byDay[k].n++;
      if (c.flags.resolved === true) byDay[k].r++;
    });
    Object.keys(byDay).forEach(function (k) {
      if (byDay[k].n >= 10 && byDay[k].n === byDay[k].r) s.cleanDays++;
    });
    s.days = Object.keys(byDay).length;

    s.avgScore = s.total ? Math.round(s.scoreSum / s.total) : 0;
    s.aht = s.total ? Math.round(s.duration / s.total) : 0;
    s.resolutionRate = s.total ? Math.round((s.resolved / s.total) * 100) : 0;
    s.repeatRate = s.total ? Math.round((s.repeats / s.total) * 100) : 0;
    return s;
  };

  /* Per-behavior adoption, sorted worst-first for coaching. */
  CT.behaviorAdoption = function (calls) {
    return CT.BEHAVIORS.map(function (b) {
      var applicable = calls.filter(function (c) {
        return typeof b.applies !== 'function' || b.applies(c);
      });
      var done = applicable.filter(function (c) { return c.behaviors.indexOf(b.id) !== -1; }).length;
      return {
        id: b.id, name: b.name, short: b.short, icon: b.icon, core: !!b.core, phase: b.phase,
        n: applicable.length, done: done,
        pct: applicable.length ? Math.round((done / applicable.length) * 100) : null
      };
    });
  };

  /* --------------------------------------------------------------------
   * Correlation: does doing X actually move resolution and handle time?
   * Only reported when both sides have a usable sample.
   * ------------------------------------------------------------------ */
  CT.correlations = function (calls, minSample) {
    minSample = minSample || 5;
    var out = [];
    CT.BEHAVIORS.forEach(function (b) {
      var pool = calls.filter(function (c) {
        return typeof b.applies !== 'function' || b.applies(c);
      });
      var withB = pool.filter(function (c) { return c.behaviors.indexOf(b.id) !== -1; });
      var without = pool.filter(function (c) { return c.behaviors.indexOf(b.id) === -1; });
      if (withB.length < minSample || without.length < minSample) return;
      var rate = function (arr) { return Math.round((arr.filter(function (c) { return c.flags.resolved === true; }).length / arr.length) * 100); };
      var aht = function (arr) { return Math.round(arr.reduce(function (a, c) { return a + (c.duration || 0); }, 0) / arr.length); };
      out.push({
        id: b.id, name: b.short || b.name,
        withN: withB.length, withoutN: without.length,
        resWith: rate(withB), resWithout: rate(without),
        delta: rate(withB) - rate(without),
        ahtWith: aht(withB), ahtWithout: aht(without),
        ahtDelta: aht(withB) - aht(without)
      });
    });
    return out.sort(function (a, b) { return b.delta - a.delta; });
  };

  /* Repeat callers within scope, richest first. */
  CT.repeatCallers = function (calls) {
    var groups = {};
    calls.forEach(function (c) {
      var n = c.identifier && c.identifier.norm;
      if (!n) return;
      (groups[n] = groups[n] || []).push(c);
    });
    return Object.keys(groups)
      .map(function (k) { return { norm: k, calls: groups[k].sort(function (a, b) { return new Date(a.startedAt || 0) - new Date(b.startedAt || 0); }) }; })
      .filter(function (g) { return g.calls.length > 1; })
      .sort(function (a, b) { return b.calls.length - a.calls.length; });
  };

  /* --------------------------------------------------------------------
   * Daily quests — deterministic per day, no randomness across reloads.
   * ------------------------------------------------------------------ */
  CT.questsForToday = function () {
    var key = CT.dayKey();
    var seed = 0;
    for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    var pool = CT.QUESTS.slice();
    var picked = [];
    for (var n = 0; n < 3 && pool.length; n++) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      picked.push(pool.splice(seed % pool.length, 1)[0]);
    }
    var todays = CT.callsForDay(key);
    return picked.map(function (q) {
      var progress = q.measure(todays) || 0;
      return {
        id: q.id, name: q.name, xp: q.xp, goal: q.goal, unit: q.unit || '',
        desc: q.desc.replace('{goal}', q.goal),
        progress: Math.min(progress, q.goal),
        raw: progress,
        done: progress >= q.goal,
        claimed: ((CT.state.questState[key] || {}).claimed || []).indexOf(q.id) !== -1
      };
    });
  };

  CT.claimQuest = function (id) {
    var key = CT.dayKey();
    var st = CT.state.questState[key] = CT.state.questState[key] || { claimed: [] };
    if (st.claimed.indexOf(id) !== -1) return 0;
    var q = CT.QUESTS.filter(function (x) { return x.id === id; })[0];
    if (!q) return 0;
    st.claimed.push(id);
    CT.state.profile.xp += q.xp;
    CT.save();
    return q.xp;
  };

  /* --------------------------------------------------------------------
   * Trophies — returns newly unlocked ones so the UI can celebrate.
   * ------------------------------------------------------------------ */
  CT.checkTrophies = function () {
    var stats = CT.computeStats(CT.state.calls);
    var fresh = [];
    CT.ACHIEVEMENTS.forEach(function (a) {
      if (CT.state.trophies[a.id]) return;
      var ok = false;
      try { ok = !!a.test(stats, CT.state); } catch (e) { ok = false; }
      if (ok) {
        CT.state.trophies[a.id] = new Date().toISOString();
        fresh.push(a);
      }
    });
    return fresh;
  };

  /* --------------------------------------------------------------------
   * Backup — an explicit, user-initiated file. Still never leaves the box
   * unless the user personally moves it.
   * ------------------------------------------------------------------ */
  CT.exportJSON = function () {
    return JSON.stringify(CT.state, null, 2);
  };

  CT.importJSON = function (text) {
    var parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.calls)) {
      throw new Error('That file does not look like a Call Tracker backup.');
    }
    CT.state = migrate(parsed);
    CT.save(true);
  };
})();
