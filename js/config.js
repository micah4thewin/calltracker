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
 * config.js — the rulebook.
 * Every behavior, flag, reason, level, quest, trophy and Teams template lives
 * here so the rest of the app stays generic. Nothing in this file talks to the
 * network; it is pure data.
 * ======================================================================== */

var CT = window.CT || (window.CT = {});

CT.VERSION = '3.0.0';
CT.STORAGE_KEY = 'ct.v3.state';

/* --- Call phases -------------------------------------------------------- */
CT.PHASES = [
  { id: 'open',     name: 'OPEN',     icon: '\u{1F680}', blurb: 'First 60 seconds. Own the room.' },
  { id: 'discover', name: 'DISCOVER', icon: '\u{1F50D}', blurb: 'Audit, interrogate, quantify.' },
  { id: 'solve',    name: 'SOLVE',    icon: '\u{1F6E0}',  blurb: 'Tools, fixes, digital handoff.' },
  { id: 'close',    name: 'CLOSE',    icon: '\u{1F3C1}', blurb: 'Land it so they never call back.' }
];

/* --- Behaviors ----------------------------------------------------------
 * id      stable key, also used in saved history (never rename)
 * key     keyboard shortcut
 * xp      points awarded (before combo multiplier)
 * core    part of the CORE 5 combo
 * applies (call) => is this behavior scored on this call?
 * scripts real phrasing the rep can steal, shown on hover/focus
 * ---------------------------------------------------------------------- */
/* Reasons where a troubleshooting triage actually applies. Until a reason is
 * picked we assume it might, so the chips stay visible rather than popping in. */
CT.TECH_REASONS = ['device', 'network', 'data', 'voice', 'messaging', 'voicemail',
  'intl', 'sim', 'tlife', 'homeint', 'iot', 'access', 'other'];
function isTechCall(c) {
  return !c.reason || CT.TECH_REASONS.indexOf(c.reason) !== -1;
}

