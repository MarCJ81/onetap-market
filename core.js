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
 *   OneTapMarketCore.timeAgo(iso, lang, now)
 *   OneTapMarketCore.detectLang(navigatorLanguage)
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
      category: f.category || 'utility',
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

  var CATEGORY_IDS = ['ai', 'finance', 'business', 'utility'];

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
    squash: squash
  };

  root.OneTapMarketCore = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
