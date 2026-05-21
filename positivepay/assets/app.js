/* Advanced Fraud Academy — app.js
   Handles: lesson progress (localStorage) + inline self-check quizzes
   No framework. No build step. */

(function () {
  'use strict';

  /* ── Progress tracking ── */
  var STORAGE_KEY = 'afa_progress';

  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveProgress(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getLessonId() {
    return window.location.pathname.replace(/\/+$/, '').replace(/^\/positivepay\//, '') || '';
  }

  function initCompleteButton() {
    var btn = document.querySelector('.complete-btn');
    if (!btn) return;

    var id = getLessonId();
    var progress = getProgress();

    if (progress[id]) markDone(btn);

    btn.addEventListener('click', function () {
      var p = getProgress();
      if (p[id]) {
        delete p[id];
        saveProgress(p);
        markUndone(btn);
        updateLessonListChecks();
      } else {
        p[id] = 1;
        saveProgress(p);
        markDone(btn);
        updateLessonListChecks();
        trackEvent('lesson_complete', { lesson_id: id });

        // Show toast, then navigate to track overview
        var parts = window.location.pathname.split('/').filter(Boolean);
        var trackIdx = parts.findIndex(function (s) { return /^track-\d+$/.test(s); });
        if (trackIdx !== -1) {
          var trackUrl = '/' + parts.slice(0, trackIdx + 1).join('/') + '/';
          showLessonCompleteToast(function () {
            window.location.href = trackUrl;
          });
        } else {
          showLessonCompleteToast(null);
        }
      }
    });
  }

  function markDone(btn) {
    btn.classList.add('done');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg> Completed';
  }

  function markUndone(btn) {
    btn.classList.remove('done');
    btn.innerHTML = 'Mark complete';
  }

  function updateLessonListChecks() {
    var progress = getProgress();
    document.querySelectorAll('.lesson-item[data-lesson-id]').forEach(function (item) {
      var id = item.getAttribute('data-lesson-id');
      var check = item.querySelector('.lesson-check');
      if (!check) return;
      if (progress[id]) {
        check.classList.add('done');
        item.classList.add('completed');
      } else {
        check.classList.remove('done');
        item.classList.remove('completed');
      }
    });
  }

  /* ── Self-check quiz ── */
  function initQuizzes() {
    var lessonId = getLessonId();
    document.querySelectorAll('.quiz-question').forEach(function (question, qIdx) {
      var correctIndex = parseInt(question.getAttribute('data-correct'), 10);
      var feedback = question.querySelector('.quiz-feedback');
      var options = question.querySelectorAll('.quiz-option');
      var answered = false;

      options.forEach(function (opt, idx) {
        opt.addEventListener('click', function () {
          if (answered) return;
          answered = true;

          options.forEach(function (o, i) {
            if (i === correctIndex) {
              o.classList.add('correct');
            } else if (i === idx && idx !== correctIndex) {
              o.classList.add('incorrect');
            }
          });

          if (feedback) {
            feedback.classList.add('visible');
            if (idx === correctIndex) {
              feedback.classList.add('correct');
              feedback.classList.remove('incorrect');
            } else {
              feedback.classList.add('incorrect');
              feedback.classList.remove('correct');
            }
          }

          var result = (idx === correctIndex) ? 'correct' : 'incorrect';
          trackEvent('quiz_answer', {
            lesson_id: lessonId,
            question: 'q' + (qIdx + 1),
            result: result
          });
        });
      });
    });
  }

  /* ── Celebration: lesson complete toast ── */
  function showLessonCompleteToast(onDone) {
    var toast = document.createElement('div');
    toast.className = 'afa-toast';
    toast.innerHTML =
      '<div class="afa-toast-check">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
             'stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="4 12 10 18 20 6"/>' +
        '</svg>' +
      '</div>' +
      '<div class="afa-toast-text">' +
        '<strong>Lesson complete</strong>' +
        '<span>Nice work — keep going.</span>' +
      '</div>';
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        toast.classList.add('afa-toast-visible');
      });
    });

    setTimeout(function () {
      toast.classList.remove('afa-toast-visible');
      toast.classList.add('afa-toast-out');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        if (onDone) onDone();
      }, 380);
    }, 1700);
  }

  /* ── Celebration: track complete modal ── */
  function checkAndShowTrackComplete() {
    var items = document.querySelectorAll('.lesson-item[data-lesson-id]');
    if (!items.length) return;

    var progress = getProgress();
    var total = items.length;
    var completed = 0;

    items.forEach(function (item) {
      var id = item.getAttribute('data-lesson-id');
      if (progress[id]) completed++;
    });

    if (completed < total) return;

    var trackMatch = window.location.pathname.match(/\/track-(\d+)\//);
    if (!trackMatch) return;
    var trackNum = trackMatch[1];

    // Only celebrate once — mark in localStorage so it doesn't repeat on return visits
    var celebKey = 'afa_track_celebrated_' + trackNum;
    try {
      if (localStorage.getItem(celebKey)) return;
      localStorage.setItem(celebKey, '1');
    } catch (e) {}

    trackEvent('track_complete', { track: trackNum, lessons: total });

    showTrackCompleteModal(trackNum, total);
  }

  function showTrackCompleteModal(trackNum, lessonCount) {
    spawnConfetti();

    var trackNames = {
      '1': 'Foundations',
      '2': 'The Adoption Playbook',
      '3': 'The Commercial Conversation',
      '4': 'Pricing & Revenue',
      '5': 'Advanced Operations'
    };
    var trackName = trackNames[trackNum] || ('Track ' + trackNum);
    var nextTrackNum = parseInt(trackNum, 10) + 1;

    var subText, primaryCta, secondaryCta;

    if (trackNum === '3') {
      subText = 'You finished all ' + lessonCount + ' lessons. Your Practitioner Certificate is unlocked.';
      primaryCta = '<a href="/positivepay/certificate/" class="btn btn-primary afa-modal-btn">Claim your certificate →</a>';
      secondaryCta = '<a href="/positivepay/track-4/" class="btn btn-ghost-light afa-modal-btn">Continue to Track 4</a>';
    } else if (trackNum === '5') {
      subText = 'You\'ve completed all 5 tracks. Your Strategist Certificate is unlocked.';
      primaryCta = '<a href="/positivepay/certificate/" class="btn btn-primary afa-modal-btn">Claim your certificate →</a>';
      secondaryCta = '';
    } else {
      var tracksLeft = 5 - parseInt(trackNum, 10);
      subText = 'You finished all ' + lessonCount + ' lessons in Track ' + trackNum + '. ' +
                tracksLeft + ' track' + (tracksLeft !== 1 ? 's' : '') + ' to go.';
      primaryCta = '<a href="/positivepay/track-' + nextTrackNum + '/" class="btn btn-primary afa-modal-btn">Start Track ' + nextTrackNum + ' →</a>';
      secondaryCta = '';
    }

    var modal = document.createElement('div');
    modal.className = 'afa-modal-overlay';
    modal.innerHTML =
      '<div class="afa-modal-card">' +
        '<div class="afa-modal-icon">' +
          '<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="40" cy="40" r="40" fill="#ADE25D" fill-opacity="0.18"/>' +
            '<polyline points="18 40 32 54 62 24" stroke="#ADE25D" stroke-width="4" ' +
                      'stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</div>' +
        '<div class="afa-modal-eyebrow">Track ' + trackNum + ' of 5 Complete</div>' +
        '<h2 class="afa-modal-title">' + trackName + '.</h2>' +
        '<p class="afa-modal-sub">' + subText + '</p>' +
        '<div class="afa-modal-actions">' +
          primaryCta +
          secondaryCta +
          '<button class="afa-modal-dismiss" onclick="this.closest(\'.afa-modal-overlay\').remove()">Dismiss</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('afa-modal-visible');
      });
    });
  }

  /* ── Confetti ── */
  function spawnConfetti() {
    var colors = ['#E5222A', '#ADE25D', '#F5C842', '#ffffff', '#0E0E0E'];
    var container = document.createElement('div');
    container.className = 'afa-confetti-container';
    document.body.appendChild(container);

    for (var i = 0; i < 72; i++) {
      (function () {
        var piece = document.createElement('div');
        piece.className = 'afa-confetti-piece';
        var size = 6 + Math.random() * 7;
        piece.style.left = (Math.random() * 100) + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = size + 'px';
        piece.style.height = size + 'px';
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.animationDelay = (Math.random() * 1.6) + 's';
        piece.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
        container.appendChild(piece);
      })();
    }

    setTimeout(function () {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 5500);
  }

  /* ── Activity tracking ── */
  // Paste your Pardot Form Handler URL below.
  // In Pardot: Marketing > Forms > Form Handlers > New Form Handler
  // Add fields: email, action, lesson_id, question, result, track, page
  function trackEvent(action, data) {
    var email = '';
    try { email = localStorage.getItem('afa_user_email') || ''; } catch (e) {}

    // Always log to console so you can verify events fire correctly
    console.log('[AFA track]', action, data);

    var h1 = document.querySelector('article h1');
    var payload = {
      action: action,
      email: email,
      page: window.location.pathname,
      lesson_name: h1 ? h1.textContent.trim() : ''
    };
    if (data) {
      Object.keys(data).forEach(function (k) { payload[k] = data[k]; });
    }

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  /* ── Enrollment gate ── */
  function isEnrolled() {
    try {
      return !!localStorage.getItem('afa_user_email');
    } catch (e) {
      return false;
    }
  }

  function initEnrollmentGate() {
    // Only gate on lesson pages (have a lesson-body-wrap and complete-btn)
    var body = document.querySelector('.lesson-body-wrap');
    var btn = document.querySelector('.complete-btn');
    if (!body || !btn) return;

    // If enrolled, nothing to do
    if (isEnrolled()) return;

    // Find the main content column
    var content = document.querySelector('.lesson-content');
    if (!content) return;

    // Wrap the content in a gate container
    var wrap = document.createElement('div');
    wrap.className = 'afa-gate-wrap';
    content.parentNode.insertBefore(wrap, content);
    wrap.appendChild(content);

    // Inject the gate overlay
    var overlay = document.createElement('div');
    overlay.className = 'afa-gate-overlay';
    overlay.innerHTML =
      '<div class="afa-gate-card">' +
        '<div class="afa-gate-lock">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
            '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
          '</svg>' +
        '</div>' +
        '<h3 class="afa-gate-title">Enroll free to read this lesson</h3>' +
        '<p class="afa-gate-sub">The Academy is free. Takes 60 seconds to enroll. Your progress is saved automatically once you\'re in.</p>' +
        '<a href="/positivepay/#enroll" class="btn btn-primary afa-gate-btn">Enroll free →</a>' +
        '<div class="afa-gate-divider"><span>Already enrolled?</span></div>' +
        '<div class="afa-gate-unlock">' +
          '<input type="email" class="afa-gate-email" placeholder="Enter your email to unlock" autocomplete="email"/>' +
          '<button type="button" class="afa-gate-unlock-btn">Unlock</button>' +
        '</div>' +
        '<p class="afa-gate-unlock-err" style="display:none">Please enter a valid email address.</p>' +
      '</div>';
    wrap.appendChild(overlay);

    // Inline unlock: set localStorage and remove gate without re-enrolling
    var emailInput = overlay.querySelector('.afa-gate-email');
    var unlockBtn = overlay.querySelector('.afa-gate-unlock-btn');
    var errMsg = overlay.querySelector('.afa-gate-unlock-err');

    function doUnlock() {
      var val = emailInput.value.trim();
      if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errMsg.style.display = 'block';
        emailInput.focus();
        return;
      }
      errMsg.style.display = 'none';
      try { localStorage.setItem('afa_user_email', val); } catch (e) {}
      // Animate out and remove gate
      wrap.classList.add('afa-gate-unlocking');
      setTimeout(function () {
        if (wrap.parentNode) {
          wrap.parentNode.insertBefore(content, wrap);
          wrap.parentNode.removeChild(wrap);
        }
        // Re-enable the complete button
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '';
          btn.style.cursor = '';
          btn.style.pointerEvents = '';
          btn.title = '';
        }
      }, 350);
    }

    unlockBtn.addEventListener('click', doUnlock);
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doUnlock();
    });

    // Disable the mark-complete button
    if (btn) {
      btn.disabled = true;
      btn.title = 'Enroll to unlock lessons';
      btn.style.opacity = '0.4';
      btn.style.cursor = 'default';
      btn.style.pointerEvents = 'none';
    }
  }

  /* ── Boot ── */
  function boot() {
    initCompleteButton();
    initQuizzes();
    updateLessonListChecks();
    checkAndShowTrackComplete();
    initEnrollmentGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ============================================================
   Fraud-news footer ticker
   ------------------------------------------------------------
   Auto-injects a thin scrolling marquee of recent fraud news
   into <footer class="footer"> on every page. Data comes from
   /api/fraud-news (Vercel function). Honors prefers-reduced-motion.
   Cached in localStorage for 15 min to avoid hammering on every
   page navigation.
   ============================================================ */
(function () {
  'use strict';

  var TICKER_CACHE_KEY = 'afa_news_cache_v1';
  var TICKER_CACHE_MS = 15 * 60 * 1000; // 15 minutes
  var TICKER_MAX_ITEMS = 12;
  var NEWS_PAGE = '/positivepay/news/';

  // Don't double-render if the news page is showing the full feed inline
  // (the ticker is still useful even on /news/, but skip if explicitly disabled)
  if (document.documentElement.getAttribute('data-no-ticker') === 'true') return;

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function injectStyles() {
    if (document.getElementById('afa-ticker-styles')) return;
    var css =
      '.afa-ticker{position:relative;background:#3A3A3A;overflow:hidden;color:#fff;font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)}' +
      '.afa-ticker + .footer{margin-top:0}' +
      '.afa-ticker + footer.footer{margin-top:0}' +
      '.afa-ticker__inner{display:flex;align-items:center;gap:0;height:48px}' +
      '.afa-ticker__label{flex-shrink:0;display:flex;align-items:center;gap:8px;padding:0 20px;height:100%;background:var(--afs-red,#C70200);font-size:11px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#fff;position:relative;z-index:2}' +
      '.afa-ticker__label .afa-ticker__dot{width:7px;height:7px;border-radius:50%;background:#fff;animation:afa-tick-pulse 1.6s ease-in-out infinite}' +
      '@keyframes afa-tick-pulse{0%,100%{opacity:1}50%{opacity:0.4}}' +
      '.afa-ticker__viewport{flex:1;overflow:hidden;position:relative;min-width:0;height:100%}' +
      '.afa-ticker__viewport::after{content:"";position:absolute;top:0;right:0;width:80px;height:100%;background:linear-gradient(to right,transparent,#3A3A3A);pointer-events:none}' +
      '.afa-ticker__track{display:inline-flex;align-items:center;height:100%;white-space:nowrap;animation:afa-tick-scroll 240s linear infinite;will-change:transform}' +
      '.afa-ticker:hover .afa-ticker__track,.afa-ticker:focus-within .afa-ticker__track{animation-play-state:paused}' +
      '@keyframes afa-tick-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}' +
      '.afa-ticker__item{display:inline-flex;align-items:center;gap:10px;padding:0 28px;font-size:13.5px;color:rgba(255,255,255,0.92);text-decoration:none;transition:color 120ms ease}' +
      '.afa-ticker__item:hover{color:#fff}' +
      '.afa-ticker__item:hover .afa-ticker__title{text-decoration:underline;text-underline-offset:3px}' +
      '.afa-ticker__src{font-size:10px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--academy-green,#ADE25D);flex-shrink:0}' +
      '.afa-ticker__title{font-weight:500;color:#fff}' +
      '.afa-ticker__sep{color:rgba(255,255,255,0.25);flex-shrink:0;font-size:10px}' +
      '.afa-ticker__all{flex-shrink:0;padding:0 18px;height:100%;display:flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:0.5px;color:#fff;background:rgba(255,255,255,0.06);border-left:1px solid rgba(255,255,255,0.08);text-decoration:none;transition:background 120ms ease}' +
      '.afa-ticker__all:hover{background:rgba(255,255,255,0.12)}' +
      '@media(max-width:600px){.afa-ticker__label{padding:0 12px;font-size:10px;letter-spacing:1.2px}.afa-ticker__all{padding:0 12px;font-size:10px}.afa-ticker__item{padding:0 20px;font-size:12.5px}}' +
      '@media(prefers-reduced-motion:reduce){.afa-ticker__track{animation:afa-tick-fade 36s steps(1,end) infinite;transform:none}.afa-ticker__viewport::after{display:none}@keyframes afa-tick-fade{0%,100%{transform:translateX(0)}}}';
    var style = document.createElement('style');
    style.id = 'afa-ticker-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function getCache() {
    try {
      var raw = localStorage.getItem(TICKER_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.fetchedAt || !Array.isArray(obj.items)) return null;
      if (Date.now() - obj.fetchedAt > TICKER_CACHE_MS) return null;
      return obj;
    } catch (e) { return null; }
  }

  function setCache(items) {
    try {
      localStorage.setItem(TICKER_CACHE_KEY, JSON.stringify({
        fetchedAt: Date.now(),
        items: items
      }));
    } catch (e) {}
  }

  function buildTickerHTML(items) {
    if (!items || !items.length) return '';

    var itemHTML = items.slice(0, TICKER_MAX_ITEMS).map(function (it) {
      return '<a class="afa-ticker__item" href="' + escapeHTML(it.url) +
             '" target="_blank" rel="noopener">' +
             '<span class="afa-ticker__src">' + escapeHTML(it.source) + '</span>' +
             '<span class="afa-ticker__sep">|</span>' +
             '<span class="afa-ticker__title">' + escapeHTML(it.title) + '</span>' +
             '</a>';
    }).join('<span class="afa-ticker__sep" aria-hidden="true">•</span>');

    // Duplicate the track for a seamless infinite scroll
    return '<div class="afa-ticker" role="region" aria-label="Latest fraud news">' +
             '<div class="afa-ticker__inner">' +
               '<div class="afa-ticker__label"><span class="afa-ticker__dot" aria-hidden="true"></span>Fraud Watch</div>' +
               '<div class="afa-ticker__viewport">' +
                 '<div class="afa-ticker__track">' +
                   itemHTML +
                   '<span class="afa-ticker__sep" aria-hidden="true">•</span>' +
                   itemHTML +
                 '</div>' +
               '</div>' +
               '<a class="afa-ticker__all" href="' + NEWS_PAGE + '">All news →</a>' +
             '</div>' +
           '</div>';
  }

  function injectTicker(items) {
    if (!items || !items.length) return;

    // Mount just BEFORE <footer class="footer"> — sits as its own visual strip
    // between page content and footer, sidestepping the footer's 80px top padding
    var footer = document.querySelector('footer.footer');
    if (!footer || !footer.parentNode) return;
    if (document.querySelector('.afa-ticker')) return; // already injected

    injectStyles();

    var wrap = document.createElement('div');
    wrap.innerHTML = buildTickerHTML(items);
    var el = wrap.firstChild;
    if (el) footer.parentNode.insertBefore(el, footer);
  }

  function loadAndInject() {
    var cached = getCache();
    if (cached) {
      injectTicker(cached.items);
      return; // Fresh cache — skip the network round-trip
    }

    // No (or stale) cache → fetch
    fetch('/api/fraud-news')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.items)) return;
        setCache(data.items);
        injectTicker(data.items);
      })
      .catch(function (e) {
        // Silent fail — ticker is supplemental, not critical
        if (window.console) console.warn('[ticker] fetch failed:', e.message);
      });
  }

  function boot() { loadAndInject(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ============================================================
   Enrollment prompt modal
   ------------------------------------------------------------
   Soft prompt that appears after a visitor has been on the site
   for a "reasonable" amount of time (60s on page OR 60% scroll
   depth, whichever comes first). Shown once per visitor; dismissed
   = suppressed for 14 days. Skips pages where it would be
   redundant or interruptive (lesson pages have their own gate,
   start/thank-you/certificate are flows in progress or post-convert).
   ============================================================ */
(function () {
  'use strict';

  var ENROLL_PROMPT_TIMER_MS  = 60 * 1000;          // 60s on page
  var ENROLL_PROMPT_SCROLL    = 0.60;                // OR 60% scrolled
  var DISMISS_SUPPRESS_MS     = 14 * 24 * 60 * 60 * 1000; // 14 days
  var ENROLLED_KEY            = 'afa_user_email';
  var DISMISSED_KEY           = 'afa_enroll_prompt_dismissed';
  var ENROLL_URL              = '/positivepay/#enroll';

  // Pages where the prompt would be redundant or interrupt a conversion flow.
  function isSkippedPath() {
    var p = window.location.pathname;
    if (/\/positivepay\/track-[1-5]\/(lesson-[1-6]\/?|exceptions\/?)?$/i.test(p)) return true; // any track/lesson page
    if (/\/positivepay\/start\/?$/.test(p))        return true;
    if (/\/positivepay\/thank-you\/?$/.test(p))    return true;
    if (/\/positivepay\/certificate\/?$/.test(p))  return true;
    if (/\/positivepay\/terms\/?$/.test(p))        return true;
    return false;
  }

  function alreadyEnrolled() {
    try { return !!localStorage.getItem(ENROLLED_KEY); } catch (e) { return false; }
  }

  function recentlyDismissed() {
    try {
      var v = localStorage.getItem(DISMISSED_KEY);
      if (!v) return false;
      var ts = parseInt(v, 10);
      if (!ts) return false;
      return (Date.now() - ts) < DISMISS_SUPPRESS_MS;
    } catch (e) { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch (e) {}
  }

  function trackEvent(action) {
    try {
      var email = '';
      try { email = localStorage.getItem(ENROLLED_KEY) || ''; } catch (e) {}
      if (window.fetch) {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: action,
            page: window.location.pathname,
            email: email
          }),
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('afa-enroll-styles')) return;
    var css =
      '.afa-enroll-backdrop{position:fixed;inset:0;background:rgba(14,14,14,0.55);backdrop-filter:blur(4px);z-index:9998;opacity:0;transition:opacity 240ms ease}' +
      '.afa-enroll-backdrop.show{opacity:1}' +
      '.afa-enroll-modal{position:fixed;left:50%;top:50%;transform:translate(-50%,-46%);width:calc(100% - 32px);max-width:460px;background:#fff;border-radius:18px;box-shadow:0 40px 100px rgba(0,0,0,0.30),0 8px 24px rgba(0,0,0,0.12);z-index:9999;opacity:0;transition:opacity 280ms ease,transform 320ms cubic-bezier(0.16,1,0.3,1);font-family:inherit;overflow:hidden}' +
      '.afa-enroll-modal.show{opacity:1;transform:translate(-50%,-50%)}' +
      '.afa-enroll-modal__close{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;border:none;background:transparent;color:#6B6B6B;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;font-size:18px;transition:background 120ms ease,color 120ms ease;z-index:2}' +
      '.afa-enroll-modal__close:hover{background:#F4F5F7;color:#0E0E0E}' +
      '.afa-enroll-modal__close svg{width:14px;height:14px;stroke:currentColor;stroke-width:2.2;fill:none}' +
      '.afa-enroll-modal__body{padding:32px 28px 28px}' +
      '.afa-enroll-modal__eyebrow{font-size:11px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--afs-red,#C70200);margin-bottom:10px}' +
      '.afa-enroll-modal__title{font-size:26px;font-weight:800;letter-spacing:-0.02em;line-height:1.15;color:#0E0E0E;margin:0 0 10px}' +
      '.afa-enroll-modal__sub{font-size:14.5px;font-weight:500;line-height:1.5;color:#4B5563;margin:0 0 20px}' +
      '.afa-enroll-modal__list{list-style:none;padding:0;margin:0 0 22px;display:flex;flex-direction:column;gap:10px}' +
      '.afa-enroll-modal__list li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#374151;font-weight:500}' +
      '.afa-enroll-modal__list li svg{width:15px;height:15px;flex-shrink:0;margin-top:2px;color:var(--academy-green,#7BA73B);stroke:currentColor;stroke-width:2.4;fill:none}' +
      '.afa-enroll-modal__cta-row{display:flex;flex-direction:column;gap:8px}' +
      '.afa-enroll-modal__cta{display:flex;align-items:center;justify-content:center;width:100%;padding:13px 18px;background:var(--afs-red,#C70200);color:#fff;font-size:14.5px;font-weight:700;letter-spacing:0.2px;border:none;border-radius:10px;cursor:pointer;text-decoration:none;font-family:inherit;transition:background 120ms ease}' +
      '.afa-enroll-modal__cta:hover{background:#9D0200}' +
      '.afa-enroll-modal__later{background:none;border:none;color:#6B7280;font-size:13px;font-weight:600;padding:8px;cursor:pointer;font-family:inherit;text-align:center}' +
      '.afa-enroll-modal__later:hover{color:#0E0E0E}' +
      '.afa-enroll-modal__foot{font-size:11.5px;color:#9CA3AF;font-weight:500;margin-top:14px;text-align:center;letter-spacing:0.2px}' +
      '@media(max-width:520px){.afa-enroll-modal{max-width:100%;border-radius:14px}.afa-enroll-modal__title{font-size:22px}.afa-enroll-modal__body{padding:28px 22px 22px}}' +
      '@media(prefers-reduced-motion:reduce){.afa-enroll-backdrop,.afa-enroll-modal{transition:none}}';
    var style = document.createElement('style');
    style.id = 'afa-enroll-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildModalHTML() {
    return '<div class="afa-enroll-backdrop" id="afa-enroll-backdrop"></div>' +
      '<div class="afa-enroll-modal" id="afa-enroll-modal" role="dialog" aria-modal="true" aria-labelledby="afa-enroll-title">' +
        '<button class="afa-enroll-modal__close" id="afa-enroll-close" aria-label="Close">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18"/><path d="M6 18 18 6"/></svg>' +
        '</button>' +
        '<div class="afa-enroll-modal__body">' +
          '<div class="afa-enroll-modal__eyebrow">Free · For community FI treasury teams</div>' +
          '<h2 class="afa-enroll-modal__title" id="afa-enroll-title">Enroll in the Academy.</h2>' +
          '<p class="afa-enroll-modal__sub">Free, structured education for the people running Positive Pay programs at community FIs.</p>' +
          '<ul class="afa-enroll-modal__list">' +
            '<li><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 12 10 18 20 6"/></svg>Earn the <b>Modern Positive Pay Practitioner</b> certification (LinkedIn-shareable)</li>' +
            '<li><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 12 10 18 20 6"/></svg>Get the Track 1 welcome kit emailed to you, plus monthly insights tailored to your PP status</li>' +
            '<li><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 12 10 18 20 6"/></svg>Templates, scripts, and worksheets, one per lesson</li>' +
            '<li><svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 12 10 18 20 6"/></svg>Peer benchmarks at your asset tier</li>' +
          '</ul>' +
          '<div class="afa-enroll-modal__cta-row">' +
            '<a class="afa-enroll-modal__cta" href="' + ENROLL_URL + '" id="afa-enroll-cta">Enroll free →</a>' +
            '<button class="afa-enroll-modal__later" id="afa-enroll-later" type="button">Maybe later</button>' +
          '</div>' +
          '<div class="afa-enroll-modal__foot">No spam. Unsubscribe anytime.</div>' +
        '</div>' +
      '</div>';
  }

  var shown = false;
  function showModal() {
    if (shown) return;
    if (alreadyEnrolled() || recentlyDismissed()) return;
    shown = true;

    injectStyles();

    var wrap = document.createElement('div');
    wrap.innerHTML = buildModalHTML();
    var backdrop = wrap.querySelector('#afa-enroll-backdrop');
    var modal    = wrap.querySelector('#afa-enroll-modal');
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    // Trigger show transition next frame
    requestAnimationFrame(function () {
      backdrop.classList.add('show');
      modal.classList.add('show');
    });

    // Focus the CTA for keyboard users (after the transition completes)
    setTimeout(function () {
      var cta = document.getElementById('afa-enroll-cta');
      if (cta) cta.focus();
    }, 350);

    trackEvent('enroll_prompt_shown');

    function dismiss(reason) {
      markDismissed();
      trackEvent('enroll_prompt_' + reason);
      backdrop.classList.remove('show');
      modal.classList.remove('show');
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (modal.parentNode)    modal.parentNode.removeChild(modal);
      }, 320);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
      if (e.key === 'Escape') dismiss('dismissed_esc');
    }

    document.getElementById('afa-enroll-close').addEventListener('click', function () { dismiss('dismissed_x'); });
    document.getElementById('afa-enroll-later').addEventListener('click', function () { dismiss('dismissed_later'); });
    backdrop.addEventListener('click', function () { dismiss('dismissed_backdrop'); });
    document.getElementById('afa-enroll-cta').addEventListener('click', function () {
      // Mark dismissed when CTA is clicked too — if they land on /#enroll but
      // don't actually fill out the form, we don't want to pop the modal again
      // next time they navigate.
      markDismissed();
      trackEvent('enroll_prompt_clicked');
      // Remove the modal immediately (no animation). Critical for the case
      // where the user is already on the homepage — the hash change scrolls
      // the page behind the modal, so we need to clear it out of the way for
      // the scroll-to-#enroll to be visible. Letting the <a> tag's default
      // navigation continue so cross-page navigation also works.
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      if (modal.parentNode)    modal.parentNode.removeChild(modal);
      document.removeEventListener('keydown', onKey);
    });
    document.addEventListener('keydown', onKey);
  }

  function bootEnrollPrompt() {
    if (isSkippedPath())      return;
    if (alreadyEnrolled())    return;
    if (recentlyDismissed())  return;

    // Time-on-page trigger
    var t = setTimeout(showModal, ENROLL_PROMPT_TIMER_MS);

    // Scroll-depth trigger (whichever fires first wins)
    function onScroll() {
      var doc = document.documentElement;
      var scrolled = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1);
      if (scrolled >= ENROLL_PROMPT_SCROLL) {
        clearTimeout(t);
        window.removeEventListener('scroll', onScroll);
        showModal();
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootEnrollPrompt);
  } else {
    bootEnrollPrompt();
  }
})();