CT.BEHAVIORS = [
  /* ---------------------------- OPEN --------------------------------- */
  {
    id: 'verifyCustomer', phase: 'open', key: '1', xp: 4,
    name: 'Verified the customer', short: 'Verified', icon: '\u{1F510}',
    hint: 'No CPNI moves until auth passes. Auto-ticks when you set Verified.',
    scripts: [
      'Before we dive in, let me get you verified real quick so I can actually help.',
      'I can pull the account up — I just need to verify you first, one second.'
    ],
    cheers: ['Locked and verified.', 'Auth first. Always.', 'CPNI clean. Nice.']
  },
  {
    id: 'acknowledgeTenure', phase: 'open', key: '2', xp: 4,
    name: 'Acknowledged tenure', short: 'Tenure', icon: '\u{1F396}',
    hint: 'Loyalty is the cheapest save you have. Say the number of years out loud.',
    scripts: [
      'Twelve years with us — that is not nothing. Thank you for sticking around.',
      'I see you have been with T-Mobile since 2016. Genuinely, thank you.',
      'You have been with us longer than I have worked here. Let me take care of this.'
    ],
    cheers: ['Loyalty acknowledged.', 'That is how you disarm someone.', 'Tenure named. Tension dropped.']
  },
  {
    id: 'restateIssue', phase: 'open', key: '3', xp: 6, core: true,
    name: 'Restated issue + verbal confirm', short: 'Restate', icon: '\u{1F501}',
    hint: 'The single highest-leverage FCR behavior. Restate, then WAIT for a yes.',
    scripts: [
      'So just to make sure I have it right — you are calling because [issue]. Is that correct?',
      'Let me play that back: [issue], and it started [when]. Did I get that right?',
      'What I am hearing is [issue] — am I understanding that correctly?'
    ],
    cheers: ['Restate = FCR gold.', 'Confirmed before you moved. Perfect.', 'That is the behavior. Keep it.']
  },
  {
    id: 'setExpectations', phase: 'open', key: '4', xp: 4,
    name: 'Set expectations for the call', short: 'Roadmap', icon: '\u{1F5FA}',
    hint: 'Tell them the plan and the time cost. Silence is where escalations grow.',
    scripts: [
      'Here is my plan: audit the account, test the line, then fix it. Give me about ten minutes.',
      'I am going to be quiet for a moment while I read — I have not disappeared.'
    ],
    cheers: ['Roadmap given.', 'No mystery, no anxiety.', 'They know the plan now.']
  },

  /* -------------------------- DISCOVER ------------------------------- */
  {
    id: 'accountAudit', phase: 'discover', key: '5', xp: 6, core: true,
    name: 'Full account audit', short: 'Audit', icon: '\u{1F9FE}',
    hint: 'Plan, lines, features, promos, credits, device protection, autopay.',
    scripts: [
      'While I have you, let me audit the whole account so nothing bites you later.',
      'I am checking your plan, promos and features — sometimes the fix is already here.'
    ],
    cheers: ['Audited. Found the landmines.', 'That is Expert of Experts work.', 'Full sweep done.']
  },
  {
    id: 'sdlSituation', phase: 'discover', key: 'q', xp: 3,
    name: 'SDL — Situation', short: 'Situation', icon: '❓',
    applies: isTechCall,
    hint: 'What exactly happens? Get the observable symptom, not the customer diagnosis.',
    scripts: ['Walk me through exactly what happens when you try it.'],
    cheers: ['Situation captured.']
  },
  {
    id: 'sdlDuration', phase: 'discover', key: 'w', xp: 3,
    name: 'SDL — Duration', short: 'Duration', icon: '⏱',
    applies: isTechCall,
    hint: 'When did it start? Did anything change that day (update, SIM, move, plan change)?',
    scripts: ['When did this start, and did anything change around that time?'],
    cheers: ['Timeline locked.']
  },
  {
    id: 'sdlLocation', phase: 'discover', key: 'e', xp: 3,
    name: 'SDL — Location', short: 'Location', icon: '\u{1F4CD}',
    applies: isTechCall,
    hint: 'Where? Indoors/outdoors, one address or everywhere. Drives the whole tech path.',
    scripts: ['Is this everywhere you go, or mostly at one address?'],
    cheers: ['Location pinned.']
  },
  {
    id: 'checkBalance', phase: 'discover', key: '6', xp: 5, core: true,
    name: 'Checked account balance', short: 'Balance', icon: '\u{1F4B3}',
    hint: 'Always look. A surprise suspension tomorrow is a callback you own.',
    scripts: [
      'Let me peek at the balance so nothing surprises you in a few days.',
      'While I am here — your next bill is $X on the Yth. Just so there are no surprises.'
    ],
    cheers: ['Balance checked. No surprises.', 'Callback prevented.']
  },
  {
    id: 'paymentArrangement', phase: 'discover', key: '7', xp: 7,
    name: 'Reviewed / set payment arrangement', short: 'Arrangement', icon: '\u{1F4C6}',
    applies: function (c) { return c.flags.pastDue === true; },
    hint: 'Past due? Either they have an arrangement or you build one. No third option.',
    scripts: [
      'I can split this into two payments so the line stays on — want me to set that up?',
      'Let me get an arrangement on here so nothing suspends while you sort this out.'
    ],
    cheers: ['Arrangement handled.', 'Suspension dodged.']
  },
  {
    id: 'attemptedCollection', phase: 'discover', key: '8', xp: 8,
    name: 'Attempted to collect', short: 'Collect', icon: '\u{1F4B0}',
    applies: function (c) { return c.flags.pastDue === true && c.flags.hasArrangement !== true; },
    hint: 'Past due with no arrangement = ask for the money. Politely, but ask.',
    scripts: [
      'Would you like to take care of that $X today so I can close this out clean?',
      'I can take a payment right now if that is easiest — card or bank?'
    ],
    cheers: ['You asked. That is the job.', 'Never shy about the ask.']
  },

  /* ---------------------------- SOLVE -------------------------------- */
  {
    id: 'usedNBA', phase: 'solve', key: '9', xp: 5,
    name: 'Used NBA (Next Best Action)', short: 'NBA', icon: '\u{1F3AF}',
    hint: 'Read the NBA panel before you improvise. It usually already knows.',
    scripts: ['I am checking what the system recommends for your account specifically.'],
    cheers: ['NBA used.', 'Tools before guesswork.']
  },
  {
    id: 'usedHeadstart', phase: 'solve', key: '0', xp: 5,
    name: 'Used Headstart suggestions', short: 'Headstart', icon: '\u{1F680}',
    hint: 'Headstart surfaces the known fix for the known symptom. Free speed.',
    scripts: ['Give me one second — pulling up the recommended fix for this exact issue.'],
    cheers: ['Headstart used.', 'Speedrun energy.']
  },
  {
    id: 'tmobileIdHelp', phase: 'solve', key: 'r', xp: 5,
    name: 'Confirmed / set up T-Mobile ID', short: 'T-Mo ID', icon: '\u{1F464}',
    hint: 'No T-Mobile ID = guaranteed callback. Fix it while you have them.',
    scripts: [
      'Do you have your T-Mobile ID set up? Takes ninety seconds and saves you a call later.',
      'Let me get your T-Mobile ID going so you can do this yourself next time.'
    ],
    cheers: ['ID handled.', 'That is one less future call.']
  },
  {
    id: 'tlifeWalkthrough', phase: 'solve', key: 't', xp: 5,
    name: 'Walked customer through T-Life', short: 'T-Life', icon: '\u{1F4F1}',
    applies: function (c) { return c.flags.canUseTlife !== false; },
    hint: 'Show them the exact tap path. "It is in the app" is not a walkthrough.',
    scripts: [
      'Open T-Life, bottom right — Manage. That is where this lives any time you need it.',
      'Let us do it together in T-Life so you have seen it once.'
    ],
    cheers: ['T-Life adoption.', 'You taught, not just fixed.']
  },
  {
    id: 'sentSelfHelp', phase: 'solve', key: 'y', xp: 5,
    name: 'Sent self-help to the customer', short: 'Self-help', icon: '\u{1F4E4}',
    hint: 'Send it while you are still on the line and confirm it landed.',
    scripts: [
      'I just texted you a link with the steps so you have it in writing.',
      'Check your messages — did that come through? Keep it, it covers this whole thing.'
    ],
    cheers: ['Self-help sent.', 'In writing beats from memory.']
  },
  {
    id: 'personalGuarantee', phase: 'solve', key: 'u', xp: 6, core: true,
    name: 'Sent the personal guarantee text', short: 'Guarantee', icon: '\u{1F91D}',
    hint: 'Your name, your promise, their pocket. This is the trust move.',
    scripts: [
      'I am sending you my personal guarantee text — my name is on it, so you are not starting over.',
      'That text has my info. If this comes back, you are not explaining it again from scratch.'
    ],
    cheers: ['Guarantee sent. That is ownership.', 'You put your name on it.']
  },
  {
    id: 'billingEducation', phase: 'solve', key: 'i', xp: 5,
    name: 'Explained the bill line by line', short: 'Bill walk', icon: '\u{1F4C4}',
    applies: function (c) { return c.flags.billingQuestions === true; },
    hint: 'Walk the charges in order. Proration is the usual villain.',
    scripts: [
      'Let me walk the bill top to bottom so you can see where every dollar went.',
      'This chunk here is proration from the plan change — that is a one-time thing.'
    ],
    cheers: ['Bill demystified.', 'That is a callback they will not make.']
  },

  /* ---------------------------- CLOSE -------------------------------- */
  {
    id: 'dontCallBack', phase: 'close', key: 'o', xp: 6, core: true,
    name: '"So you do not have to call back..."', short: 'No callback', icon: '\u{1F6AB}',
    hint: 'Say the literal words, then handle the thing they would have called about.',
    scripts: [
      'So you do not have to call back — let me also take care of [next thing] while I am here.',
      'I want to make sure you do not have to call back, so is there anything else nagging you?'
    ],
    cheers: ['The magic sentence.', 'Callback killed in advance.', 'That line is worth points.']
  },
  {
    id: 'recapNextSteps', phase: 'close', key: 'p', xp: 4,
    name: 'Recapped resolution & next steps', short: 'Recap', icon: '\u{1F4CB}',
    hint: 'What you did, what they do, what happens next, and when.',
    scripts: [
      'Quick recap: I did X, you will see Y on the next bill, and if Z happens, do this.',
      'So to summarize — nothing else needed from you, and it should settle within 24 hours.'
    ],
    cheers: ['Clean close.', 'They know exactly what happens next.']
  },
  {
    id: 'retentionSave', phase: 'close', key: 'a', xp: 9,
    name: 'Made a real save attempt', short: 'Save', icon: '\u{1F6E1}',
    applies: function (c) { return c.flags.cancelIntent === true; },
    hint: 'Find the actual reason before you offer anything. Price, coverage, or anger.',
    scripts: [
      'Before I process anything — what pushed you to this point? I would rather fix that.',
      'If I could solve the [reason], would staying even be on the table?'
    ],
    cheers: ['You fought for it.', 'Save attempted. Respect.']
  },
  {
    id: 'thankByName', phase: 'close', key: 'd', xp: 3,
    name: 'Thanked the customer by name', short: 'By name', icon: '❤',
    hint: 'Last thing they hear should be their own name. It lands.',
    scripts: ['Thank you for calling, Denise. Genuinely — have a good one.'],
    cheers: ['Warm exit.', 'Names matter.']
  }
];

