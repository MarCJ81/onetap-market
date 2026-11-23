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
    freeAi: false,
    sort: 'fresh',
    submitTab: 'new'
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

  function repo() {
    return (data && data.meta && data.meta.repo) || 'MarCJ81/onetap-market';
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
    if (!$('#submitModal').hidden) {
      fillUpdateApps();
      setTab(state.submitTab);
      updatePreviewUpdate();
    }
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
    if (app.freeAi) {
      out.push('<span class="badge badge--ai" title="' + esc(t('badge.freeAiHint')) + '"><span class="badge__dot"></span>' + esc(t('badge.freeAi')) + '</span>');
    }
    return out.join('');
  }

  function langTag(app) {
    var langs = (app.languages || []).map(function (l) { return l.toUpperCase(); });
    return '<span class="badge badge--log">' + esc(langs.join(' · ')) + '</span>';
  }

  function cardHtml(app) {
    var wide = app.no === 1 || app.no === 9 || app.no === 16 || app.no === 25 || !!app.wide;
    var cls = 'card' + (wide ? ' card--wide' : '') + (app.pricing === 'paid' ? ' card--paid' : '') +
      (app.httpStatus === 200 ? '' : ' card--down');
    var name = pick(app.name, state.lang);
    var short = pick(app.short, state.lang);
    var cat = Core.categoryLabel(app.category, state.lang, categories());
    return (
      '<button type="button" class="' + cls + '" data-app="' + esc(app.slug) + '" aria-haspopup="dialog">' +
        '<span class="card__top"><span class="card__cat">' + esc(cat) + '</span>' +
          '<span class="card__topright">' +
            '<span class="card__ver" title="' + esc(t('ver.badge')) + '">' + esc(Core.appVersion(app)) + '</span>' +
            '<span class="card__no">' + String(app.no).padStart(2, '0') + '</span>' +
          '</span></span>' +
        '<span class="card__name">' + esc(name) + '</span>' +
        '<span class="card__short">' + esc(short) + '</span>' +
        '<span class="card__badges">' + badgeHtml(app) + langTag(app) + '</span>' +
        '<span class="card__foot">' +
          '<span class="card__check" title="' +
            esc(Core.formatStamp(app.lastChecked, state.lang) + ' · ' + Core.timeAgo(app.lastChecked, state.lang)) +
            '"><span class="pulse' + (app.httpStatus === 200 ? '' : ' pulse--down') + '"></span>' +
            '<span class="card__check-txt">' + esc(t('card.checked')) + ' ' +
              esc(Core.formatShortStamp(app.lastChecked, state.lang)) + '</span></span>' +
          '<span class="card__link" title="' + esc(t('card.detailsFull')) + '">' +
            esc(t('card.details')) + ' →</span>' +
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
      freeAi: state.freeAi,
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
    $('#toggleFreeAi').classList.toggle('is-on', state.freeAi);
    $('#toggleFreeAi').setAttribute('aria-pressed', String(state.freeAi));
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

  function versionPill(app) {
    return (
      '<span class="detail__ver" title="' + esc(t('ver.badge')) + '">' +
        esc(Core.appVersion(app)) + ' <span>' + esc(t('ver.current')) + '</span>' +
      '</span>'
    );
  }

  function changelogHtml(app) {
    var list = Core.changelog(app);
    if (!list.length) return '';
    var items = list
      .map(function (e, i) {
        return (
          '<li class="changelog__item' + (i === 0 ? ' changelog__item--latest' : '') + '">' +
            '<span class="changelog__head">' +
              '<span class="changelog__ver">' + esc(e.version) + '</span>' +
              (i === 0 ? '<span class="changelog__tag">' + esc(t('ver.latest')) + '</span>' : '') +
              '<span class="changelog__date">' + esc(e.date) + '</span>' +
            '</span>' +
            '<span class="changelog__notes">' + esc(pick(e.notes, state.lang)) + '</span>' +
          '</li>'
        );
      })
      .join('');
    return (
      '<h3>' + esc(t('modal.history')) + '</h3>' +
      '<ol class="changelog">' + items + '</ol>' +
      '<p class="hint" style="margin-top:8px">' + esc(t('modal.historyNote')) + '</p>'
    );
  }

  function feedbackHtml(app) {
    var types = Core.FEEDBACK_TYPES.map(function (tp) {
      var label = tp === 'bug' ? t('fb.typeBug') : tp === 'feature' ? t('fb.typeFeature') : t('fb.typeReview');
      return '<option value="' + tp + '">' + esc(label) + '</option>';
    }).join('');
    return (
      '<h3>' + esc(t('modal.feedback')) + '</h3>' +
      '<div class="fb" id="feedbackBlock" data-app="' + esc(app.slug) + '">' +
        '<p class="fb__lead">' + esc(t('modal.feedbackLead')) + '</p>' +
        '<div class="fb__state" id="feedbackState" aria-live="polite">' + esc(t('modal.feedbackLoading')) + '</div>' +
        '<ul class="fb__list" id="feedbackList" hidden></ul>' +
        '<form class="fb__form" id="feedbackForm" novalidate>' +
          '<h4>' + esc(t('fb.title')) + '</h4>' +
          '<div class="fb__row">' +
            '<div class="fb__field"><label for="fbNick">' + esc(t('fb.nick')) + '</label>' +
              '<input id="fbNick" name="nick" type="text" maxlength="40" autocomplete="off" placeholder="' + esc(t('fb.nickPlaceholder')) + '"></div>' +
            '<div class="fb__field"><label for="fbType">' + esc(t('fb.type')) + '</label>' +
              '<select id="fbType" name="type">' + types + '</select></div>' +
          '</div>' +
          '<div class="fb__field"><label for="fbContent">' + esc(t('fb.content')) + '</label>' +
            '<textarea id="fbContent" name="content" maxlength="2000" rows="3" placeholder="' + esc(t('fb.contentPlaceholder')) + '"></textarea>' +
            '<span class="fb__err" id="fbErr"></span></div>' +
          '<div class="fb__actions">' +
            '<button type="button" class="btn btn--primary" id="fbGithub">' + esc(t('fb.github')) + '</button>' +
            '<button type="button" class="btn btn--ghost" id="fbCopy">' + esc(t('fb.copy')) + '</button>' +
          '</div>' +
          '<p class="fb__status" id="fbStatus" aria-live="polite"></p>' +
          '<p class="fb__hint">' + esc(t('fb.hint')) + '</p>' +
          '<p class="fb__hint">' + esc(t('modal.feedbackApi')) + '</p>' +
        '</form>' +
      '</div>'
    );
  }

  var fbCache = {};

  function paintFeedback(res, app) {
    var stateEl = $('#feedbackState');
    var listEl = $('#feedbackList');
    if (!stateEl || !listEl) return;
    var open = '<a href="' + esc(Core.feedbackFallbackUrl(repo())) +
      '" target="_blank" rel="noopener noreferrer">' + esc(t('modal.feedbackOpen')) + '</a>';
    if (!res || res.ok === false) {
      stateEl.hidden = false;
      stateEl.className = 'fb__state fb__state--bad';
      stateEl.innerHTML = esc(t('modal.feedbackFailed')) + ' ' + open;
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }
    if (!res.items.length) {
      stateEl.hidden = false;
      stateEl.className = 'fb__state';
      stateEl.innerHTML = esc(t('modal.feedbackEmpty')) + ' ' + open;
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }
    stateEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = res.items
      .map(function (it) {
        var label =
          it.type === 'bug' ? t('fb.typeBug') : it.type === 'feature' ? t('fb.typeFeature') : t('fb.typeReview');
        var when = it.date ? Core.formatStamp(it.date, state.lang).replace(' KST', '') : '';
        return (
          '<li class="fb__item">' +
            '<a class="fb__title" href="' + esc(it.url) + '" target="_blank" rel="noopener noreferrer">' + esc(it.title) + '</a>' +
            '<span class="fb__meta">' +
              '<span class="fb__type">' + esc(label) + '</span>' +
              '<span>' + esc(it.author || t('modal.feedbackAnonymous')) + '</span>' +
              (when ? '<span>' + esc(when) + '</span>' : '') +
              (it.number ? '<span>#' + it.number + '</span>' : '') +
            '</span>' +
          '</li>'
        );
      })
      .join('');
  }

  /* One read-only GET to the public GitHub API, once per card per visit. It is the
     only request this page makes, and every failure path still leaves a working
     form — offline, 403 rate limit or a shape nobody expected. */
  function loadFeedback(app) {
    if (!$('#feedbackBlock')) return;
    if (fbCache[app.slug]) {
      paintFeedback(fbCache[app.slug], app);
      return;
    }
    var stateEl = $('#feedbackState');
    if (stateEl) {
      stateEl.hidden = false;
      stateEl.className = 'fb__state';
      stateEl.textContent = t('modal.feedbackLoading');
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, 8000);
    var settle = function (res) {
      clearTimeout(timer);
      fbCache[app.slug] = res;
      if (document.body.getAttribute('data-open-app') !== app.slug) return;
      paintFeedback(res, app);
    };
    try {
      fetch(Core.feedbackApiUrl(repo()), {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
        credentials: 'omit',
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then(function (payload) {
          settle(Core.parseFeedbackIssues(payload, app, repo()));
        })
        .catch(function () {
          settle({ ok: false, reason: 'network', items: [] });
        });
    } catch (e) {
      settle({ ok: false, reason: 'network', items: [] });
    }
  }

  function readFeedback() {
    return {
      nick: $('#fbNick') ? $('#fbNick').value : '',
      type: $('#fbType') ? $('#fbType').value : 'review',
      content: $('#fbContent') ? $('#fbContent').value : '',
      lang: state.lang
    };
  }

  function bindFeedback(app) {
    var githubBtn = $('#fbGithub');
    var copyBtn = $('#fbCopy');
    if (!githubBtn || !copyBtn) return;
    function checked() {
      var fb = readFeedback();
      var errs = Core.validateFeedback(fb);
      $('#fbErr').textContent = errs.content ? t('fb.errContent') : '';
      var ok = Object.keys(errs).length === 0;
      $('#fbStatus').textContent = ok ? '' : t('fb.blocked');
      return { fb: fb, ok: ok };
    }
    githubBtn.addEventListener('click', function () {
      var r = checked();
      if (!r.ok) {
        if ($('#fbContent')) $('#fbContent').focus();
        return;
      }
      window.open(Core.feedbackIssueUrl(app, r.fb, repo()), '_blank', 'noopener');
      toast(t('toast.opened'));
    });
    /* Typing again clears the last complaint, so a corrected message ships cleanly. */
    $('#feedbackForm').addEventListener('input', function () {
      if ($('#fbErr').textContent) $('#fbErr').textContent = '';
      if ($('#fbStatus').textContent) $('#fbStatus').textContent = '';
    });
    copyBtn.addEventListener('click', function () {
      var r = checked();
      if (!r.ok) {
        if ($('#fbContent')) $('#fbContent').focus();
        return;
      }
      copyText(Core.feedbackText(app, r.fb, state.lang), 'fb.copied');
    });
    loadFeedback(app);
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
          versionPill(app),
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
          (app.freeAi
            ? '<div class="fact fact--wide"><span class="fact__k">' + esc(t('modal.ai')) + '</span><span class="fact__v">' + esc(t('modal.aiFree')) + '</span></div>'
            : ''),
          '<div class="fact"><span class="fact__k">' + esc(t('modal.creator')) + '</span><span class="fact__v">' + esc((data.meta && data.meta.creator) || 'OneTap Labs') + '</span></div>',
        '</div>',
        '<div class="detail__actions">',
          '<a class="btn btn--primary" href="' + esc(app.url) + '" target="_blank" rel="noopener noreferrer" data-launch>' + esc(t('modal.launch')) + ' ↗</a>',
          '<button type="button" class="btn btn--ghost" id="copyAppLink">' + esc(t('modal.copyLink')) + '</button>',
        '</div>',
        '<p class="detail__link">' + esc(t('modal.linkLabel')) + ': <code>' + esc(Core.appLink(app, BASE_URL)) + '</code></p>',
        '<p class="hint" style="margin-top:6px">' + esc(t('modal.verifiedBy')) + '</p>',
        changelogHtml(app),
        feedbackHtml(app),
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
    bindFeedback(app);
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
    var url = Core.submissionIssueUrl(form, repo());
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
    fillUpdateApps();
    setTab('new');
    if (typeof category === 'string' && category) {
      var sel = $('#fCategory');
      var match = $$('#fCategory option').filter(function (o) { return o.value === category; })[0];
      if (match) sel.value = category;
    }
    updatePreview();
    validateForm(false);
    updatePreviewUpdate();
    validateUpdateForm(false);
    $('#formStatus').textContent = '';
    $('#updateStatus').textContent = '';
    $('#submitModal').hidden = false;
    document.documentElement.style.overflow = 'hidden';
    setTimeout(function () { $('#fNameEn').focus(); }, 40);
  }

  /* ── submit tabs: new listing / version update ───────────────────────── */
  function setTab(name) {
    var tab = name === 'update' ? 'update' : 'new';
    state.submitTab = tab;
    $$('#submitTabs .tab').forEach(function (b) {
      var on = b.getAttribute('data-tab') === tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var newPanel = $('#panelNew');
    var upPanel = $('#panelUpdate');
    if (newPanel) newPanel.hidden = tab !== 'new';
    if (upPanel) upPanel.hidden = tab !== 'update';
    var titleEl = $('#submitTitle');
    var leadEl = $('#submitLead');
    if (titleEl) titleEl.textContent = t(tab === 'update' ? 'up.title' : 'submit.title');
    if (leadEl) leadEl.textContent = t(tab === 'update' ? 'up.lead' : 'submit.lead');
    var panel = $('#submitModal .modal__panel');
    if (panel) panel.scrollTop = 0;
  }

  function fillUpdateApps() {
    var sel = $('#uApp');
    if (!sel) return;
    var current = sel.value;
    var rows = [
      '<option value="">' + esc(t('up.appNone')) + '</option>'
    ].concat(
      apps().map(function (a) {
        return (
          '<option value="' + esc(a.slug) + '">' +
            esc(pick(a.name, state.lang)) + ' · ' + esc(Core.appVersion(a)) +
          '</option>'
        );
      })
    );
    sel.innerHTML = rows.join('');
    sel.value = current && findAppIn(current) ? current : '';
  }

  function findAppIn(key) {
    return Core.findAppIn(apps(), key);
  }

  function readUpdate() {
    var el = function (sel) { return $(sel) ? $(sel).value : ''; };
    return {
      appId: el('#uApp'),
      version: el('#uVersion'),
      url: el('#uUrl'),
      notesEn: el('#uNotesEn'),
      notesKo: el('#uNotesKo'),
      lang: state.lang
    };
  }

  function updateErrorText(code) {
    if (code === 'required') return t('up.errApp');
    if (code === 'version') return t('up.errVersion');
    if (code === 'older') return t('up.errOlder');
    if (code === 'url') return t('submit.errUrl');
    if (code === 'short') return t('up.errNotes');
    return t('submit.errRequired');
  }

  function updatePreviewUpdate() {
    var form = readUpdate();
    var app = findAppIn(form.appId);
    var patch = Core.updatePatch(app, form);
    if (app && !String(form.url || '').trim()) patch.url = app.url;
    $('#updatePreview').textContent = JSON.stringify(patch, null, 2);
    var url = Core.updateIssueUrl(app, form, repo());
    var parts = url.split('?');
    $('#updateIssuePreview').setAttribute('data-url', url);
    $('#updateIssuePreview').setAttribute('title', url);
    $('#updateIssueHost').textContent = parts[0].replace('https://', '');
    $('#updateIssueQuery').textContent = '?' + (parts[1] || '');
    $('#updateIssueMeta').textContent =
      t('submit.issueMeta') + ' ' + (parts[1] || '').length.toLocaleString('en-US') + ' ' + t('submit.issueChars');
    return { form: form, app: app, patch: patch, url: url };
  }

  function validateUpdateForm(showErrors) {
    var form = readUpdate();
    var errs = Core.validateUpdate(form, apps());
    $$('#updateForm .err').forEach(function (el) { el.textContent = ''; });
    $$('#updateForm input').forEach(function (el) { el.classList.remove('is-bad'); });
    if (showErrors) {
      Object.keys(errs).forEach(function (field) {
        var slot = $('[data-err="' + field + '"]');
        if (slot) slot.textContent = updateErrorText(errs[field]);
        var input = field === 'appId' ? $('#uApp') : $('#u' + field.charAt(0).toUpperCase() + field.slice(1));
        if (input && input.classList) input.classList.add('is-bad');
      });
    }
    return errs;
  }

  function submitUpdate(e) {
    if (e) e.preventDefault();
    var errs = validateUpdateForm(true);
    if (Object.keys(errs).length) {
      $('#updateStatus').textContent = t('up.blocked');
      var first = $('#updateForm .is-bad');
      if (first) first.focus();
      return;
    }
    $('#updateStatus').textContent = '';
    var out = updatePreviewUpdate();
    window.open(out.url, '_blank', 'noopener');
    toast(t('toast.opened'));
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
    $('#toggleFreeAi').addEventListener('click', function () { state.freeAi = !state.freeAi; renderGrid(); });

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
      state.freeAi = false;
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

    /* submit modal: the second tab files a version update instead of a listing */
    $$('#submitTabs .tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
    });
    $('#uApp').addEventListener('change', function () {
      var app = findAppIn($('#uApp').value);
      $('#uVersion').value = app ? Core.nextVersion(Core.appVersion(app)) : '';
      $('#uUrl').value = app ? app.url : '';
      updatePreviewUpdate();
      validateUpdateForm(false);
    });
    $('#updateForm').addEventListener('submit', submitUpdate);
    $('#updateForm').addEventListener('input', function () { updatePreviewUpdate(); });
    $('#updateForm').addEventListener('change', function () { updatePreviewUpdate(); });
    function copyPatch() {
      copyText(JSON.stringify(updatePreviewUpdate().patch, null, 2), 'up.copiedJson');
    }
    $('#copyPatch').addEventListener('click', copyPatch);
    $('#copyPatch2').addEventListener('click', copyPatch);
    $('#copyUpdateIssue').addEventListener('click', function () {
      copyText($('#updateIssuePreview').getAttribute('data-url') || '', 'toast.copied');
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
