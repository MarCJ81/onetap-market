/* ============================================================================
 * OneTap Market · page wiring
 * Renders the shelf, switches EN/KO, opens the detail and submission modals.
 * Data comes from data/apps.bundle.js (sync, works from disk) and falls back
 * to fetching data/apps.json when the bundle is missing.
 * ==========================================================================*/
(function () {
  'use strict';

  var Core = window.OneTapMarketCore;
  var I18N = window.OneTapI18n;
  var BASE_URL = 'https://marcj81.github.io/onetap-market/';

  var data = window.__ONETAP_MARKET__ || null;
  var state = {
    lang: 'en',
    langFilter: 'all',
    category: 'all',
    search: '',
    noSignup: false,
    free: false,
    byok: false,
    sort: 'fresh'
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function t(key) {
    var pack = I18N[state.lang] || I18N.en;
    if (pack[key] != null) return pack[key];
    if (I18N.en[key] != null) return I18N.en[key];
    return key;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pick(obj, lang) {
    if (!obj) return '';
    return obj[lang] || obj.en || obj.ko || '';
  }

  function apps() {
    return (data && data.apps) || [];
  }

  function categories() {
    return (data && data.categories) || [];
  }

  /* ── language ───────────────────────────────────────────────────────── */
  function applyI18n() {
    var lang = state.lang;
    document.documentElement.lang = lang;

    $$('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    $$('[data-i18n-placeholder]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    $$('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });

    document.title = t('meta.title');
    setMeta('name', 'description', t('meta.description'));
    setMeta('property', 'og:title', t('meta.ogTitle'));
    setMeta('property', 'og:description', t('meta.ogDescription'));
    setMeta('property', 'og:locale', lang === 'ko' ? 'ko_KR' : 'en_US');

    $$('.lang__btn').forEach(function (b) {
      var on = b.getAttribute('data-lang') === lang;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $$('#detailModal .modal__close, #submitModal .modal__close').forEach(function (b) {
      b.setAttribute('aria-label', t('modal.close'));
    });
  }

  function setMeta(attr, name, value) {
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (el) el.setAttribute('content', value);
  }

  function setLang(lang) {
    if (!I18N[lang]) return;
    state.lang = lang;
    applyI18n();
    renderChips();
    renderGrid();
    renderStats();
    try { localStorage.setItem('otm.lang', lang); } catch (e) { /* private mode */ }
    var open = document.body.getAttribute('data-open-app');
    if (open) openDetail(open);
  }

  /* ── rendering: stats ───────────────────────────────────────────────── */
  function renderStats() {
    var s = Core.stats(apps(), data && data.meta);
    $('#statApps').textContent = s.total;
    $('#statPass').textContent = s.passRate + '%';
    $('#statPassNote').textContent = s.live + '/' + s.total;
    $('#statNoSignup').textContent = s.noSignup;
    $('#statCheck').textContent = Core.formatStamp(s.lastFullCheck, state.lang).replace(' KST', '');
    $('#heroCount').textContent = s.total;
    $('#resultTotal').textContent = s.total;
    if (data && data.meta) $('#dataVersion').textContent = data.meta.version || '1.0.0';
    $('#statCheck').setAttribute(
      'title',
      Core.formatStamp(s.lastFullCheck, state.lang) + ' · ' + t('stats.lastCheck')
    );
  }

  /* ── rendering: category chips ──────────────────────────────────────── */
  function renderChips() {
    var counts = Core.appCounts(apps(), categories());
    var total = apps().length;
    var html = [
      '<button type="button" class="chip' + (state.category === 'all' ? ' is-on' : '') +
        '" data-cat="all" aria-pressed="' + (state.category === 'all') + '">' +
        esc(t('filter.catAll')) + ' <b>' + total + '</b></button>'
    ];
    categories().forEach(function (c) {
      var on = state.category === c.id;
      var n = counts[c.id] || 0;
      html.push(
        '<button type="button" class="chip' + (on ? ' is-on' : '') + (n === 0 ? ' chip--zero' : '') +
        '" data-cat="' + esc(c.id) +
        '" aria-pressed="' + on + '">' + esc(state.lang === 'en' ? c.en : c.ko) +
        ' <b>' + n + '</b></button>'
      );
    });
    $('#catChips').innerHTML = html.join('');
  }

  /* ── rendering: cards ───────────────────────────────────────────────── */
  function badgeHtml(app) {
    var out = [];
    if (app.httpStatus === 200) {
      out.push('<span class="badge badge--live" title="' + esc(t('badge.liveHint')) + '"><span class="badge__dot"></span>' + esc(t('badge.live')) + '</span>');
    } else {
      out.push('<span class="badge badge--down" title="' + esc(String(app.httpStatus || '—')) + '"><span class="badge__dot"></span>HTTP ' + esc(String(app.httpStatus || '—')) + '</span>');
    }
    if (app.noSignup) {
      out.push('<span class="badge badge--signup" title="' + esc(t('badge.noSignupHint')) + '"><span class="badge__dot"></span>' + esc(t('badge.noSignup')) + '</span>');
    }
    if (app.pricing === 'paid') {
      out.push('<span class="badge badge--paid" title="' + esc(t('badge.paidHint')) + '"><span class="badge__dot"></span>' + esc(t('badge.paid')) + '</span>');
    } else if (app.pricing === 'free-byok') {
      out.push('<span class="badge badge--free" title="' + esc(t('badge.byokHint')) + '"><span class="badge__dot"></span>' + esc(t('badge.byok')) + '</span>');
    } else {
      out.push('<span class="badge badge--free" title="' + esc(t('badge.freeHint')) + '"><span class="badge__dot"></span>' + esc(t('badge.free')) + '</span>');
    }
    return out.join('');
  }

  function langTag(app) {
    var langs = (app.languages || []).map(function (l) { return l.toUpperCase(); });
    return '<span class="badge badge--log">' + esc(langs.join(' · ')) + '</span>';
  }

  function cardHtml(app) {
    var wide = app.no === 1 || app.no === 9 || app.no === 16 || app.no === 25;
    var cls = 'card' + (wide ? ' card--wide' : '') + (app.pricing === 'paid' ? ' card--paid' : '') +
      (app.httpStatus === 200 ? '' : ' card--down');
    var name = pick(app.name, state.lang);
    var short = pick(app.short, state.lang);
    var cat = Core.categoryLabel(app.category, state.lang, categories());
    return (
      '<button type="button" class="' + cls + '" data-app="' + esc(app.slug) + '" aria-haspopup="dialog">' +
        '<span class="card__top"><span class="card__cat">' + esc(cat) + '</span><span class="card__no">' + String(app.no).padStart(2, '0') + '</span></span>' +
        '<span class="card__name">' + esc(name) + '</span>' +
        '<span class="card__short">' + esc(short) + '</span>' +
        '<span class="card__badges">' + badgeHtml(app) + langTag(app) + '</span>' +
        '<span class="card__foot">' +
          '<span class="card__check"><span class="pulse' + (app.httpStatus === 200 ? '' : ' pulse--down') + '"></span>' +
            esc(t('card.checked')) + ' ' + esc(Core.timeAgo(app.lastChecked, state.lang)) + '</span>' +
          '<span class="card__link">' + esc(t('card.details')) + ' →</span>' +
        '</span>' +
      '</button>'
    );
  }

  function renderGrid() {
    var list = Core.filterApps(apps(), {
      lang: state.langFilter,
      category: state.category,
      search: state.search,
      noSignup: state.noSignup,
      free: state.free,
      byok: state.byok,
      sort: state.sort
    });
    $('#cardGrid').innerHTML = list.map(cardHtml).join('');
    $('#resultCount').textContent = list.length;
    $('#emptyState').hidden = list.length > 0;
    /* A category nobody has listed in yet is not a failed filter — it is the
       shelf waiting for its first app, so it gets a submission CTA instead. */
    var counts = Core.appCounts(apps(), categories());
    var emptyCategory = state.category !== 'all' && (counts[state.category] || 0) === 0;
    $('#emptyFilter').hidden = emptyCategory;
    $('#emptyCategory').hidden = !emptyCategory;
    $$('[data-langfilter]').forEach(function (b) {
      var on = b.getAttribute('data-langfilter') === state.langFilter;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('#toggleNoSignup').classList.toggle('is-on', state.noSignup);
    $('#toggleNoSignup').setAttribute('aria-pressed', String(state.noSignup));
    $('#toggleFree').classList.toggle('is-on', state.free);
    $('#toggleFree').setAttribute('aria-pressed', String(state.free));
    $('#toggleByok').classList.toggle('is-on', state.byok);
    $('#toggleByok').setAttribute('aria-pressed', String(state.byok));
  }

  /* ── toast ──────────────────────────────────────────────────────────── */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ── clipboard ──────────────────────────────────────────────────────── */
  function copyText(text, okKey) {
    function done() { toast(t(okKey || 'toast.copied')); }
    function fail() { toast(t('toast.copyFailed')); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fail);
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? done() : fail();
    } catch (e) {
      fail();
    }
  }

  /* ── detail modal ───────────────────────────────────────────────────── */
  var lastFocus = null;

  function findApp(key) {
    return apps().filter(function (a) { return a.slug === key || a.id === key; })[0] || null;
  }

  function pricedLabel(app) {
    if (app.pricing === 'paid') {
      return esc(t('modal.pricePaid')) + (app.priceNote ? ' · ' + esc(pick(app.priceNote, state.lang)) : '');
    }
    if (app.pricing === 'free-byok') return esc(t('modal.priceByok'));
    return esc(t('modal.priceFree'));
  }

  function otherName(app) {
    var other = state.lang === 'en' ? app.name.ko : app.name.en;
    var here = pick(app.name, state.lang);
    if (!other || other === here) return '';
    return '<p class="detail__native">' + esc(other) + '</p>';
  }

  function openDetail(key) {
    var app = findApp(key);
    if (!app) { toast(t('toast.appNotFound')); return; }
    lastFocus = document.activeElement;
    document.body.setAttribute('data-open-app', app.slug);
    var ok = app.httpStatus === 200;
    var cat = Core.categoryLabel(app.category, state.lang, categories());
    var langs = (app.languages || []).map(function (l) { return l === 'ko' ? 'Korean' : 'English'; });
    if (state.lang === 'ko') langs = (app.languages || []).map(function (l) { return l === 'ko' ? '한국어' : '영어'; });
    var feats = (app.features && (app.features[state.lang] || app.features.en)) || [];

    var html = [
      '<div class="detail">',
        '<header class="detail__head">',
          '<p class="detail__sub">' + esc(cat) + '</p>',
          '<h2 class="detail__name" id="detailName">' + esc(pick(app.name, state.lang)) + '</h2>',
          otherName(app),
          '<div class="detail__badges">' + badgeHtml(app) + '</div>',
        '</header>',
        '<h3>' + esc(t('modal.about')) + '</h3>',
        '<p class="detail__text">' + esc(pick(app.long, state.lang) || pick(app.short, state.lang)) + '</p>',
        '<h3>' + esc(t('modal.features')) + '</h3>',
        '<ul class="features">' + feats.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>',
        '<h3>' + esc(t('modal.facts')) + '</h3>',
        '<div class="facts">',
          '<div class="fact"><span class="fact__k">' + esc(t('modal.status')) + '</span><span class="fact__v ' + (ok ? 'fact__v--ok' : 'fact__v--bad') + '">HTTP ' + esc(String(app.httpStatus == null ? '—' : app.httpStatus)) + '</span></div>',
          '<div class="fact"><span class="fact__k">' + esc(t('modal.lastCheck')) + '</span><span class="fact__v">' + esc(Core.formatStamp(app.lastChecked, state.lang)) + '</span></div>',
          '<div class="fact"><span class="fact__k">' + esc(t('modal.signup')) + '</span><span class="fact__v">' + esc(app.noSignup ? t('modal.signupNo') : '—') + '</span></div>',
          '<div class="fact"><span class="fact__k">' + esc(t('modal.pricing')) + '</span><span class="fact__v">' + pricedLabel(app) + '</span></div>',
          '<div class="fact"><span class="fact__k">' + esc(t('modal.languages')) + '</span><span class="fact__v">' + esc(langs.join(' · ')) + '</span></div>',
          '<div class="fact"><span class="fact__k">' + esc(t('modal.creator')) + '</span><span class="fact__v">' + esc((data.meta && data.meta.creator) || 'OneTap Labs') + '</span></div>',
        '</div>',
        '<div class="detail__actions">',
          '<a class="btn btn--primary" href="' + esc(app.url) + '" target="_blank" rel="noopener noreferrer" data-launch>' + esc(t('modal.launch')) + ' ↗</a>',
          '<button type="button" class="btn btn--ghost" id="copyAppLink">' + esc(t('modal.copyLink')) + '</button>',
        '</div>',
        '<p class="detail__link">' + esc(t('modal.linkLabel')) + ': <code>' + esc(Core.appLink(app, BASE_URL)) + '</code></p>',
        '<p class="hint" style="margin-top:6px">' + esc(t('modal.verifiedBy')) + '</p>',
      '</div>'
    ].join('');

    $('#detailBody').innerHTML = html;
    $('#detailModal').hidden = false;
    document.documentElement.style.overflow = 'hidden';
    var closeBtn = $('#detailModal .modal__close');
    if (closeBtn) closeBtn.focus();

    $('#copyAppLink').addEventListener('click', function () {
      copyText(Core.appLink(app, BASE_URL), 'toast.copied');
    });
    var launch = $('#detailModal [data-launch]');
    if (launch) launch.addEventListener('click', function () { toast(t('toast.opened')); });
    var panel = $('#detailModal .modal__panel');
    panel.scrollTop = 0;
  }

  function closeModals() {
    ['#detailModal', '#submitModal'].forEach(function (sel) {
      var m = $(sel);
      if (m && !m.hidden) m.hidden = true;
    });
    document.documentElement.style.overflow = '';
    document.body.removeAttribute('data-open-app');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ── submission ─────────────────────────────────────────────────────── */
  function fillCategorySelect() {
    var sel = $('#fCategory');
    sel.innerHTML = categories()
      .map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(state.lang === 'en' ? c.en : c.ko) + '</option>';
      })
      .join('');
  }

  function readForm() {
    return {
      nameEn: $('#fNameEn').value,
      nameKo: $('#fNameKo').value,
      url: $('#fUrl').value,
      shortEn: $('#fShortEn').value,
      shortKo: $('#fShortKo').value,
      category: $('#fCategory').value,
      languages: $$('#submitForm input[name="lang"]:checked').map(function (i) { return i.value; }),
      noSignup: $('#fNoSignup').checked,
      byok: $('#fByok').checked,
      creator: $('#fCreator').value,
      issueLang: state.lang
    };
  }

  function errorText(code) {
    if (code === 'url') return t('submit.errUrl');
    if (code === 'short') return t('submit.errShort');
    return t('submit.errRequired');
  }

  function updatePreview() {
    var form = readForm();
    var spec = Core.jsonSpec(form);
    $('#jsonPreview').textContent = JSON.stringify(spec, null, 2);
    var url = Core.submissionIssueUrl(form, data && data.meta ? data.meta.repo : 'MarCJ81/onetap-market');
    var parts = url.split('?');
    $('#issuePreview').setAttribute('data-url', url);
    $('#issuePreview').setAttribute('title', url);
    $('#issueHost').textContent = parts[0].replace('https://', '');
    $('#issueQuery').textContent = '?' + (parts[1] || '');
    $('#issueMeta').textContent =
      t('submit.issueMeta') + ' ' + (parts[1] || '').length.toLocaleString('en-US') + ' ' + t('submit.issueChars');
    return { form: form, spec: spec, url: url };
  }

  function validateForm(showErrors) {
    var form = readForm();
    var errs = Core.validateSubmission(form);
    $$('#submitForm .err').forEach(function (el) { el.textContent = ''; });
    $$('#submitForm input').forEach(function (el) { el.classList.remove('is-bad'); });
    if (showErrors) {
      Object.keys(errs).forEach(function (field) {
        var slot = $('[data-err="' + field + '"]');
        if (slot) slot.textContent = errorText(errs[field]);
        var input =
          field === 'languages' ? null : $('#f' + field.charAt(0).toUpperCase() + field.slice(1));
        if (input) input.classList.add('is-bad');
      });
    }
    return errs;
  }

  function openSubmit(category) {
    lastFocus = document.activeElement;
    fillCategorySelect();
    if (typeof category === 'string' && category) {
      var sel = $('#fCategory');
      var match = $$('#fCategory option').filter(function (o) { return o.value === category; })[0];
      if (match) sel.value = category;
    }
    updatePreview();
    validateForm(false);
    $('#formStatus').textContent = '';
    $('#submitModal').hidden = false;
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { $('#fNameEn').focus(); }, 40);
  }

  function submitIssue(e) {
    if (e) e.preventDefault();
    var errs = validateForm(true);
    if (Object.keys(errs).length) {
      $('#formStatus').textContent = t('submit.blocked');
      var first = $('#submitForm .is-bad');
      if (first) first.focus();
      return;
    }
    $('#formStatus').textContent = '';
    var out = updatePreview();
    window.open(out.url, '_blank', 'noopener');
    toast(t('toast.opened'));
  }

  /* ── events ─────────────────────────────────────────────────────────── */
  function bind() {
    $$('.lang__btn').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });

    $$('[data-langfilter]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.langFilter = b.getAttribute('data-langfilter');
        renderGrid();
      });
    });

    $('#catChips').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip) return;
      state.category = chip.getAttribute('data-cat');
      renderChips();
      renderGrid();
    });

    $('#toggleNoSignup').addEventListener('click', function () { state.noSignup = !state.noSignup; renderGrid(); });
    $('#toggleFree').addEventListener('click', function () { state.free = !state.free; renderGrid(); });
    $('#toggleByok').addEventListener('click', function () { state.byok = !state.byok; renderGrid(); });

    var searchTimer = null;
    $('#searchInput').addEventListener('input', function (e) {
      var v = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = v;
        renderGrid();
      }, 90);
    });

    $('#sortSelect').addEventListener('change', function (e) {
      state.sort = e.target.value;
      renderGrid();
    });

    function reset() {
      state.langFilter = 'all';
      state.category = 'all';
      state.search = '';
      state.noSignup = false;
      state.free = false;
      state.byok = false;
      state.sort = 'fresh';
      $('#searchInput').value = '';
      $('#sortSelect').value = 'fresh';
      renderChips();
      renderGrid();
    }
    $('#resetFilters').addEventListener('click', reset);
    $('#emptyReset').addEventListener('click', reset);

    $('#cardGrid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-app]');
      if (card) openDetail(card.getAttribute('data-app'));
    });

    $$('[data-open-submit]').forEach(function (b) {
      b.addEventListener('click', function () { openSubmit(); });
    });

    $('#emptyCatCta').addEventListener('click', function () { openSubmit(state.category); });

    $$('[data-close]').forEach(function (b) {
      b.addEventListener('click', closeModals);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#detailModal').hidden || !$('#submitModal').hidden) closeModals();
      }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        $('#searchInput').focus();
      }
    });

    $('#submitForm').addEventListener('submit', submitIssue);
    $('#submitForm').addEventListener('input', function () { updatePreview(); });
    $('#submitForm').addEventListener('change', function () { updatePreview(); });
    $('#copySpec').addEventListener('click', function () {
      copyText(Core.jsonSpecText(readForm()), 'submit.copiedJson');
    });
    $('#copySpec2').addEventListener('click', function () {
      copyText(Core.jsonSpecText(readForm()), 'submit.copiedJson');
    });
    $('#copyIssue').addEventListener('click', function () {
      copyText($('#issuePreview').getAttribute('data-url') || '', 'toast.copied');
    });
  }

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    var stored = null;
    try { stored = localStorage.getItem('otm.lang'); } catch (e) { /* ignore */ }
    state.lang = stored && I18N[stored] ? stored : Core.detectLang(navigator.language);

    applyI18n();
    renderChips();
    renderStats();
    renderGrid();
    bind();

    var qs = new URLSearchParams(location.search);
    var deep = qs.get('app');
    if (deep) openDetail(deep);
  }

  function start() {
    if (data && data.apps && data.apps.length) {
      boot();
      return;
    }
    // Bundle missing (someone deleted it) — read the JSON instead.
    fetch('data/apps.json')
      .then(function (r) { return r.json(); })
      .then(function (json) {
        data = json;
        boot();
      })
      .catch(function () {
        var grid = document.getElementById('cardGrid');
        if (grid) grid.innerHTML = '<p class="hint">data/apps.json could not be loaded.</p>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