CT.CORE_IDS = CT.BEHAVIORS.filter(function (b) { return b.core; }).map(function (b) { return b.id; });
CT.BEHAVIOR_BY_ID = CT.BEHAVIORS.reduce(function (m, b) { m[b.id] = b; return m; }, {});

/* Legacy behavior ids from older versions -> current ids */
CT.LEGACY_BEHAVIOR_MAP = {
  dontHaveToCallBack: 'dontCallBack',
  restateIssue: 'restateIssue',
  accountAudit: 'accountAudit',
  accountAuditing: 'accountAudit',
  empathy: 'acknowledgeTenure',
  ownership: 'personalGuarantee',
  balance: 'checkBalance',
  collection: 'attemptedCollection'
};

/* --- Tri-state flags ----------------------------------------------------
 * Flags are the DATA layer: they describe the call, behaviors describe the rep.
 * ---------------------------------------------------------------------- */
CT.FLAGS = [
  {
    id: 'verified', label: 'Customer verified?', yes: 'Verified', no: 'Not verified',
    tri: false, def: null, critical: true,
    hint: 'Authentication status at the start of the call.'
  },
  {
    id: 'escalated', label: 'Escalated caller?', yes: 'Escalated', no: 'Calm',
    tri: false, def: false, alertOn: true, template: 'escalated',
    hint: 'Turning this on copies a Teams heads-up for your support.'
  },
  {
    id: 'cancelIntent', label: 'Cancel / port-out risk?', yes: 'Cancel call', no: 'Not cancelling',
    tri: false, def: false, alertOn: true, template: 'cancel',
    hint: 'Turning this on copies a churn-risk heads-up for Teams.'
  },
  {
    id: 'pastDue', label: 'Account past due?', yes: 'Past due', no: 'Current',
    tri: true, def: null,
    hint: 'Unlocks the arrangement / collection chain.'
  },
  {
    id: 'hasArrangement', label: 'Payment arrangement on file?', yes: 'Has PA', no: 'No PA',
    tri: false, def: null, showIf: function (c) { return c.flags.pastDue === true; },
    hint: 'No arrangement on a past due account means you should be collecting.'
  },
  {
    id: 'collected', label: 'Collected a payment?', yes: 'Collected', no: 'Not yet',
    tri: false, def: false, showIf: function (c) { return c.flags.pastDue === true; },
    alertOn: true, template: 'collected',
    hint: 'Logs the amount and copies a flex for Teams.'
  },
  {
    id: 'billingQuestions', label: 'Billing questions?', yes: 'Yes', no: 'No',
    tri: true, def: null,
    hint: 'Unlocks the line-by-line bill walk behavior.'
  },
  {
    id: 'hasTmobileId', label: 'Has T-Mobile ID?', yes: 'Has ID', no: 'No ID',
    tri: true, def: null,
    hint: 'No ID is the #1 predictor of a callback.'
  },
  {
    id: 'canUseTlife', label: 'Able to use T-Life?', yes: 'T-Life ready', no: 'Cannot use',
    tri: true, def: null,
    hint: 'Device too old, app not installed, or just never tried.'
  },
  {
    id: 'resolved', label: 'Issue resolved?', yes: 'Resolved', no: 'Not resolved',
    tri: false, def: false, critical: true,
    hint: 'Defaults to NO on purpose. Earn the yes.'
  }
];
CT.FLAG_BY_ID = CT.FLAGS.reduce(function (m, f) { m[f.id] = f; return m; }, {});

