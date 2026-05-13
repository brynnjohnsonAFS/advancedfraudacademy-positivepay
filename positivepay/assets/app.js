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
    // Derive a stable ID from the pathname, e.g. "track-1/lesson-2"
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
      } else {
        p[id] = 1;
        saveProgress(p);
        markDone(btn);
      }
      // Refresh the lesson list check marks on track overview pages
      updateLessonListChecks();
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

  // Update check circles on lesson-list items (track overview page)
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

  /* ── Boot ── */
  function boot() {
    initCompleteButton();
    initQuizzes();
    updateLessonListChecks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
