(function () {
  'use strict';

  app.initTheme = function () {
    const saved = localStorage.getItem('quizTheme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    app.applyTheme(theme);
  };

  app.applyTheme = function (theme) {
    document.documentElement.setAttribute('data-theme', theme);
    app.el.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('quizTheme', theme);
  };

  app.el.themeToggle.addEventListener('click', function () {
    const current = document.documentElement.getAttribute('data-theme');
    app.applyTheme(current === 'dark' ? 'light' : 'dark');
    if (app.state.data && !app.el.quizContainer.classList.contains('hidden')) {
      app.renderQuestion();
      app.resetPqTimer();
    }
    if (app.state.data && !app.el.resultsContainer.classList.contains('hidden')) {
      app.showResults();
    }
  });

  app.initSettings = function () {
    const savedMinutes = parseInt(localStorage.getItem('quizTimerMinutes'), 10);
    const savedEnabled = localStorage.getItem('quizTimerEnabled');
    app.state.timerMinutes = Math.min(20, Math.max(0, Number.isFinite(savedMinutes) ? savedMinutes : 5));
    app.state.timerEnabled = savedEnabled === null ? true : savedEnabled === 'true';
    app.el.timerMinutes.value = app.state.timerMinutes;
    app.el.timerMinutesValue.textContent = app.state.timerMinutes + ' min';
    app.el.timerEnabled.checked = app.state.timerEnabled;

    const savedPqEnabled = localStorage.getItem('quizPqTimerEnabled');
    const savedPqSeconds = parseInt(localStorage.getItem('quizPqTimerSeconds'), 10);
    app.state.pqTimerEnabled = savedPqEnabled === null ? false : savedPqEnabled === 'true';
    app.state.pqTimerSeconds = Number.isFinite(savedPqSeconds) && savedPqSeconds > 0 ? savedPqSeconds : 30;
    app.el.pqTimerEnabledCheckbox.checked = app.state.pqTimerEnabled;
    app.el.pqTimerSecondsInput.value = app.state.pqTimerSeconds;
  };

  app.el.timerMinutes.addEventListener('input', function () {
    app.el.timerMinutesValue.textContent = app.el.timerMinutes.value + ' min';
  });

  app.openSettings = function () { app.el.settingsModal.classList.remove('hidden'); };
  app.closeSettings = function () { app.el.settingsModal.classList.add('hidden'); };

  app.el.settingsBtn.addEventListener('click', app.openSettings);
  app.el.closeSettings.addEventListener('click', app.closeSettings);
  app.el.cancelSettings.addEventListener('click', app.closeSettings);
  app.el.settingsModal.addEventListener('click', function (e) {
    if (e.target === app.el.settingsModal) app.closeSettings();
  });

  app.el.saveSettings.addEventListener('click', function () {
    const minutes = Math.min(20, Math.max(0, parseInt(app.el.timerMinutes.value, 10) || 5));
    app.state.timerMinutes = minutes;
    app.state.timerEnabled = app.el.timerEnabled.checked;
    app.el.timerMinutesValue.textContent = minutes + ' min';
    localStorage.setItem('quizTimerMinutes', String(minutes));
    localStorage.setItem('quizTimerEnabled', String(app.state.timerEnabled));

    const secs = Math.min(300, Math.max(10, parseInt(app.el.pqTimerSecondsInput.value, 10) || 30));
    app.state.pqTimerSeconds = secs;
    app.state.pqTimerEnabled = app.el.pqTimerEnabledCheckbox.checked;
    localStorage.setItem('quizPqTimerSeconds', String(secs));
    localStorage.setItem('quizPqTimerEnabled', String(app.state.pqTimerEnabled));

    app.closeSettings();
  });

  if (app.el.resetSettings) {
    app.el.resetSettings.addEventListener('click', function () {
      document.getElementById('resetConfirmModal').classList.remove('hidden');
    });
  }

  document.getElementById('confirmReset').addEventListener('click', function () {
    localStorage.removeItem('quizResults');
    localStorage.removeItem('quizTimerMinutes');
    localStorage.removeItem('quizTimerEnabled');
    localStorage.removeItem('quizPqTimerSeconds');
    localStorage.removeItem('quizPqTimerEnabled');
    localStorage.removeItem('quizTheme');
    localStorage.removeItem('quizTutorialSeen');
    document.getElementById('resetConfirmModal').classList.add('hidden');
    app.closeSettings();
    location.reload();
  });

  document.getElementById('cancelReset').addEventListener('click', function () {
    document.getElementById('resetConfirmModal').classList.add('hidden');
  });

  document.getElementById('closeResetConfirm').addEventListener('click', function () {
    document.getElementById('resetConfirmModal').classList.add('hidden');
  });

  document.getElementById('resetConfirmModal').addEventListener('click', function (e) {
    if (e.target === document.getElementById('resetConfirmModal')) {
      document.getElementById('resetConfirmModal').classList.add('hidden');
    }
  });

  app.initTutorial = function () {
    const seen = localStorage.getItem('quizTutorialSeen') === 'true';
    if (seen) {
      app.el.tutorialScreen.classList.add('hidden');
      app.el.sectionSelection.classList.remove('hidden');
    } else {
      app.el.tutorialScreen.classList.remove('hidden');
      app.el.sectionSelection.classList.add('hidden');
    }
  };

  app.el.startPracticing.addEventListener('click', function () {
    localStorage.setItem('quizTutorialSeen', 'true');
    app.el.tutorialScreen.classList.add('hidden');
    app.el.sectionSelection.classList.remove('hidden');
  });

  app.el.helpBtn.addEventListener('click', function () {
    app.el.quizContainer.classList.add('hidden');
    app.el.resultsContainer.classList.add('hidden');
    app.el.sectionSelection.classList.add('hidden');
    app.el.timerDisplay.classList.add('hidden');
    app.el.pqTimerDisplay.classList.add('hidden');
    app.stopTimer();
    app.stopPqTimer();
    app.state.pqLocked = false;
    app.el.tutorialScreen.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  app.startTimer = function () {
    app.stopTimer();
    if (!app.state.timerEnabled) {
      app.el.timerDisplay.classList.add('hidden');
      return;
    }
    app.state.timerRemaining = app.state.timerMinutes * 60;
    app.el.timerDisplay.classList.remove('hidden');
    app.renderTimer();
    app.state.timerHandle = setInterval(function () {
      app.state.timerRemaining--;
      app.renderTimer();
      if (app.state.timerRemaining <= 0) {
        app.stopTimer();
        app.showResults();
      }
    }, 1000);
  };

  app.stopTimer = function () {
    if (app.state.timerHandle) {
      clearInterval(app.state.timerHandle);
      app.state.timerHandle = null;
    }
  };

  app.renderTimer = function () {
    const m = Math.floor(app.state.timerRemaining / 60);
    const s = app.state.timerRemaining % 60;
    app.el.timer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    app.el.timer.classList.toggle('low', app.state.timerRemaining <= 30);
  };

  app.startPqTimer = function () {
    app.stopPqTimer();
    if (!app.state.pqTimerEnabled || app.state.pqLocked) {
      app.el.pqTimerDisplay.classList.add('hidden');
      return;
    }
    app.state.pqTimerRemaining = app.state.pqTimerSeconds;
    app.el.pqTimerDisplay.classList.remove('hidden');
    app.renderPqTimer();
    app.state.pqTimerHandle = setInterval(function () {
      app.state.pqTimerRemaining--;
      app.renderPqTimer();
      if (app.state.pqTimerRemaining <= 0) {
        app.stopPqTimer();
        app.lockCurrentQuestion();
      }
    }, 1000);
  };

  app.stopPqTimer = function () {
    if (app.state.pqTimerHandle) {
      clearInterval(app.state.pqTimerHandle);
      app.state.pqTimerHandle = null;
    }
  };

  app.renderPqTimer = function () {
    const s = app.state.pqTimerRemaining % 60;
    app.el.pqTimer.textContent = '0:' + String(s).padStart(2, '0');
    app.el.pqTimer.classList.toggle('low', app.state.pqTimerRemaining <= 10);
  };

  app.resetPqTimer = function () {
    app.stopPqTimer();
    if (app.state.pqTimerEnabled) {
      app.startPqTimer();
    } else {
      app.el.pqTimerDisplay.classList.add('hidden');
    }
  };

  app.lockCurrentQuestion = function () {
    const q = app.state.data.questions[app.state.index];
    if (q.type === 'pyramid') {
      const userAnswers = app.state.answers[q.id] || [];
      if (!app.checkPyramidAnswer(q, userAnswers)) {
        app.state.pqLocked = true;
        app.renderQuestion();
      } else {
        app.el.pqTimerDisplay.classList.add('hidden');
      }
    } else {
      app.el.pqTimerDisplay.classList.add('hidden');
    }
  };

  app.initTheme();
  app.initSettings();
  app.initTutorial();
})();