/* --- Call reasons ------------------------------------------------------- */
CT.REASONS = [
  { id: 'billing',    name: 'Billing & Payments',  icon: '\u{1F9FE}', tag: 'BILL' },
  { id: 'pastdue',    name: 'Past Due / Collections', icon: '\u{1F4B8}', tag: 'DUE' },
  { id: 'plan',       name: 'Plan & Rate Plan',    icon: '\u{1F4CA}', tag: 'PLAN' },
  { id: 'device',     name: 'Device / Hardware',   icon: '\u{1F4F1}', tag: 'DEV' },
  { id: 'network',    name: 'Network / Coverage',  icon: '\u{1F4E1}', tag: 'NET' },
  { id: 'data',       name: 'Data / Speeds',       icon: '\u{1F4C9}', tag: 'DATA' },
  { id: 'voice',      name: 'Voice / Calling',     icon: '\u{1F4DE}', tag: 'VOX' },
  { id: 'messaging',  name: 'Messaging / SMS',     icon: '\u{1F4AC}', tag: 'SMS' },
  { id: 'voicemail',  name: 'Voicemail',           icon: '\u{1F4FC}', tag: 'VM' },
  { id: 'intl',       name: 'International / Roaming', icon: '\u{1F30D}', tag: 'INTL' },
  { id: 'sim',        name: 'SIM / eSIM / Activation', icon: '\u{1F4B3}', tag: 'SIM' },
  { id: 'access',     name: 'Account Access / T-Mobile ID', icon: '\u{1F511}', tag: 'ACCT' },
  { id: 'tlife',      name: 'T-Life App',          icon: '✨', tag: 'APP' },
  { id: 'homeint',    name: 'Home Internet',       icon: '\u{1F3E0}', tag: 'HINT' },
  { id: 'iot',        name: 'Watch / Tablet / IoT', icon: '⌚', tag: 'IOT' },
  { id: 'order',      name: 'Order / Shipping',    icon: '\u{1F4E6}', tag: 'ORD' },
  { id: 'cancel',     name: 'Cancel / Port Out',   icon: '\u{1F6AA}', tag: 'CXL' },
  { id: 'promo',      name: 'Promotions / Credits', icon: '\u{1F381}', tag: 'PROMO' },
  { id: 'fraud',      name: 'Fraud / Security',    icon: '\u{1F6E1}', tag: 'FRAUD' },
  { id: 'other',      name: 'Other',               icon: '❓', tag: 'OTHER' }
];
CT.REASON_BY_ID = CT.REASONS.reduce(function (m, r) { m[r.id] = r; return m; }, {});

