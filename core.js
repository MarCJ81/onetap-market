/* ============================================================================
 * OneTap Market · core
 * Pure functions only (no DOM). Loaded in the browser and required by test.js.
 *
 *   OneTapMarketCore.filterApps(apps, state)
 *   OneTapMarketCore.stats(apps, meta)
 *   OneTapMarketCore.issueUrl(app, repo)
 *   OneTapMarketCore.submissionIssueUrl(form, repo)
 *   OneTapMarketCore.jsonSpec(form)
 *   OneTapMarketCore.validateSubmission(form)
 *   OneTapMarketCore.formatStamp(iso, lang)
 *   OneTapMarketCore.formatShortStamp(iso, lang)
 *   OneTapMarketCore.timeAgo(iso, lang, now)
 *   OneTapMarketCore.detectLang(navigatorLanguage)
 *   OneTapMarketCore.appVersion(app) / changelog(app) / nextVersion(version)
 *   OneTapMarketCore.feedbackIssueUrl(app, feedback, repo) / feedbackText(...)
 *   OneTapMarketCore.feedbackApiUrl(repo) / parseFeedbackIssues(payload, app, repo)
 *   OneTapMarketCore.validateFeedback(feedback)
 *   OneTapMarketCore.updateIssueUrl(app, update, repo) / updatePatch(app, update)
 *   OneTapMarketCore.validateUpdate(update, apps)
 * ==========================================================================*/
