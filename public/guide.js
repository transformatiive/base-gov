(function (w) {
  'use strict';

  var EMPTY = {
    v: 1,
    splashDone: false,
    splashChoice: null,
    menuTourDone: false,
    optOut: false,
    screens: {},
  };

  function key(uid) {
    return 'br_guide:' + String(uid == null ? 'anon' : uid);
  }

  function parse(raw) {
    var base = {
      v: 1,
      splashDone: false,
      splashChoice: null,
      menuTourDone: false,
      optOut: false,
      screens: {},
    };
    if (!raw) return base;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return base;
      return {
        v: 1,
        splashDone: !!o.splashDone,
        splashChoice: o.splashChoice === 'tour' || o.splashChoice === 'skip' ? o.splashChoice : null,
        menuTourDone: !!o.menuTourDone,
        optOut: !!o.optOut,
        screens: o.screens && typeof o.screens === 'object' ? Object.assign({}, o.screens) : {},
      };
    } catch (e) {
      return base;
    }
  }

  w.BRGuideProgress = { key: key, parse: parse, EMPTY: EMPTY };

  var running = false;
  var navigating = false;
  var viewReadyWait = null;
  var bound = { can: function () { return true; }, getUserId: function () { return null; } };
  var activeRoot = null;
  var resizeHandler = null;
  var escHandler = null;

  function bindEsc(fn) {
    unbindEsc();
    escHandler = function (e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    document.addEventListener('keydown', escHandler, true);
  }

  function unbindEsc() {
    if (!escHandler) return;
    document.removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }

  function userId() {
    try {
      if (bound.getUserId) return bound.getUserId();
    } catch (e) { /* ignore */ }
    return (w._me && w._me.user_id) || 'anon';
  }

  function load() {
    try {
      return parse(localStorage.getItem(key(userId())));
    } catch (e) {
      return parse(null);
    }
  }

  function save(patch) {
    var cur = load();
    var next = {
      v: 1,
      splashDone: patch.splashDone != null ? patch.splashDone : cur.splashDone,
      splashChoice: patch.splashChoice !== undefined ? patch.splashChoice : cur.splashChoice,
      menuTourDone: patch.menuTourDone != null ? patch.menuTourDone : cur.menuTourDone,
      optOut: patch.optOut != null ? patch.optOut : cur.optOut,
      screens: patch.replaceScreens ? (patch.screens || {}) : Object.assign({}, cur.screens, patch.screens || {}),
    };
    try { localStorage.setItem(key(userId()), JSON.stringify(next)); } catch (e) { /* ignore */ }
    return next;
  }

  function hashBase() {
    return String(w.location.hash || '#/').split('?')[0];
  }

  function canFeature(feat) {
    if (!feat) return true;
    try {
      if (typeof bound.can === 'function') return !!bound.can(feat);
      if (typeof w.can === 'function') return !!w.can(feat);
    } catch (e) { /* ignore */ }
    return true;
  }

  function openNavIfNeeded() {
    if (!w.matchMedia || !w.matchMedia('(max-width: 900px)').matches) return;
    if (typeof w.setAppNavOpen === 'function') w.setAppNavOpen(true);
  }

  function closeNav() {
    if (typeof w.setAppNavOpen === 'function') w.setAppNavOpen(false);
  }

  function waitViewReady() {
    return new Promise(function (resolve) {
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        if (viewReadyWait === finish) viewReadyWait = null;
        resolve();
      };
      viewReadyWait = finish;
      setTimeout(finish, 4000);
    });
  }

  function signalViewReady() {
    if (typeof viewReadyWait === 'function') viewReadyWait();
  }

  function removeRoot() {
    unbindEsc();
    if (resizeHandler) {
      w.removeEventListener('resize', resizeHandler);
      w.removeEventListener('scroll', resizeHandler, true);
      resizeHandler = null;
    }
    if (activeRoot) {
      activeRoot.remove();
      activeRoot = null;
    }
  }

  function stop(opts) {
    opts = opts || {};
    running = false;
    navigating = false;
    removeRoot();
    if (opts.navigated && !opts.complete) {
      /* utilizador saiu pelo menu — marca o tour como feito para não retomar a meio */
    }
  }

  function isRunning() { return running; }

  function placePopover(pop, target, placement) {
    var r = target.getBoundingClientRect();
    var pw = pop.offsetWidth || 340;
    var ph = pop.offsetHeight || 180;
    var gap = 12;
    var top, left;
    var place = placement || 'bottom';
    if (w.matchMedia && w.matchMedia('(max-width: 900px)').matches) place = 'bottom';
    if (place === 'right') {
      left = r.right + gap;
      top = r.top;
    } else if (place === 'left') {
      left = r.left - pw - gap;
      top = r.top;
    } else if (place === 'top') {
      left = r.left;
      top = r.top - ph - gap;
    } else {
      left = r.left;
      top = r.bottom + gap;
    }
    left = Math.max(12, Math.min(left, w.innerWidth - pw - 12));
    top = Math.max(12, Math.min(top, w.innerHeight - ph - 24));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function highlight(target) {
    var spot = activeRoot.querySelector('.guide-spot');
    if (!spot || !target) return;
    var r = target.getBoundingClientRect();
    var pad = 6;
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';
    try { target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  }

  function queryStep(step) {
    if (!step || !step.sel) return null;
    try { return document.querySelector(step.sel); } catch (e) { return null; }
  }

  /**
   * @param {{ sel: string, title: string, body: string, placement?: string, href?: string }[]} steps
   * @param {{ onComplete?: function, onSkip?: function }} cbs
   */
  function startSteps(steps, cbs) {
    cbs = cbs || {};
    stop();
    running = true;
    var list = (steps || []).slice();
    var idx = 0;
    var root = document.createElement('div');
    root.id = 'guide-root';
    root.className = 'guide-root';
    root.innerHTML = '<div class="guide-spot" aria-hidden="true"></div><div class="guide-pop" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(root);
    activeRoot = root;
    var pop = root.querySelector('.guide-pop');

    var shown = 0;
    function finish(kind) {
      running = false;
      navigating = false;
      removeRoot();
      closeNav();
      if (kind === 'complete' && shown > 0 && cbs.onComplete) cbs.onComplete();
      else if (kind === 'skip' && cbs.onSkip) cbs.onSkip();
    }

    function draw() {
      if (!running || !activeRoot) return;
      var step = list[idx];
      if (!step) { finish('complete'); return; }
      var el = queryStep(step);
      if (!el) {
        idx += 1;
        go(idx);
        return;
      }
      shown += 1;
      var n = list.length;
      pop.innerHTML =
        '<p class="guide-n">Passo ' + (idx + 1) + ' de ' + n + '</p>' +
        '<h3>' + esc(step.title) + '</h3>' +
        '<p>' + esc(step.body) + '</p>' +
        '<div class="guide-actions">' +
          '<button type="button" class="btn-secondary" data-g="exit">Sair</button>' +
          '<div class="guide-nav">' +
            '<button type="button" class="btn-secondary" data-g="prev"' + (idx === 0 ? ' disabled' : '') + '>Anterior</button>' +
            '<button type="button" data-g="next">' + (idx === n - 1 ? 'Concluir' : 'Seguinte') + '</button>' +
          '</div>' +
        '</div>';
      highlight(el);
      placePopover(pop, el, step.placement);
      pop.querySelector('[data-g="exit"]').onclick = function () { finish('skip'); };
      var prev = pop.querySelector('[data-g="prev"]');
      if (prev) prev.onclick = function () { if (idx > 0) go(idx - 1); };
      pop.querySelector('[data-g="next"]').onclick = function () {
        if (idx >= n - 1) finish('complete');
        else go(idx + 1);
      };
    }

    function go(nextIdx) {
      idx = nextIdx;
      var step = list[idx];
      if (!step) { finish('complete'); return; }
      var want = step.href ? String(step.href).split('?')[0] : '';
      var apply = function () {
        if (step.href) openNavIfNeeded();
        var tries = 0;
        var tick = function () {
          if (!running) return;
          if (queryStep(step) || tries > 8) {
            if (!queryStep(step)) {
              idx += 1;
              go(idx);
              return;
            }
            draw();
            return;
          }
          tries += 1;
          setTimeout(tick, 80);
        };
        tick();
      };
      if (want && hashBase() !== want) {
        navigating = true;
        w.location.hash = step.href;
        waitViewReady().then(function () {
          navigating = false;
          apply();
        });
        return;
      }
      apply();
    }

    resizeHandler = function () {
      if (!running) return;
      var step = list[idx];
      var el = queryStep(step);
      if (el) {
        highlight(el);
        placePopover(pop, el, step.placement);
      }
    };
    w.addEventListener('resize', resizeHandler);
    w.addEventListener('scroll', resizeHandler, true);
    bindEsc(function () { finish('skip'); });
    go(0);
    setTimeout(function () { pop.querySelector('[data-g="next"]') && pop.querySelector('[data-g="next"]').focus(); }, 50);
  }

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function maybeSplash() {
    return new Promise(function (resolve) {
      var onboard = false;
      try { onboard = sessionStorage.getItem('br_onboard') === '1'; } catch (e) { /* ignore */ }
      var p = load();
      if (p.splashDone || p.optOut || !onboard) { resolve(); return; }
      var cat = w.BRHelpCatalog && w.BRHelpCatalog.splash;
      if (!cat) { resolve(); return; }
      running = true;
      var root = document.createElement('div');
      root.id = 'guide-root';
      root.className = 'guide-root guide-root-splash';
      var cards = (cat.examples || []).map(function (ex) {
        return '<article class="guide-ex-' + esc(ex.id) + '">' +
          (ex.pro ? '<span class="pro">Pro</span>' : '') +
          '<h4>' + esc(ex.title) + '</h4><p>' + esc(ex.body) + '</p></article>';
      }).join('');
      root.innerHTML =
        '<div class="guide-splash" role="dialog" aria-modal="true">' +
          '<p class="guide-n">' + esc(cat.eyebrow) + '</p>' +
          '<h2>' + esc(cat.title) + '</h2>' +
          '<p class="lead">' + esc(cat.lead) + '</p>' +
          '<div class="guide-ex">' + cards + '</div>' +
          '<div class="guide-actions">' +
            '<button type="button" class="btn-secondary" data-g="skip">' + esc(cat.ctaSkip) + '</button>' +
            '<button type="button" data-g="tour">' + esc(cat.ctaTour) + '</button>' +
          '</div>' +
          '<p class="muted guide-foot">' + esc(cat.footnote) + '</p>' +
        '</div>';
      document.body.appendChild(root);
      activeRoot = root;
      function done() {
        running = false;
        removeRoot();
      }
      function skipSplash() {
        save({ splashDone: true, splashChoice: 'skip' });
        try { sessionStorage.removeItem('br_onboard'); } catch (e) { /* ignore */ }
        done();
        resolve();
      }
      root.querySelector('[data-g="skip"]').onclick = skipSplash;
      root.querySelector('[data-g="tour"]').onclick = function () {
        save({ splashDone: true, splashChoice: 'tour' });
        try { sessionStorage.removeItem('br_onboard'); } catch (e) { /* ignore */ }
        done();
        startMenuTour().then(resolve);
      };
      bindEsc(skipSplash);
      setTimeout(function () {
        var t = root.querySelector('[data-g="tour"]');
        if (t) t.focus();
      }, 50);
    });
  }

  function menuSteps() {
    var cat = w.BRHelpCatalog && w.BRHelpCatalog.menuTour;
    return ((cat && cat.steps) || []).map(function (s) {
      var locked = s.feature && !canFeature(s.feature);
      return {
        href: s.href,
        sel: '#topbar nav a[href="' + s.href + '"]',
        title: s.title,
        body: s.body + (locked ? ' Neste plano o menu aparece com cadeado — o conteúdo exige Pro ou Business.' : ''),
        placement: 'right',
      };
    });
  }

  function startMenuTour() {
    return new Promise(function (resolve) {
      var steps = menuSteps();
      if (!steps.length) { resolve(); return; }
      startSteps(steps, {
        onComplete: function () { save({ menuTourDone: true }); resolve(); },
        onSkip: function () { save({ menuTourDone: true }); resolve(); },
      });
    });
  }

  function maybeScreenCoach(id) {
    return new Promise(function (resolve) {
      var p = load();
      if (p.optOut || p.screens[id] || running) { resolve(); return; }
      var spec = w.BRHelpCatalog && w.BRHelpCatalog.screens && w.BRHelpCatalog.screens[id];
      if (!spec) { resolve(); return; }
      var lockedEl = document.querySelector('.upgrade-card');
      var steps;
      if (lockedEl && spec.lockedFallback) {
        steps = [{
          sel: '.upgrade-card',
          title: spec.lockedFallback.title,
          body: spec.lockedFallback.body,
          placement: 'bottom',
        }];
      } else {
        steps = (spec.steps || []).map(function (st) {
          return {
            sel: '[data-guide="' + st.sel + '"]',
            title: st.title,
            body: st.body,
            placement: st.placement || 'bottom',
          };
        }).filter(function (st) { return !!document.querySelector(st.sel); });
      }
      if (!steps.length) { resolve(); return; }
      startSteps(steps, {
        onComplete: function () { var s = {}; s[id] = true; save({ screens: s }); resolve(); },
        onSkip: function () { var s = {}; s[id] = true; save({ screens: s }); resolve(); },
      });
    });
  }

  function afterView(id) {
    if (running) return;
    var p = load();
    if (p.optOut) return;
    maybeScreenCoach(id);
  }

  function replayMenuTour() {
    save({ menuTourDone: false });
    return startMenuTour();
  }

  function replayScreen(id) {
    var s = {};
    s[id] = false;
    save({ screens: s });
    return maybeScreenCoach(id);
  }

  w.BRGuide = {
    bind: function (opts) { bound = Object.assign(bound, opts || {}); },
    loadProgress: load,
    saveProgress: save,
    maybeSplash: maybeSplash,
    startMenuTour: startMenuTour,
    maybeScreenCoach: maybeScreenCoach,
    afterView: afterView,
    stop: function (opts) {
      if (navigating) return;
      var was = running;
      stop(opts);
      if (was && opts && opts.navigated) save({ menuTourDone: true });
    },
    replayMenuTour: replayMenuTour,
    replayScreen: replayScreen,
    setOptOut: function (value) { save({ optOut: !!value }); if (value) stop(); },
    resetGuides: function () {
      save({ menuTourDone: false, optOut: false, screens: {}, replaceScreens: true });
    },
    isRunning: isRunning,
    isNavigating: function () { return navigating; },
    _viewReady: signalViewReady,
  };
})(window);