/* --- Ranks -------------------------------------------------------------- */
CT.LEVELS = [
  { xp: 0,     title: 'Rookie Rep' },
  { xp: 400,   title: 'Signal Scout' },
  { xp: 1000,  title: 'Care Cadet' },
  { xp: 2000,  title: 'Ticket Tamer' },
  { xp: 3500,  title: 'Empathy Engineer' },
  { xp: 5500,  title: 'Retention Ranger' },
  { xp: 8000,  title: 'Billing Bard' },
  { xp: 12000, title: 'Tech Whisperer' },
  { xp: 17000, title: 'Churn Breaker' },
  { xp: 24000, title: 'Magenta Maverick' },
  { xp: 33000, title: 'Expert of Experts' },
  { xp: 45000, title: 'Voice of the Network' },
  { xp: 60000, title: 'Legend of the Line' }
];
CT.PRESTIGE_STEP = 15000;

/* --- Trophies -----------------------------------------------------------
 * test(stats, state) is evaluated after every call against all-time numbers.
 * ---------------------------------------------------------------------- */
CT.ACHIEVEMENTS = [
  { id: 'first',      icon: '\u{1F423}', name: 'First Contact',    desc: 'Log your first call.',                       test: function (s) { return s.total >= 1; } },
  { id: 'ten',        icon: '\u{1F44A}', name: 'Warmed Up',        desc: 'Log 10 calls.',                              test: function (s) { return s.total >= 10; } },
  { id: 'hundred',    icon: '\u{1F4AF}', name: 'Century Club',     desc: 'Log 100 calls.',                             test: function (s) { return s.total >= 100; } },
  { id: 'fivehundred',icon: '\u{1F451}', name: 'Five Hundred',     desc: 'Log 500 calls.',                             test: function (s) { return s.total >= 500; } },
  { id: 'combo1',     icon: '⭐',    name: 'Combo Starter',    desc: 'Land the CORE 5 on a call.',                 test: function (s) { return s.coreCalls >= 1; } },
  { id: 'combo10',    icon: '\u{1F525}', name: 'Combo Machine',    desc: '10-call CORE 5 streak.',                     test: function (s, st) { return st.profile.bestStreak >= 10; } },
  { id: 'combo25',    icon: '☄',    name: 'Unbreakable',      desc: '25-call CORE 5 streak.',                     test: function (s, st) { return st.profile.bestStreak >= 25; } },
  { id: 'perfect',    icon: '\u{1F3AF}', name: 'Flawless',         desc: 'Score 100% on a call.',                      test: function (s) { return s.perfectCalls >= 1; } },
  { id: 'perfect10',  icon: '\u{1F308}', name: 'Ten Out Of Ten',   desc: 'Ten 100% calls.',                            test: function (s) { return s.perfectCalls >= 10; } },
  { id: 'collect1',   icon: '\u{1F4B5}', name: 'Debt Collector',   desc: 'Collect on a past due account.',             test: function (s) { return s.collections >= 1; } },
  { id: 'bag500',     icon: '\u{1F4B0}', name: 'Bag Secured',      desc: 'Collect $500 total.',                        test: function (s) { return s.collectedTotal >= 500; } },
  { id: 'bag5000',    icon: '\u{1F3E6}', name: 'Small Bank',       desc: 'Collect $5,000 total.',                      test: function (s) { return s.collectedTotal >= 5000; } },
  { id: 'save1',      icon: '\u{1F6E1}', name: 'Save The Day',     desc: 'Save attempt on a cancel call.',             test: function (s) { return s.saveAttempts >= 1; } },
  { id: 'save25',     icon: '\u{1F9F2}', name: 'Churn Breaker',    desc: '25 save attempts.',                          test: function (s) { return s.saveAttempts >= 25; } },
  { id: 'hot5',       icon: '\u{1F9CA}', name: 'Cool Under Fire',  desc: 'Handle 5 escalated callers.',                test: function (s) { return s.escalated >= 5; } },
  { id: 'audit25',    icon: '\u{1F50E}', name: 'Detective',        desc: '25 full account audits.',                    test: function (s) { return (s.behaviorCounts.accountAudit || 0) >= 25; } },
  { id: 'guarantee25',icon: '\u{1F91D}', name: 'My Word On It',    desc: '25 personal guarantee texts.',               test: function (s) { return (s.behaviorCounts.personalGuarantee || 0) >= 25; } },
  { id: 'sdl25',      icon: '\u{1F9ED}', name: 'Triage Master',    desc: 'Complete SDL on 25 calls.',                  test: function (s) { return s.sdlCalls >= 25; } },
  { id: 'tlife20',    icon: '\u{1F4F2}', name: 'App Evangelist',   desc: '20 T-Life walkthroughs.',                    test: function (s) { return (s.behaviorCounts.tlifeWalkthrough || 0) >= 20; } },
  { id: 'nocall20',   icon: '\u{1F6AB}', name: 'The Magic Words',  desc: 'Say "do not have to call back" 20 times.',   test: function (s) { return (s.behaviorCounts.dontCallBack || 0) >= 20; } },
  { id: 'speed',      icon: '⚡',    name: 'Speedrun',         desc: 'CORE 5 on a call under 5 minutes.',          test: function (s) { return s.speedruns >= 1; } },
  { id: 'marathon',   icon: '\u{1F3C3}', name: 'Marathon',         desc: 'Resolve a call over 30 minutes.',            test: function (s) { return s.marathons >= 1; } },
  { id: 'cleanday',   icon: '\u{1F31E}', name: 'Clean Slate',      desc: '100% resolution on a 10+ call day.',         test: function (s) { return s.cleanDays >= 1; } }
];

