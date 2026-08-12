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
 * report.js — builds the end-of-shift ASCII debrief.
 *
 * Deliberately free of emoji: every glyph here is single-width so the whole
 * document stays aligned when pasted into Teams, Notepad or a ticket.
 * ======================================================================== */

var CT = window.CT || (window.CT = {});

(function () {
  'use strict';

  var W = 78;              // total document width
  var INNER = W - 4;       // usable width inside a box row

  /* --------------------------------------------------------------------
   * Text primitives
   * ------------------------------------------------------------------ */
  function rep(ch, n) { return n > 0 ? new Array(n + 1).join(ch) : ''; }
  function fit(s, n) {
    s = String(s === null || s === undefined ? '' : s);
    if (s.length > n) return n > 1 ? s.slice(0, n - 1) + '…' : s.slice(0, n);
    return s + rep(' ', n - s.length);
  }
  function rfit(s, n) {
    s = String(s === null || s === undefined ? '' : s);
    if (s.length > n) return s.slice(0, n);
    return rep(' ', n - s.length) + s;
  }
  function center(s, n) {
    s = String(s);
    if (s.length >= n) return s.slice(0, n);
    var left = Math.floor((n - s.length) / 2);
    return rep(' ', left) + s + rep(' ', n - s.length - left);
  }
  function head(title) {
    var left = '┌─ ' + title + ' ';
    return left + rep('─', Math.max(0, W - left.length - 1)) + '┐';
  }
  function row(s) { return '│ ' + fit(s, INNER) + ' │'; }
  function sep() { return '├' + rep('─', W - 2) + '┤'; }
  function foot() { return '└' + rep('─', W - 2) + '┘'; }
  function blank() { return row(''); }

  function wrap(text, width) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (word) {
      if (!cur.length) { cur = word; return; }
      if ((cur + ' ' + word).length <= width) cur += ' ' + word;
      else { lines.push(cur); cur = word; }
    });
    if (cur.length) lines.push(cur);
    return lines;
  }

  function bar(pct, width) {
    pct = Math.max(0, Math.min(100, pct || 0));
    var filled = Math.round((pct / 100) * width);
    return rep('█', filled) + rep('░', width - filled);
  }

  var SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  function spark(values) {
    var max = Math.max.apply(null, values.concat([1]));
    return values.map(function (v) {
      if (!v) return ' ';
      return SPARK[Math.min(SPARK.length - 1, Math.floor((v / max) * (SPARK.length - 1)))];
    }).join('');
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  /* --------------------------------------------------------------------
   * Banner — hand-tuned 6-row block glyphs, all fixed width so the
   * letters can never drift out of alignment.
   * ------------------------------------------------------------------ */
  var GLYPH = {
    C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
    A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
    L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
    T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
    R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
    K: ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'],
    E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝']
  };

  function bigWord(word) {
    var lines = ['', '', '', '', '', ''];
    word.split('').forEach(function (ch) {
      var g = GLYPH[ch];
      if (!g) return;
      for (var i = 0; i < 6; i++) lines[i] += g[i];
    });
    return lines;
  }

  function banner() {
    var out = ['╔' + rep('═', W - 2) + '╗'];
    bigWord('CALL').forEach(function (l) { out.push('║' + center(l, W - 2) + '║'); });
    bigWord('TRACKER').forEach(function (l) { out.push('║' + center(l, W - 2) + '║'); });
    out.push('║' + center('· A R C A D E   E D I T I O N ·', W - 2) + '║');
    out.push('╚' + rep('═', W - 2) + '╝');
    return out;
  }

  /* --------------------------------------------------------------------
   * Flag strip used in the call log
   * ------------------------------------------------------------------ */
  function flagStrip(c) {
    var f = c.flags || {};
    return [
      f.verified === true ? 'V' : (f.verified === false ? 'v' : '.'),
      f.escalated === true ? 'E' : '.',
      f.cancelIntent === true ? 'X' : '.',
      f.pastDue === true ? 'D' : '.',
      f.collected === true ? '$' : '.',
      f.resolved === true ? 'R' : '.',
      c.repeatOf > 0 ? '*' : '.',
      c.coreCombo ? '5' : '.'
    ].join('');
  }

  /* --------------------------------------------------------------------
   * Insight engine — thresholds and correlations turned into sentences.
   * ------------------------------------------------------------------ */
  function insights(calls, s, adoption, corr) {
    var out = [];
    var byId = {};
    adoption.forEach(function (a) { byId[a.id] = a; });
    var get = function (id) { return byId[id] && byId[id].pct !== null ? byId[id].pct : null; };

    if (s.total < 5) {
      out.push(['NOTE', 'Only ' + s.total + ' call' + (s.total === 1 ? '' : 's') + ' in this window. Log a full shift before reading too much into the numbers.']);
    }

    var restate = get('restateIssue');
    if (restate !== null && restate < 70) {
      out.push(['LEVER', 'Restate is at ' + restate + '%. It is the cheapest FCR behavior you have and it is the one you are dropping. Front-load it before you touch the account.']);
    } else if (restate !== null && restate >= 90) {
      out.push(['STRENGTH', 'Restate at ' + restate + '% — that is a locked-in habit. Stop spending attention on it and move the focus to your weakest behavior.']);
    }

    if (s.repeatRate >= 20 && s.repeats >= 3) {
      out.push(['CALLBACKS', s.repeats + ' of ' + s.total + ' calls (' + s.repeatRate + '%) were repeat callers. Pull those accounts up in the CALLBACK RADAR below — the first call is where the miss happened.']);
    }

    var noId = get('tmobileIdHelp');
    if (s.noTmobileId >= 3) {
      out.push(['DIGITAL', s.noTmobileId + ' customers had no T-Mobile ID' + (noId !== null ? ' and you set it up ' + noId + '% of the time' : '') + '. Every one of those is a future call you already paid for.']);
    }
    if (s.tlifeNo >= 3) {
      out.push(['DIGITAL', s.tlifeNo + ' customers could not use T-Life. Worth noting the reason in the sub-reason field — device age and app install are very different problems.']);
    }

    if (s.pastDue >= 2) {
      var noPa = s.pastDue - s.arrangements;
      var askRate = pct(s.collectAttempts, Math.max(1, noPa));
      out.push(['MONEY', s.pastDue + ' past due account' + (s.pastDue === 1 ? '' : 's') + ', ' + s.arrangements + ' already had an arrangement. You asked for payment on ' + askRate + '% of the ones that did not, and collected ' + CT.fmtMoney(s.collectedTotal) + ' across ' + s.collections + ' call' + (s.collections === 1 ? '' : 's') + '.']);
      if (askRate < 60 && noPa >= 2) {
        out.push(['MONEY', 'You are leaving the ask on the table. Past due + no arrangement is a script, not a judgement call: state the amount, offer to take it now.']);
      }
    }

    if (s.cancels >= 1) {
      var saveRate = pct(s.saveAttempts, s.cancels);
      out.push(['RETENTION', s.cancels + ' cancel/churn call' + (s.cancels === 1 ? '' : 's') + ', save attempted on ' + saveRate + '%, ' + s.saves + ' ended resolved. Find the real reason before you offer anything.']);
    }

    if (s.escalated >= 2) {
      var escRes = pct(calls.filter(function (c) { return c.flags.escalated === true && c.flags.resolved === true; }).length, s.escalated);
      out.push(['HEAT', s.escalated + ' escalated caller' + (s.escalated === 1 ? '' : 's') + ', ' + escRes + '% resolved. Hot calls are where the "so you do not have to call back" line earns the most.']);
    }

    if (s.resolutionRate < 60 && s.total >= 8) {
      out.push(['OUTCOME', 'Resolution is ' + s.resolutionRate + '%. Some of that is honest — not everything is fixable in one call — but check whether you are marking NO because it is genuinely open or because you never closed the loop.']);
    } else if (s.resolutionRate >= 85 && s.total >= 8) {
      out.push(['OUTCOME', 'Resolution at ' + s.resolutionRate + '%. That is the number that keeps you off coaching plans. Keep it.']);
    }

    // Correlation callouts: does the behavior actually pay?
    corr.slice(0, 2).forEach(function (c) {
      if (c.delta >= 12) {
        out.push(['CORRELATION', 'Calls where you did "' + c.name + '" resolved ' + c.resWith + '% of the time vs ' + c.resWithout + '% without it (+' + c.delta + ' pts across ' + (c.withN + c.withoutN) + ' calls). That is your highest-yield habit right now.']);
      }
    });
    var worstCorr = corr[corr.length - 1];
    if (worstCorr && worstCorr.delta <= -12) {
      out.push(['CORRELATION', '"' + worstCorr.name + '" shows up more on unresolved calls (' + worstCorr.resWith + '% vs ' + worstCorr.resWithout + '%). Usually that means you reach for it when a call is already going sideways — not that it hurts.']);
    }

    // Weakest applicable behaviors become the action plan.
    var weak = adoption.filter(function (a) { return a.pct !== null && a.n >= Math.max(3, Math.round(s.total * 0.3)); })
      .sort(function (a, b) { return a.pct - b.pct; }).slice(0, 3);
    if (weak.length) {
      out.push(['ACTION PLAN', 'Next shift, pick ONE: ' + weak.map(function (w) { return w.short + ' (' + w.pct + '%)'; }).join(' · ') + '. One behavior at a time is how habits actually stick.']);
    }

    if (s.aht > 900 && s.total >= 5) {
      out.push(['TIME', 'Average handle time is ' + CT.fmtDuration(s.aht) + '. Check the SDL numbers — long calls are usually diagnosis that started late, not troubleshooting that ran long.']);
    }
    if (s.hold > 0 && s.total >= 3) {
      out.push(['TIME', 'Hold time is ' + pct(s.hold, Math.max(1, s.duration)) + '% of your talk time (' + CT.fmtDuration(s.hold) + ' total). Narrate before you go quiet.']);
    }

    if (s.unidentified >= 3) {
      out.push(['DATA', s.unidentified + ' calls had no identifier, so they cannot be matched to callbacks. Even a partial number makes the CALLBACK RADAR work.']);
    }

    return out;
  }

  /* --------------------------------------------------------------------
   * The report
   * ------------------------------------------------------------------ */
  var SCOPE_LABEL = { today: 'TODAY', week: 'LAST 7 DAYS', month: 'LAST 30 DAYS', all: 'ALL TIME' };

  CT.buildReport = function (scope) {
    scope = scope || 'today';
    var calls = CT.callsInScope(scope).slice().sort(function (a, b) {
      return new Date(a.startedAt || 0) - new Date(b.startedAt || 0);
    });
    var s = CT.computeStats(calls);
    var all = CT.computeStats(CT.state.calls);
    var adoption = CT.behaviorAdoption(calls);
    var corr = CT.correlations(calls, Math.max(3, Math.floor(calls.length * 0.15)));
    var rank = CT.rankFor(CT.state.profile.xp);
    var now = new Date();
    var L = [];

    /* --- Banner ------------------------------------------------------ */
    L = L.concat(banner());
    var agent = CT.state.settings.agentName || 'Unnamed Agent';
    L.push(center(agent.toUpperCase() + '   ·   ' + (SCOPE_LABEL[scope] || 'REPORT') + '   ·   ' + now.toLocaleString(), W));
    L.push('');

    if (!calls.length) {
      L.push(head('NOTHING TO REPORT'));
      L.push(blank());
      L.push(row('  No calls logged in this window yet.'));
      L.push(row('  Start a call, tick your behaviors, and this page fills itself in.'));
      L.push(blank());
      L.push(foot());
      return L.join('\n');
    }

    /* --- Mission control --------------------------------------------- */
    L.push(head('MISSION CONTROL'));
    L.push(blank());
    L.push(row('  RANK  ' + fit('LV.' + rank.level + '  ' + rank.title, 34) + 'PROGRESS  ' + rank.pct + '% to LV.' + (rank.level + 1)));
    L.push(row('        [' + bar(rank.pct, 40) + ']  ' + rfit(rank.into + '/' + rank.span, 12)));
    L.push(row('  TOTAL XP ' + rfit(CT.state.profile.xp.toLocaleString(), 10) + '     CURRENT STREAK ' + rfit(CT.state.profile.streak + ' calls', 10) +
               '   BEST ' + CT.state.profile.bestStreak));
    L.push(blank());
    L.push(foot());
    L.push('');

    /* --- The numbers -------------------------------------------------- */
    L.push(head('THE NUMBERS  ·  ' + (SCOPE_LABEL[scope] || '')));
    L.push(blank());
    var grid = [
      ['CALLS LOGGED', String(s.total), 'AVG SCORE', s.avgScore + '%'],
      ['TALK TIME', CT.fmtDuration(s.duration), 'AVG HANDLE TIME', CT.fmtDuration(s.aht)],
      ['RESOLVED', s.resolved + ' / ' + s.total + '  (' + s.resolutionRate + '%)', 'HOLD TIME', CT.fmtDuration(s.hold)],
      ['CORE 5 COMBOS', s.coreCalls + '  (' + pct(s.coreCalls, s.total) + '%)', 'FLAWLESS CALLS', String(s.perfectCalls)],
      ['REPEAT CALLERS', s.repeats + '  (' + s.repeatRate + '%)', 'UNIDENTIFIED', String(s.unidentified)],
      ['ESCALATED', s.escalated + '  (' + pct(s.escalated, s.total) + '%)', 'CANCEL / CHURN', s.cancels + '  (' + pct(s.cancels, s.total) + '%)'],
      ['PAST DUE SEEN', String(s.pastDue), 'COLLECTED', CT.fmtMoney(s.collectedTotal)],
      ['XP EARNED', s.xpEarned.toLocaleString(), 'DAYS COVERED', String(s.days || 1)]
    ];
    grid.forEach(function (g) {
      L.push(row('  ' + fit(g[0], 18) + rfit(g[1], 16) + '     ' + fit(g[2], 18) + rfit(g[3], 14)));
    });
    L.push(blank());
    if (s.longest && s.shortest && s.longest !== s.shortest) {
      L.push(row('  Longest call ' + CT.fmtDuration(s.longest.duration) + ' (' + CT.maskId(s.longest) + ')   ·   ' +
                 'Shortest ' + CT.fmtDuration(s.shortest.duration) + ' (' + CT.maskId(s.shortest) + ')'));
      L.push(blank());
    }
    L.push(foot());
    L.push('');

    /* --- Behavior consistency ---------------------------------------- */
    L.push(head('BEHAVIOR CONSISTENCY'));
    L.push(blank());
    L.push(row('  ' + fit('BEHAVIOR', 24) + fit('ADOPTION', 22) + fit('RATE', 6) + 'HITS'));
    L.push(row('  ' + rep('·', INNER - 2)));
    var ranked = adoption.slice().sort(function (a, b) {
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
    ranked.forEach(function (a) {
      if (a.pct === null) {
        L.push(row('  ' + fit((a.core ? '* ' : '  ') + a.short, 24) + fit('— not applicable —', 22) + fit('', 6) + '0/0'));
        return;
      }
      var mark = a.pct >= 85 ? ' ^' : (a.pct < 50 ? ' !' : '  ');
      L.push(row('  ' + fit((a.core ? '* ' : '  ') + a.short, 24) + fit(bar(a.pct, 20), 22) + rfit(a.pct + '%', 4) + mark + '  ' + a.done + '/' + a.n));
    });
    L.push(blank());
    L.push(row('  * CORE 5      ^ locked in (85%+)      ! needs work (under 50%)'));
    L.push(blank());
    L.push(foot());
    L.push('');

    /* --- Why they called ---------------------------------------------- */
    var reasons = Object.keys(s.reasonCounts).map(function (k) {
      return { id: k, n: s.reasonCounts[k], name: (CT.REASON_BY_ID[k] || { name: k }).name };
    }).sort(function (a, b) { return b.n - a.n; });
    if (reasons.length) {
      L.push(head('WHY THEY CALLED'));
      L.push(blank());
      var top = reasons[0];
      reasons.forEach(function (r) {
        var p = pct(r.n, s.total);
        L.push(row('  ' + fit(r.name, 26) + fit(bar(pct(r.n, top.n), 24), 26) + rfit(r.n, 4) + '  ' + rfit(p + '%', 4)));
      });
      L.push(blank());
      var unresolvedByReason = reasons.map(function (r) {
        var pool = calls.filter(function (c) { return c.reason === r.id; });
        return { name: r.name, n: pool.length, res: pct(pool.filter(function (c) { return c.flags.resolved === true; }).length, pool.length) };
      }).filter(function (r) { return r.n >= 3; }).sort(function (a, b) { return a.res - b.res; });
      if (unresolvedByReason.length) {
        L.push(row('  Hardest to resolve: ' + unresolvedByReason.slice(0, 3).map(function (r) {
          return r.name + ' (' + r.res + '%)';
        }).join('  ·  ')));
        L.push(blank());
      }
      L.push(foot());
      L.push('');
    }

    /* --- Money & retention -------------------------------------------- */
    if (s.pastDue || s.cancels || s.collectedTotal) {
      L.push(head('MONEY & RETENTION'));
      L.push(blank());
      L.push(row('  Past due accounts seen ......... ' + s.pastDue));
      L.push(row('  Already had an arrangement ..... ' + s.arrangements + '  (' + pct(s.arrangements, s.pastDue) + '% of past due)'));
      L.push(row('  Collection attempted ........... ' + s.collectAttempts + '  (' + pct(s.collectAttempts, Math.max(1, s.pastDue - s.arrangements)) + '% of the ones without a PA)'));
      L.push(row('  Payments collected ............. ' + s.collections + '  totalling ' + CT.fmtMoney(s.collectedTotal)));
      L.push(blank());
      L.push(row('  Cancel / churn-risk calls ...... ' + s.cancels));
      L.push(row('  Save attempted ................. ' + s.saveAttempts + '  (' + pct(s.saveAttempts, s.cancels) + '%)'));
      L.push(row('  Cancel calls ending resolved ... ' + s.saves));
      if (s.tenureN) {
        L.push(blank());
        L.push(row('  Average tenure logged .......... ' + (s.tenureSum / s.tenureN).toFixed(1) + ' years across ' + s.tenureN + ' calls'));
      }
      L.push(blank());
      L.push(foot());
      L.push('');
    }

    /* --- Digital adoption --------------------------------------------- */
    var digitalKnown = s.hasTmobileId + s.noTmobileId + s.tlifeYes + s.tlifeNo;
    if (digitalKnown) {
      L.push(head('DIGITAL ADOPTION'));
      L.push(blank());
      L.push(row('  T-Mobile ID   ' + fit('has it: ' + s.hasTmobileId, 16) + fit('no ID: ' + s.noTmobileId, 16) +
                 'coverage ' + pct(s.hasTmobileId, Math.max(1, s.hasTmobileId + s.noTmobileId)) + '%'));
      L.push(row('  T-Life app    ' + fit('able: ' + s.tlifeYes, 16) + fit('unable: ' + s.tlifeNo, 16) +
                 'coverage ' + pct(s.tlifeYes, Math.max(1, s.tlifeYes + s.tlifeNo)) + '%'));
      L.push(row('  Self-help sent on ' + (s.behaviorCounts.sentSelfHelp || 0) + ' of ' + s.total + ' calls (' + pct(s.behaviorCounts.sentSelfHelp || 0, s.total) + '%)'));
      L.push(row('  Personal guarantee sent on ' + (s.behaviorCounts.personalGuarantee || 0) + ' of ' + s.total + ' calls (' + pct(s.behaviorCounts.personalGuarantee || 0, s.total) + '%)'));
      L.push(blank());
      L.push(foot());
      L.push('');
    }

    /* --- Callback radar ------------------------------------------------ */
    var repeats = CT.repeatCallers(calls);
    if (repeats.length) {
      L.push(head('CALLBACK RADAR'));
      L.push(blank());
      L.push(row('  ' + fit('CUSTOMER', 14) + fit('CALLS', 7) + fit('GAP', 10) + fit('REASONS', 26) + 'RESOLVED'));
      L.push(row('  ' + rep('·', INNER - 2)));
      repeats.slice(0, 12).forEach(function (g) {
        var first = g.calls[0], last = g.calls[g.calls.length - 1];
        var gap = '—';
        if (first.startedAt && last.startedAt) {
          var hrs = (new Date(last.startedAt) - new Date(first.startedAt)) / 3600000;
          gap = hrs < 24 ? hrs.toFixed(1) + 'h' : (hrs / 24).toFixed(1) + 'd';
        }
        var rs = {};
        g.calls.forEach(function (c) { if (c.reason) rs[(CT.REASON_BY_ID[c.reason] || {}).tag || c.reason] = 1; });
        var resolvedN = g.calls.filter(function (c) { return c.flags.resolved === true; }).length;
        L.push(row('  ' + fit(CT.maskId(last), 14) + fit('x' + g.calls.length, 7) + fit(gap, 10) +
                   fit(Object.keys(rs).join(',') || '—', 26) + resolvedN + '/' + g.calls.length));
      });
      L.push(blank());
      L.push(row('  A same-day repeat is a first-call miss. Read the earlier call before you'));
      L.push(row('  read the customer.'));
      L.push(blank());
      L.push(foot());
      L.push('');
    }

    /* --- Time on the line ---------------------------------------------- */
    if (s.dated) {
      L.push(head('TIME ON THE LINE'));
      L.push(blank());
      // One column per hour, with a tick label every three hours.
      var axis = new Array(24).fill(' ');
      for (var h = 0; h < 24; h += 3) {
        String(h).split('').forEach(function (ch, k) { if (h + k < 24) axis[h + k] = ch; });
      }
      L.push(row('  Calls by hour   ·   peak ' + Math.max.apply(null, s.hourCounts) + ' calls'));
      L.push(row('  ' + spark(s.hourCounts)));
      L.push(row('  ' + axis.join('')));
      L.push(blank());
      var buckets = [
        ['under 5 min', function (d) { return d < 300; }],
        ['5 - 10 min', function (d) { return d >= 300 && d < 600; }],
        ['10 - 20 min', function (d) { return d >= 600 && d < 1200; }],
        ['20 - 30 min', function (d) { return d >= 1200 && d < 1800; }],
        ['30 min +', function (d) { return d >= 1800; }]
      ];
      buckets.forEach(function (b) {
        var n = calls.filter(function (c) { return b[1](c.duration || 0); }).length;
        L.push(row('  ' + fit(b[0], 14) + fit(bar(pct(n, s.total), 30), 32) + rfit(n, 4) + '  ' + rfit(pct(n, s.total) + '%', 4)));
      });
      L.push(blank());
      L.push(foot());
      L.push('');
    }

    /* --- Correlations --------------------------------------------------- */
    if (corr.length) {
      L.push(head('DOES IT ACTUALLY WORK?  ·  RESOLUTION WITH vs WITHOUT'));
      L.push(blank());
      L.push(row('  ' + fit('BEHAVIOR', 22) + fit('WITH', 12) + fit('WITHOUT', 12) + fit('DELTA', 10) + 'AHT SHIFT'));
      L.push(row('  ' + rep('·', INNER - 2)));
      corr.slice(0, 8).forEach(function (c) {
        var d = (c.delta > 0 ? '+' : '') + c.delta + ' pts';
        var a = (c.ahtDelta > 0 ? '+' : '-') + CT.fmtDuration(Math.abs(c.ahtDelta));
        L.push(row('  ' + fit(c.name, 22) + fit(c.resWith + '% (n=' + c.withN + ')', 12) +
                   fit(c.resWithout + '% (n=' + c.withoutN + ')', 12) + fit(d, 10) + a));
      });
      L.push(blank());
      L.push(row('  Correlation, not proof — but a habit that never moves the number is a'));
      L.push(row('  habit worth questioning.'));
      L.push(blank());
      L.push(foot());
      L.push('');
    }

    /* --- Insights -------------------------------------------------------- */
    var ins = insights(calls, s, adoption, corr);
    if (ins.length) {
      L.push(head('READ THIS PART'));
      L.push(blank());
      ins.forEach(function (item) {
        var lines = wrap(item[1], INNER - 16);
        L.push(row('  ' + fit('[' + item[0] + ']', 14) + lines[0]));
        lines.slice(1).forEach(function (l) { L.push(row('  ' + rep(' ', 14) + l)); });
        L.push(blank());
      });
      L.push(foot());
      L.push('');
    }

    /* --- Call log --------------------------------------------------------- */
    L.push(head('CALL LOG'));
    L.push(blank());
    L.push(row(fit('TIME', 6) + fit('DUR', 8) + fit('CUSTOMER', 14) + fit('WHY', 7) + fit('FLAGS', 10) + fit('SCR', 5) + 'NOTE'));
    L.push(row(rep('·', INNER)));
    calls.forEach(function (c) {
      var reasonTag = c.reason ? ((CT.REASON_BY_ID[c.reason] || {}).tag || c.reason) : '—';
      var note = c.subReason || c.notes || '';
      L.push(row(
        fit(c.startedAt ? CT.fmtClock(c.startedAt) : '—', 6) +
        fit(CT.fmtDuration(c.duration), 8) +
        fit(CT.maskId(c), 14) +
        fit(reasonTag, 7) +
        fit(flagStrip(c), 10) +
        fit((c.score || 0) + '%', 5) +
        fit(note, 23)
      ));
    });
    L.push(blank());
    L.push(row('FLAGS  V verified · v failed verification · E escalated · X cancel risk'));
    L.push(row('       D past due · $ collected · R resolved · * repeat · 5 core combo'));
    L.push(blank());
    L.push(foot());
    L.push('');

    /* --- Trophy case ------------------------------------------------------ */
    var unlocked = CT.ACHIEVEMENTS.filter(function (a) { return CT.state.trophies[a.id]; });
    L.push(head('TROPHY CASE  ·  ' + unlocked.length + ' / ' + CT.ACHIEVEMENTS.length));
    L.push(blank());
    if (unlocked.length) {
      for (var i = 0; i < unlocked.length; i += 2) {
        var a1 = unlocked[i], a2 = unlocked[i + 1];
        L.push(row('  ' + fit('[*] ' + a1.name, 34) + (a2 ? fit('[*] ' + a2.name, 34) : '')));
      }
    } else {
      L.push(row('  Locked. Finish a call to open the case.'));
    }
    var next = CT.ACHIEVEMENTS.filter(function (a) { return !CT.state.trophies[a.id]; })[0];
    if (next) {
      L.push(blank());
      L.push(row('  Next up: ' + next.name + ' — ' + next.desc));
    }
    L.push(blank());
    L.push(foot());
    L.push('');

    /* --- Footer ------------------------------------------------------------ */
    L.push('┌' + rep('─', W - 2) + '┐');
    L.push(row(center('ALL-TIME: ' + all.total + ' calls · ' + CT.fmtDuration(all.duration) + ' on the line · ' +
                      all.resolutionRate + '% resolved · ' + CT.fmtMoney(all.collectedTotal) + ' collected', INNER)));
    L.push(row(center('Generated locally. No data left this device.', INNER)));
    L.push(row(center('Call Tracker v' + CT.VERSION + ' · micah4thewin.github.io/calltracker', INNER)));
    L.push(foot());

    return L.join('\n');
  };

  /* --------------------------------------------------------------------
   * Per-call recap — short enough to paste into notes or Teams.
   * ------------------------------------------------------------------ */
  CT.buildRecap = function (call, meta) {
    var w = 60;
    var line = function (s) { return '│ ' + fit(s, w - 4) + ' │'; };
    var out = [];
    out.push('┌' + rep('─', w - 2) + '┐');
    out.push(line('CALL RECAP   ' + (call.startedAt ? CT.fmtClock(call.startedAt) : '') + '   ' + CT.fmtDuration(call.duration)));
    out.push('├' + rep('─', w - 2) + '┤');
    out.push(line(CT.idLabel(call) + (call.repeatOf > 0 ? '   [REPEAT x' + (call.repeatOf + 1) + ']' : '')));
    out.push(line('Reason: ' + (call.reason ? (CT.REASON_BY_ID[call.reason] || {}).name : 'not set')));

    var state = [];
    if (call.flags.verified === true) state.push('verified');
    if (call.flags.verified === false) state.push('NOT verified');
    if (call.flags.escalated === true) state.push('escalated');
    if (call.flags.cancelIntent === true) state.push('cancel risk');
    if (call.flags.pastDue === true) state.push(call.flags.hasArrangement === true ? 'past due (has PA)' : 'past due (no PA)');
    if (call.flags.collected === true) state.push('collected ' + CT.fmtMoney(call.collectedAmount));
    state.push(call.flags.resolved === true ? 'RESOLVED' : 'not resolved');
    wrap(state.join(' · '), w - 4).forEach(function (l) { out.push(line(l)); });

    out.push('├' + rep('─', w - 2) + '┤');
    out.push(line('Score ' + call.score + '%   ' + bar(call.score, 20) + '  +' + call.xp + ' XP'));
    if (call.coreCombo) out.push(line('CORE 5 COMBO LANDED' + (meta && meta.streak ? '   streak x' + meta.streak : '')));
    out.push('├' + rep('─', w - 2) + '┤');

    var done = call.behaviors.map(function (id) { return (CT.BEHAVIOR_BY_ID[id] || {}).short || id; });
    var missed = CT.applicableBehaviors(call)
      .filter(function (b) { return call.behaviors.indexOf(b.id) === -1; })
      .map(function (b) { return b.short; });
    out.push(line('DID:'));
    (done.length ? wrap(done.join(', '), w - 6) : ['(nothing logged)']).forEach(function (l) { out.push(line('  ' + l)); });
    if (missed.length) {
      out.push(line('MISSED:'));
      wrap(missed.join(', '), w - 6).forEach(function (l) { out.push(line('  ' + l)); });
    }
    if (call.notes) {
      out.push('├' + rep('─', w - 2) + '┤');
      wrap('NOTE: ' + call.notes, w - 4).forEach(function (l) { out.push(line(l)); });
    }
    out.push('└' + rep('─', w - 2) + '┘');
    return out.join('\n');
  };
})();