(function (root) {
  'use strict';

  var FRESH_HOURS = 24;

  function lower(s) {
    return String(s == null ? '' : s).toLowerCase();
  }

  /* Korean search should not care about spacing, so "리뷰 답글" finds "리뷰답글". */
  function squash(s) {
    return lower(s).replace(/\s+/g, '');
  }

  function pad(n) {
    return String(n).length < 2 ? '0' + n : String(n);
  }

  function langMatches(app, lang) {
    if (!lang || lang === 'all') return true;
    var langs = app.languages || ['ko'];
    return langs.indexOf(lang) !== -1;
  }

  function isFree(app) {
    return app.pricing !== 'paid';
  }

  function isByok(app) {
    return app.pricing === 'free-byok';
  }

  function haystack(app) {
    var parts = [
      app.id,
      app.slug,
      app.url,
      app.category,
      app.name && app.name.en,
      app.name && app.name.ko,
      app.short && app.short.en,
      app.short && app.short.ko,
      app.long && app.long.en,
      app.long && app.long.ko
    ];
    (app.features && app.features.en ? app.features.en : []).forEach(function (f) {
      parts.push(f);
    });
    (app.features && app.features.ko ? app.features.ko : []).forEach(function (f) {
      parts.push(f);
    });
    return parts.filter(Boolean).join(' ');
  }

  function matchesSearch(app, query) {
    var q = squash(query);
    if (!q) return true;
    var hay = haystack(app);
    if (squash(hay).indexOf(q) !== -1) return true;
    // allow multi-word queries in any order
    var words = lower(query).split(/\s+/).filter(Boolean);
    if (words.length < 2) return false;
    var flat = squash(hay);
    return words.every(function (w) {
      return flat.indexOf(squash(w)) !== -1;
    });
  }

  function sortApps(apps, sort) {
    var copy = apps.slice();
    if (sort === 'name') {
      return copy.sort(function (a, b) {
        var an = lower(a.name && (a.name.en || a.name.ko));
        var bn = lower(b.name && (b.name.en || b.name.ko));
        if (an < bn) return -1;
        if (an > bn) return 1;
        return a.no - b.no;
      });
    }
    // 'fresh' — most recently verified first, then the catalogue order
    return copy.sort(function (a, b) {
      var at = a.lastChecked ? Date.parse(a.lastChecked) : 0;
      var bt = b.lastChecked ? Date.parse(b.lastChecked) : 0;
      if (bt !== at) return bt - at;
      return a.no - b.no;
    });
  }

  function filterApps(apps, state) {
    var s = state || {};
    var out = apps.filter(function (app) {
      if (!langMatches(app, s.lang)) return false;
      if (s.category && s.category !== 'all' && app.category !== s.category) return false;
      if (s.noSignup && !app.noSignup) return false;
      if (s.free && !isFree(app)) return false;
      if (s.byok && !isByok(app)) return false;
      if (!matchesSearch(app, s.search || '')) return false;
      return true;
    });
    return sortApps(out, s.sort || 'fresh');
  }

  function stats(apps, meta) {
    var total = apps.length;
    var live = apps.filter(function (a) {
      return a.httpStatus === 200;
    }).length;
    var noSignup = apps.filter(function (a) {
      return a.noSignup;
    }).length;
    var free = apps.filter(isFree).length;
    var byok = apps.filter(isByok).length;
    return {
      total: total,
      live: live,
      passRate: total ? Math.round((live / total) * 100) : 0,
      noSignup: noSignup,
      free: free,
      byok: byok,
      countries: 2,
      lastFullCheck: (meta && meta.lastFullCheck) || newestCheck(apps),
      newestCheck: newestCheck(apps)
    };
  }

  function newestCheck(apps) {
    var newest = null;
    apps.forEach(function (a) {
      if (!a.lastChecked) return;
      if (!newest || Date.parse(a.lastChecked) > Date.parse(newest)) newest = a.lastChecked;
    });
    return newest;
  }

  function isFresh(iso, now) {
    if (!iso) return false;
    var then = Date.parse(iso);
    if (isNaN(then)) return false;
    var n = now ? Date.parse(now) : Date.now();
    return n - then <= FRESH_HOURS * 3600 * 1000;
  }

  /* Fixed-format stamp in Korea time: 2026-11-22 12:05 KST.
     Deterministic across machines, unlike toLocaleString(). */
  function formatStamp(iso, lang) {
    if (!iso) return lang === 'en' ? 'not checked yet' : '아직 점검 전';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return lang === 'en' ? 'not checked yet' : '아직 점검 전';
    var kst = new Date(d.getTime() + 9 * 3600 * 1000);
    return (
      kst.getUTCFullYear() +
      '-' +
      pad(kst.getUTCMonth() + 1) +
      '-' +
      pad(kst.getUTCDate()) +
      ' ' +
      pad(kst.getUTCHours()) +
      ':' +
      pad(kst.getUTCMinutes()) +
      ' KST'
    );
  }

  /* Compact stamp for the card front, where space is tight:
     EN "11/23 10:10 KST" · KO "11/23 10:10". The full year-day stamp
     stays in the card tooltip and the detail modal. */
  function formatShortStamp(iso, lang) {
    if (!iso) return lang === 'en' ? 'not checked yet' : '아직 점검 전';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return lang === 'en' ? 'not checked yet' : '아직 점검 전';
    var kst = new Date(d.getTime() + 9 * 3600 * 1000);
    return (
      pad(kst.getUTCMonth() + 1) +
      '/' +
      pad(kst.getUTCDate()) +
      ' ' +
      pad(kst.getUTCHours()) +
      ':' +
      pad(kst.getUTCMinutes()) +
      (lang === 'en' ? ' KST' : '')
    );
  }

  function timeAgo(iso, lang, now) {
    if (!iso) return lang === 'en' ? 'never' : '기록 없음';
    var then = Date.parse(iso);
    if (isNaN(then)) return lang === 'en' ? 'never' : '기록 없음';
    var diff = Math.max(0, (now ? Date.parse(now) : Date.now()) - then);
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === 'en' ? 'just now' : '방금';
    if (mins < 60) return lang === 'en' ? mins + ' min ago' : mins + '분 전';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return lang === 'en' ? hours + ' hr ago' : hours + '시간 전';
    var days = Math.floor(hours / 24);
    return lang === 'en' ? days + ' d ago' : days + '일 전';
  }

  function detectLang(navLang) {
    var v = lower(navLang || '');
    if (v.indexOf('ko') === 0) return 'ko';
    if (v.indexOf('en') === 0) return 'en';
    return 'en';
  }

  function slugify(s) {
    return lower(s)
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9\uac00-\ud7a3]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 60);
  }

  function isHttpUrl(u) {
    return /^https?:\/\/[^\s]+$/i.test(String(u || '').trim()) && String(u).trim().length > 11;
  }

  /* ---------------- submission: validate / normalise / export -------------- */

  function emptyErrors() {
    return {};
  }

  function validateSubmission(form) {
    var f = form || {};
    var err = emptyErrors();
    if (!f.nameEn || !String(f.nameEn).trim()) err.nameEn = 'required';
    if (!f.url || !isHttpUrl(f.url)) err.url = 'url';
    if (!f.shortEn || String(f.shortEn).trim().length < 12) err.shortEn = 'short';
    if (!f.category) err.category = 'required';
    else if (CATEGORY_IDS.indexOf(f.category) === -1) err.category = 'required';
    if (!f.languages || !f.languages.length) err.languages = 'required';
    if (!f.creator || !String(f.creator).trim()) err.creator = 'required';
    if (f.copyKo && (!f.nameKo || !String(f.nameKo).trim())) err.nameKo = 'required';
    if (f.copyKo && (!f.shortKo || String(f.shortKo).trim().length < 8)) err.shortKo = 'short';
    return err;
  }

  function isValidSubmission(form) {
    return Object.keys(validateSubmission(form)).length === 0;
  }

  function normaliseLanguages(list) {
    var out = [];
    (list || []).forEach(function (l) {
      var v = lower(l);
      if (v === 'ko' || v === 'en') {
        if (out.indexOf(v) === -1) out.push(v);
      }
    });
    return out.sort();
  }

  function jsonSpec(form) {
    var f = form || {};
    var ens = normaliseLanguages(f.languages);
    var pricing = f.byok ? 'free-byok' : 'free';
    var name = { en: String(f.nameEn || '').trim(), ko: String(f.nameKo || f.nameEn || '').trim() };
    var short = { en: String(f.shortEn || '').trim(), ko: String(f.shortKo || f.shortEn || '').trim() };
    return {
      id: slugify(f.nameEn || f.nameKo || 'app'),
      slug: slugify(f.nameEn || f.nameKo || 'app'),
      url: String(f.url || '').trim(),
      name: name,
      category: CATEGORY_IDS.indexOf(f.category) !== -1 ? f.category : 'life-utility',
      languages: ens.length ? ens : ['en'],
      noSignup: f.noSignup !== false,
      pricing: pricing,
      short: short,
      creator: String(f.creator || '').trim(),
      httpStatus: null,
      lastChecked: null
    };
  }

  function jsonSpecText(form) {
    return JSON.stringify(jsonSpec(form), null, 2);
  }

  var CATEGORY_IDS = [
    'ai-content',
    'marketing-sns',
    'tax-finance',
    'business-docs',
    'dev-security',
    'life-utility'
  ];

  function categoryLabel(id, lang, categories) {
    var list = categories || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return lang === 'en' ? list[i].en : list[i].ko;
    }
    return id;
  }

  function appCounts(apps, categories) {
    var map = {};
    (categories || []).forEach(function (c) {
      map[c.id] = 0;
    });
    apps.forEach(function (a) {
      map[a.category] = (map[a.category] || 0) + 1;
    });
    return map;
  }

  /* ------------------------- GitHub issue intake -------------------------- */

  function clamp(s, max) {
    var t = String(s == null ? '' : s);
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  function issueTitle(form, lang) {
    var f = form || {};
    var name = String(f.nameEn || f.nameKo || '').trim() || 'Untitled app';
    return (lang === 'ko' ? '[입점 신청] ' : '[Listing] ') + clamp(name, 90);
  }

  function issueBody(form, lang) {
    var f = form || {};
    var spec = jsonSpec(f);
    var ko = lang === 'ko';
    var line = function (label, value) {
      return '- ' + label + ': ' + (value || value === 0 ? value : '—');
    };
    var lines = [
      ko ? '## 입점 신청' : '## App listing submission',
      '',
      line(ko ? '앱 이름 (EN)' : 'App name (EN)', String(f.nameEn || '').trim()),
      line(ko ? '앱 이름 (KO)' : 'App name (KO)', String(f.nameKo || '').trim()),
      line(ko ? '라이브 URL' : 'Live URL', String(f.url || '').trim()),
      line(ko ? '카테고리' : 'Category', spec.category),
      line(ko ? '지원 언어' : 'Languages', spec.languages.join(', ')),
      line(ko ? '회원가입 필요' : 'Signup required', f.noSignup === false ? (ko ? '필요' : 'yes') : ko ? '없음' : 'no'),
      line(ko ? '가격 정책' : 'Pricing', f.byok ? 'Free + BYOK' : ko ? '완전 무료' : 'Free'),
      line(ko ? '제작자' : 'Creator', String(f.creator || '').trim()),
      '',
      ko ? '### 한 줄 소개 (EN)' : '### One-line summary (EN)',
      String(f.shortEn || '').trim(),
      '',
      ko ? '### 한 줄 소개 (KO)' : '### One-line summary (KO)',
      String(f.shortKo || '').trim(),
      '',
      ko ? '### 붙여 넣을 JSON' : '### JSON to append',
      '```json',
      JSON.stringify(spec, null, 2),
      '```',
      '',
      ko
        ? '_OneTap Market 입점 신청 양식에서 자동 생성되었습니다._'
        : '_Generated by the OneTap Market submission form._'
    ];
    return lines.join('\n');
  }

  function submissionIssueUrl(form, repo) {
    var r = repo || 'MarCJ81/onetap-market';
    var base = 'https://github.com/' + r + '/issues/new';
    var lang = (form && form.issueLang) || 'en';
    var params =
      'title=' +
      encodeURIComponent(issueTitle(form, lang)) +
      '&body=' +
      encodeURIComponent(issueBody(form, lang)) +
      '&labels=' +
      encodeURIComponent('submission');
    return base + '?' + params;
  }

  /* ---------------------------- versions ---------------------------------- */

  var VERSION_RE = /^v?\d+\.\d+\.\d+$/;

  function appVersion(app) {
    var v = app && app.version ? String(app.version) : '';
    if (!VERSION_RE.test(v)) return 'v1.0.0';
    return v.charAt(0) === 'v' ? v : 'v' + v;
  }

  function versionParts(v) {
    var m = String(v || '').replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return [0, 0, 0];
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }

  function compareVersions(a, b) {
    var pa = versionParts(a);
    var pb = versionParts(b);
    for (var i = 0; i < 3; i += 1) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
  }

  /* The next release a creator would file: a minor bump (v1.0.0 → v1.1.0). */
  function nextVersion(version) {
    var p = versionParts(version);
    return 'v' + p[0] + '.' + (p[1] + 1) + '.0';
  }

  function changelog(app) {
    var list = (app && Array.isArray(app.changelog)) ? app.changelog : [];
    var out = list.filter(function (e) {
      return e && typeof e.version === 'string' && VERSION_RE.test(e.version) && typeof e.date === 'string';
    }).map(function (e) {
      var notes = e.notes || {};
      return {
        version: e.version.charAt(0) === 'v' ? e.version : 'v' + e.version,
        date: e.date,
        notes: { en: String(notes.en || ''), ko: String(notes.ko || notes.en || '') }
      };
    });
    return out.sort(function (a, b) {
      return compareVersions(b.version, a.version);
    });
  }

  /* Today in Korea time, as the date a changelog entry is stamped with. */
  function todayKst(now) {
    var base = now ? Date.parse(now) : Date.now();
    if (isNaN(base)) base = Date.now();
    var kst = new Date(base + 9 * 3600 * 1000);
    return kst.getUTCFullYear() + '-' + pad(kst.getUTCMonth() + 1) + '-' + pad(kst.getUTCDate());
  }

  /* ---------------------------- feedback ---------------------------------- */

  var FEEDBACK_TYPES = ['bug', 'feature', 'review'];

  function feedbackTypeLabel(type, lang) {
    var ko = lang === 'ko';
    if (type === 'bug') return ko ? '버그 제보' : 'Bug report';
    if (type === 'feature') return ko ? '기능 요청' : 'Feature request';
    return ko ? '사용 후기' : 'Usage note';
  }

  function normalizeFeedbackType(type) {
    return FEEDBACK_TYPES.indexOf(type) !== -1 ? type : 'review';
  }

  function validateFeedback(fb) {
    var f = fb || {};
    var err = {};
    var text = String(f.content == null ? '' : f.content).trim();
    if (text.length < 8) err.content = 'short';
    else if (text.length > 2000) err.content = 'long';
    if (f.type && FEEDBACK_TYPES.indexOf(f.type) === -1) err.type = 'type';
    return err;
  }

  function feedbackTitle(app, fb, lang) {
    var f = fb || {};
    var n = app && app.name ? (lang === 'ko' ? app.name.ko || app.name.en : app.name.en || app.name.ko) : '';
    var name = String(n || f.appName || 'App').trim();
    return '[Feedback: ' + clamp(name, 60) + '] ' + feedbackTypeLabel(normalizeFeedbackType(f.type), lang);
  }

  function feedbackBody(app, fb, lang) {
    var f = fb || {};
    var ko = lang === 'ko';
    var line = function (label, value) {
      return '- ' + label + ': ' + (value || value === 0 ? value : '—');
    };
    var name = app ? (app.name && (app.name[ko ? 'ko' : 'en'] || app.name.en)) || '' : f.appName || '';
    var nick = String(f.nick || '').trim();
    return [
      ko ? '## 앱 피드백' : '## App feedback',
      '',
      line(ko ? '앱' : 'App', name),
      line('Slug', (app && (app.slug || app.id)) || f.slug || ''),
      line(ko ? '버전' : 'Version', app ? appVersion(app) : f.version || ''),
      line(ko ? '유형' : 'Type', feedbackTypeLabel(normalizeFeedbackType(f.type), lang)),
      line(ko ? '작성자' : 'From', nick || (ko ? '익명' : 'anonymous')),
      '',
      ko ? '### 내용' : '### What they said',
      String(f.content == null ? '' : f.content).trim(),
      '',
      ko
        ? '_OneTap Market 카드의 피드백 양식에서 자동 생성되었습니다._'
        : '_Generated by the feedback form on a OneTap Market card._'
    ].join('\n');
  }

  function feedbackIssueUrl(app, fb, repo) {
    var r = repo || 'MarCJ81/onetap-market';
    var lang = (fb && fb.lang) || 'en';
    var params =
      'title=' +
      encodeURIComponent(feedbackTitle(app, fb, lang)) +
      '&body=' +
      encodeURIComponent(feedbackBody(app, fb, lang)) +
      '&labels=' +
      encodeURIComponent('feedback');
    return 'https://github.com/' + r + '/issues/new?' + params;
  }

  /* Plain text for a visitor without a GitHub account: paste it anywhere. */
  function feedbackText(app, fb, lang) {
    var ko = lang === 'ko';
    var f = fb || {};
    var nick = String(f.nick || '').trim();
    var lines = [
      feedbackTitle(app, fb, lang),
      '',
      (ko ? '앱: ' : 'App: ') +
        ((app && app.name && (app.name[ko ? 'ko' : 'en'] || app.name.en)) || f.appName || ''),
      (ko ? '버전: ' : 'Version: ') + (app ? appVersion(app) : f.version || ''),
      (ko ? '유형: ' : 'Type: ') + feedbackTypeLabel(normalizeFeedbackType(f.type), lang),
      (ko ? '작성자: ' : 'From: ') + (nick || (ko ? '익명' : 'anonymous')),
      '',
      String(f.content == null ? '' : f.content).trim()
    ];
    return lines.join('\n');
  }

  /* Read-only public GitHub API call — the only request this page ever makes,
     and only when a visitor asks to see a card's feedback. */
  function feedbackApiUrl(repo, perPage) {
    var r = repo || 'MarCJ81/onetap-market';
    return (
      'https://api.github.com/repos/' +
      r +
      '/issues?labels=feedback&state=open&per_page=' +
      (perPage || 30)
    );
  }

  function feedbackFallbackUrl(repo) {
    var r = repo || 'MarCJ81/onetap-market';
    return 'https://github.com/' + r + '/issues?q=' + encodeURIComponent('is:issue is:open label:feedback');
  }

  /* The API is somebody else's server: every shape is possible, so nothing here
     may throw. A payload that is not an array is reported as unavailable, not
     as "no feedback yet". */
  function parseFeedbackIssues(payload, app, repo) {
    var r = repo || 'MarCJ81/onetap-market';
    if (!Array.isArray(payload)) return { ok: false, reason: 'shape', items: [] };
    var slug = String((app && (app.slug || app.id)) || '').trim();
    var names = [];
    if (app && app.name) {
      if (app.name.en) names.push(String(app.name.en).toLowerCase());
      if (app.name.ko) names.push(String(app.name.ko).toLowerCase());
    }
    var items = [];
    payload.forEach(function (issue) {
      if (!issue || typeof issue !== 'object') return;
      var body = String(issue.body || '');
      var title = String(issue.title || '');
      var bySlug = slug && (body.indexOf('Slug: ' + slug) !== -1 || title.toLowerCase().indexOf('[' + slug + ']') !== -1);
      var byName = names.some(function (n) {
        return n && title.toLowerCase().indexOf(n) !== -1;
      });
      if (!bySlug && !byName) return;
      var number = Number(issue.number);
      if (!number && !issue.html_url) return;
      items.push({
        number: number || 0,
        title: title || (issue.html_url ? String(issue.html_url) : 'Feedback'),
        author: (issue.user && issue.user.login) || '',
        date: issue.created_at || '',
        url: issue.html_url || 'https://github.com/' + r + '/issues/' + number,
        type: /Bug report|버그/.test(title) ? 'bug' : /Feature request|기능 요청/.test(title) ? 'feature' : 'review'
      });
    });
    items.sort(function (a, b) {
      return Date.parse(b.date || 0) - Date.parse(a.date || 0);
    });
    return { ok: true, reason: '', items: items };
  }

  /* ------------------------ creator update request ------------------------ */

  function validateUpdate(up, apps) {
    var u = up || {};
    var err = {};
    var list = apps || [];
    var app = list.filter(function (a) {
      return a && (a.slug === u.appId || a.id === u.appId);
    })[0];
    if (!u.appId || !app) err.appId = 'required';
    if (!u.version || !VERSION_RE.test(String(u.version).trim())) err.version = 'version';
    else if (app && compareVersions(String(u.version).trim(), appVersion(app)) <= 0) err.version = 'older';
    if (!u.url || !isHttpUrl(u.url)) err.url = 'url';
    var notesEn = String(u.notesEn == null ? '' : u.notesEn).trim();
    if (notesEn.length < 8) err.notesEn = 'short';
    if (String(u.notesKo == null ? '' : u.notesKo).trim().length > 400) err.notesKo = 'long';
    return err;
  }

  function findAppIn(apps, key) {
    return (apps || []).filter(function (a) {
      return a && (a.slug === key || a.id === key);
    })[0] || null;
  }

  function updatePatch(app, up, now) {
    var u = up || {};
    var version = String(u.version || '').trim();
    if (version && version.charAt(0) !== 'v') version = 'v' + version;
    var entry = {
      version: version || nextVersion(app ? appVersion(app) : 'v1.0.0'),
      date: todayKst(now),
      notes: {
        en: String(u.notesEn == null ? '' : u.notesEn).trim(),
        ko: String(u.notesKo == null ? '' : u.notesKo).trim()
      }
    };
    if (!entry.notes.ko) entry.notes.ko = entry.notes.en;
    var patch = {
      id: (app && (app.id || app.slug)) || u.appId || '',
      version: entry.version,
      changelog: [entry].concat(app ? changelog(app) : [])
    };
    var url = String(u.url == null ? '' : u.url).trim();
    if (url && (!app || url !== app.url)) patch.url = url;
    return patch;
  }

  function updateTitle(app, up, lang) {
    var u = up || {};
    var name = String((app && app.name && (app.name.en || app.name.ko)) || u.appName || 'App').trim();
    var version = String(u.version || '').trim();
    if (version && version.charAt(0) !== 'v') version = 'v' + version;
    return '[Update] ' + clamp(name, 60) + ' ' + (version || nextVersion(app ? appVersion(app) : 'v1.0.0'));
  }

  function updateBody(app, up, lang, now) {
    var u = up || {};
    var ko = lang === 'ko';
    var patch = updatePatch(app, u, now);
    var line = function (label, value) {
      return '- ' + label + ': ' + (value || value === 0 ? value : '—');
    };
    return [
      ko ? '## 앱 업데이트 신청' : '## App update request',
      '',
      line(ko ? '앱' : 'App', app ? (app.name[ko ? 'ko' : 'en'] || app.name.en) : u.appName || ''),
      line('Slug', (app && (app.slug || app.id)) || u.appId || ''),
      line(ko ? '현재 버전' : 'Current version', app ? appVersion(app) : ''),
      line(ko ? '새 버전' : 'New version', patch.version),
      line(ko ? '라이브 URL' : 'Live URL', String(u.url == null ? '' : u.url).trim() || (app && app.url) || ''),
      '',
      ko ? '### 변경 내용 (EN)' : '### What changed (EN)',
      String(u.notesEn == null ? '' : u.notesEn).trim(),
      '',
      ko ? '### 변경 내용 (KO)' : '### What changed (KO)',
      String(u.notesKo == null ? '' : u.notesKo).trim(),
      '',
      ko ? '### 적용할 JSON 패치' : '### JSON patch to apply',
      '```json',
      JSON.stringify(patch, null, 2),
      '```',
      '',
      ko
        ? '_OneTap Market 업데이트 신청 탭에서 자동 생성되었습니다._'
        : '_Generated by the OneTap Market update tab._'
    ].join('\n');
  }

  function updateIssueUrl(app, up, repo, now) {
    var r = repo || 'MarCJ81/onetap-market';
    var lang = (up && up.lang) || 'en';
    var params =
      'title=' +
      encodeURIComponent(updateTitle(app, up, lang)) +
      '&body=' +
      encodeURIComponent(updateBody(app, up, lang, now)) +
      '&labels=' +
      encodeURIComponent('update');
    return 'https://github.com/' + r + '/issues/new?' + params;
  }

  /* Deep link straight to one app's page (used by the copy-link button). */
  function appLink(app, base) {
    var root = base || 'https://marcj81.github.io/onetap-market/';
    if (root.charAt(root.length - 1) !== '/') root += '/';
    return root + '?app=' + encodeURIComponent(app.slug || app.id);
  }

  var Core = {
    FRESH_HOURS: FRESH_HOURS,
    CATEGORY_IDS: CATEGORY_IDS,
    filterApps: filterApps,
    sortApps: sortApps,
    matchesSearch: matchesSearch,
    stats: stats,
    isFree: isFree,
    isByok: isByok,
    isFresh: isFresh,
    formatStamp: formatStamp,
    formatShortStamp: formatShortStamp,
    timeAgo: timeAgo,
    detectLang: detectLang,
    slugify: slugify,
    isHttpUrl: isHttpUrl,
    validateSubmission: validateSubmission,
    isValidSubmission: isValidSubmission,
    normaliseLanguages: normaliseLanguages,
    jsonSpec: jsonSpec,
    jsonSpecText: jsonSpecText,
    issueTitle: issueTitle,
    issueBody: issueBody,
    submissionIssueUrl: submissionIssueUrl,
    appCounts: appCounts,
    categoryLabel: categoryLabel,
    appLink: appLink,
    squash: squash,
    appVersion: appVersion,
    changelog: changelog,
    compareVersions: compareVersions,
    nextVersion: nextVersion,
    todayKst: todayKst,
    FEEDBACK_TYPES: FEEDBACK_TYPES,
    feedbackTypeLabel: feedbackTypeLabel,
    normalizeFeedbackType: normalizeFeedbackType,
    validateFeedback: validateFeedback,
    feedbackTitle: feedbackTitle,
    feedbackBody: feedbackBody,
    feedbackIssueUrl: feedbackIssueUrl,
    feedbackText: feedbackText,
    feedbackApiUrl: feedbackApiUrl,
    feedbackFallbackUrl: feedbackFallbackUrl,
    parseFeedbackIssues: parseFeedbackIssues,
    validateUpdate: validateUpdate,
    findAppIn: findAppIn,
    updatePatch: updatePatch,
    updateTitle: updateTitle,
    updateBody: updateBody,
    updateIssueUrl: updateIssueUrl
  };

  root.OneTapMarketCore = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