/* --- Daily quests -------------------------------------------------------
 * measure(calls, stats) counts progress against today's calls only.
 * ---------------------------------------------------------------------- */
function countBehavior(id) {
  return function (calls) {
    return calls.filter(function (c) { return c.behaviors.indexOf(id) !== -1; }).length;
  };
}
CT.QUESTS = [
  { id: 'q_core',      name: 'Combo Hunter',    desc: 'Land the CORE 5 on {goal} calls',        goal: 8,  xp: 120, measure: function (calls) { return calls.filter(function (c) { return c.coreCombo; }).length; } },
  { id: 'q_restate',   name: 'Say It Back',     desc: 'Restate the issue on {goal} calls',      goal: 10, xp: 100, measure: countBehavior('restateIssue') },
  { id: 'q_audit',     name: 'Deep Diver',      desc: 'Full account audit on {goal} calls',     goal: 6,  xp: 100, measure: countBehavior('accountAudit') },
  { id: 'q_guarantee', name: 'Word Is Bond',    desc: 'Send {goal} personal guarantee texts',   goal: 5,  xp: 90,  measure: countBehavior('personalGuarantee') },
  { id: 'q_selfhelp',  name: 'Paper Trail',     desc: 'Send self-help on {goal} calls',         goal: 5,  xp: 80,  measure: countBehavior('sentSelfHelp') },
  { id: 'q_nocall',    name: 'Never Again',     desc: 'Use the no-callback line {goal} times',  goal: 7,  xp: 90,  measure: countBehavior('dontCallBack') },
  { id: 'q_sdl',       name: 'Full Triage',     desc: 'Complete SDL on {goal} calls',           goal: 4,  xp: 90,  measure: function (calls) { return calls.filter(function (c) { return CT.hasSDL(c); }).length; } },
  { id: 'q_balance',   name: 'No Surprises',    desc: 'Check the balance on {goal} calls',      goal: 8,  xp: 80,  measure: countBehavior('checkBalance') },
  { id: 'q_collect',   name: 'Get The Bag',     desc: 'Collect on {goal} past due account(s)',  goal: 1,  xp: 150, measure: function (calls) { return calls.filter(function (c) { return c.flags.collected === true; }).length; } },
  { id: 'q_tenure',    name: 'Loyalty Radar',   desc: 'Acknowledge tenure on {goal} calls',     goal: 6,  xp: 80,  measure: countBehavior('acknowledgeTenure') },
  { id: 'q_tlife',     name: 'App Ambassador',  desc: 'Walk {goal} customers through T-Life',   goal: 4,  xp: 90,  measure: countBehavior('tlifeWalkthrough') },
  { id: 'q_resolve',   name: 'Closer',          desc: 'Resolve {goal} calls',                   goal: 10, xp: 110, measure: function (calls) { return calls.filter(function (c) { return c.flags.resolved === true; }).length; } },
  { id: 'q_volume',    name: 'Clock In',        desc: 'Log {goal} calls today',                 goal: 12, xp: 70,  measure: function (calls) { return calls.length; } },
  { id: 'q_score',     name: 'Quality Bar',     desc: 'Average {goal}% score across 8+ calls',  goal: 80, xp: 140, unit: '%',
    measure: function (calls) {
      if (calls.length < 8) return 0;
      var t = calls.reduce(function (a, c) { return a + (c.score || 0); }, 0);
      return Math.round(t / calls.length);
    } }
];

