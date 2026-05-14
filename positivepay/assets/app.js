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
        // Fire Pardot activity for lesson completion
        try {
          if (typeof piTracker === 'function') {
            piTracker(window.location.origin + '/positivepay/completed/' + id + '/');
          }
        } catch (e) {}
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
    document.querySelectorAll('.quiz-question').forEach(function (question) {
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

  /* ── Boot ── */
  function boot() {
    initCompleteButton();
    initQuizzes();
    updateLessonListChecks();
    checkAndShowTrackComplete();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
