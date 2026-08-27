(function () {
  'use strict';

  window.app = {};

  /* ---------- State ---------- */
  app.state = {
    level: 'beginner',
    section: null,
    data: null,
    index: 0,
    answers: {},
    timerEnabled: true,
    timerMinutes: 5,
    timerRemaining: 0,
    timerHandle: null,
    pqTimerEnabled: false,
    pqTimerSeconds: 30,
    pqTimerRemaining: 0,
    pqTimerHandle: null,
    selectedTileValue: null,
    pqLocked: false,
    quizVariant: null,
    score: 0,
    passed: false,
  };

  /* ---------- Elements ---------- */
  app.el = {
    themeToggle: document.getElementById('themeToggle'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    cancelSettings: document.getElementById('cancelSettings'),
    saveSettings: document.getElementById('saveSettings'),
    resetSettings: document.getElementById('resetSettings'),
    timerEnabled: document.getElementById('timerEnabled'),
    timerMinutes: document.getElementById('timerMinutes'),
    timerMinutesValue: document.getElementById('timerMinutesValue'),
    timerDisplay: document.getElementById('timerDisplay'),
    timer: document.getElementById('timer'),

    pqTimerDisplay: document.getElementById('pqTimerDisplay'),
    pqTimer: document.getElementById('pqTimer'),
    pqTimerEnabledCheckbox: document.getElementById('pqTimerEnabled'),
    pqTimerSecondsInput: document.getElementById('pqTimerSeconds'),

    tutorialScreen: document.getElementById('tutorialScreen'),
    startPracticing: document.getElementById('startPracticing'),
    helpBtn: document.getElementById('helpBtn'),

    sectionSelection: document.getElementById('sectionSelection'),
    learnScreen: document.getElementById('learnScreen'),
    quizContainer: document.getElementById('quizContainer'),
    resultsContainer: document.getElementById('resultsContainer'),

    sectionCards: document.querySelectorAll('.section-card'),
    learnBtns: document.querySelectorAll('.learn-btn'),
    quizBtns: document.querySelectorAll('.quiz-btn'),

    learnTitle: document.getElementById('learnTitle'),
    learnProgress: document.getElementById('learnProgress'),
    learnSlideTitle: document.getElementById('learnSlideTitle'),
    learnSlideContent: document.getElementById('learnSlideContent'),
    learnSlideExample: document.getElementById('learnSlideExample'),
    learnSlideOutput: document.getElementById('learnSlideOutput'),
    learnPrevBtn: document.getElementById('learnPrevBtn'),
    learnNextBtn: document.getElementById('learnNextBtn'),
    learnSkipBtn: document.getElementById('learnSkipBtn'),

    exerciseContainer: document.getElementById('exerciseContainer'),
    exercisePrompt: document.getElementById('exercisePrompt'),
    exerciseArea: document.getElementById('exerciseArea'),
    exerciseCheckBtn: document.getElementById('exerciseCheckBtn'),
    exerciseFeedback: document.getElementById('exerciseFeedback'),

    progressBar: document.getElementById('progressBar'),
    progressLabel: document.getElementById('progressLabel'),
    questionContainer: document.getElementById('questionContainer'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
  };

  /* ---------- Helpers ---------- */
  app.escapeHtml = function (text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  app.shuffleArray = function (arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  };

  /* ---------- Init ---------- */
  app.init = function () {
    if (app.initTheme) app.initTheme();
    if (app.initSettings) app.initSettings();
    if (app.initTutorial) app.initTutorial();

    app.el.learnBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const section = btn.getAttribute('data-section');
        const card = btn.closest('.section-card');
        const level = card ? card.getAttribute('data-level') : 'beginner';
        app.startLearn(section, level);
      });
    });

    app.el.quizBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const section = btn.getAttribute('data-section');
        const card = btn.closest('.section-card');
        const level = card ? card.getAttribute('data-level') : 'beginner';
        app.startQuiz(section, level);
      });
    });

    app.el.prevBtn.addEventListener('click', function () {
      if (app.state.index > 0) {
        app.state.index--;
        app.state.pqLocked = false;
        app.renderQuestion();
        app.resetPqTimer();
      }
    });

    app.el.nextBtn.addEventListener('click', function () {
      const total = app.state.data.questions.length;
      if (app.state.index < total - 1) {
        app.state.index++;
        app.state.pqLocked = false;
        app.renderQuestion();
        app.resetPqTimer();
      } else {
        app.stopPqTimer();
        app.stopTimer();
        app.showResults();
      }
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
          console.warn('ServiceWorker registration failed:', err);
        });
      });
    }

    app.fallbackIcons();
  };

  app.fallbackIcons = function () {
    setTimeout(function () {
      var test = document.createElement('i');
      test.className = 'fa-solid fa-circle-question menu-icon';
      test.style.display = 'none';
      document.body.appendChild(test);
      var fontFamily = getComputedStyle(test).fontFamily;
      document.body.removeChild(test);
      var faLoaded = fontFamily.indexOf('Font Awesome') !== -1;
      if (!faLoaded) {
        document.querySelectorAll('.icon-btn i, .btn-close i').forEach(function (icon) {
          var emoji = icon.getAttribute('data-emoji');
          if (emoji) {
            icon.replaceWith(document.createTextNode(emoji));
          }
        });
      }
    }, 500);
  };

  app.init();
})();