/* --- Teams quick-paste templates ---------------------------------------
 * {ref}    -> masked identifier + reason + clock time
 * {amount} -> collected amount
 * {quip}   -> random money one-liner
 * ---------------------------------------------------------------------- */
CT.TEMPLATES = [
  {
    id: 'escalated', icon: '\u{1F525}', label: 'ESCALATED — coming in HOT', tone: 'red',
    text: 'Escalated caller, coming in HOT. I need someone to tap in. {ref}'
  },
  {
    id: 'cancel', icon: '\u{1F6AA}', label: 'CANCEL / CHURN RISK', tone: 'amber',
    text: 'Cancel call / churn risk on the line. That is the only information I have right now — I will update as soon as I know more. {ref}'
  },
  {
    id: 'collected', icon: '\u{1F4B0}', label: 'COLLECTED MONEY', tone: 'lime',
    text: 'I collected some past due money! {amount} — {quip} {ref}'
  },
  {
    id: 'supervisor', icon: '\u{1F4E3}', label: 'SUPERVISOR REQUESTED', tone: 'red',
    text: 'Customer is asking for a supervisor. I have tried to de-escalate. Who has capacity? {ref}'
  },
  {
    id: 'assist', icon: '\u{1F198}', label: 'NEED AN ASSIST', tone: 'amber',
    text: 'Need a quick assist, I am stuck and do not want to burn the customer’s time. {ref}'
  },
  {
    id: 'notverified', icon: '\u{1F512}', label: 'CANNOT VERIFY CALLER', tone: 'amber',
    text: 'Caller cannot pass verification and is getting frustrated. Looking for guidance on next steps. {ref}'
  },
  {
    id: 'save', icon: '\u{1F6E1}', label: 'RETENTION SAVE', tone: 'lime',
    text: 'Save secured — customer was cancelling and is staying. Details to follow. {ref}'
  },
  {
    id: 'outage', icon: '\u{1F4E1}', label: 'POSSIBLE OUTAGE', tone: 'cyan',
    text: 'Possible outage — multiple symptoms in the same area. Anyone else seeing this? {ref}'
  },
  {
    id: 'longcall', icon: '⏳', label: 'LONG CALL / STILL ALIVE', tone: 'cyan',
    text: 'Still on a long one, everything is fine, just complex. Not stuck, not ghosting. {ref}'
  },
  {
    id: 'fraud', icon: '\u{1F6A8}', label: 'FRAUD / SECURITY', tone: 'red',
    text: 'Possible fraud or account takeover indicators on this call. Need guidance before I touch anything. {ref}'
  },
  {
    id: 'brb', icon: '☕', label: 'STEPPING AWAY', tone: 'slate',
    text: 'Wrapping up and stepping away for a few. Back shortly.'
  },
  {
    id: 'win', icon: '\u{1F3C6}', label: 'SMALL WIN', tone: 'lime',
    text: 'Small win worth sharing: customer came in hot, left happy. Onward. {ref}'
  }
];

/* Short, punchy money lines for the collection flex. */
CT.MONEY_QUIPS = [
  'money moves made \u{1F485}',
  'okurrr, the balance said thank you',
  'bag secured, next \u{1F6CD}',
  'made it rain on that past due ☔\u{1F4B5}',
  'that is a payment, period',
  'the invoice has been humbled',
  'past due? past tense.',
  'cash rules everything around this queue',
  'balance walked in owing, walked out even'
];

/* Rotating one-liners shown between calls. */
CT.IDLE_TIPS = [
  'Restate first. Everything else is downstream of the restate.',
  'No T-Mobile ID means they are calling you back. Fix it now, not next time.',
  'Check the balance even on tech calls. Surprise suspensions are self-inflicted callbacks.',
  'Say the tenure number out loud. "Twelve years" lands harder than "a long time."',
  'Past due with no arrangement? Ask for the money. The worst answer is no.',
  'Silence creates escalations. Narrate what you are doing.',
  'Walk them through T-Life once and you delete three future calls.',
  'The personal guarantee text is the difference between a fix and a relationship.',
  'Resolved defaults to NO. Earn the yes.',
  'If it is a cancel call, find the real reason before you offer anything.',
  'Situation, Duration, Location. In that order. Every tech call.',
  'Your recap is their memory. Make it short and specific.'
];

/* Helper shared by quests and stats. */
CT.hasSDL = function (call) {
  return call.behaviors.indexOf('sdlSituation') !== -1 &&
         call.behaviors.indexOf('sdlDuration') !== -1 &&
         call.behaviors.indexOf('sdlLocation') !== -1;
};
