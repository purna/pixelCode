(function () {
  'use strict';

  /* ---------- State ---------- */
  const state = {
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
  const el = {
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
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = a[i];
      a[i] = a[j];
      a[j] = temp;
    }
    return a;
  }

  function getResults() {
    try {
      return JSON.parse(localStorage.getItem('quizResults')) || {};
    } catch (e) {
      return {};
    }
  }

  function saveQuizResult(section, level, variant, pct, correct, total) {
    const results = getResults();
    const key = section + '|' + level;
    if (!results[key]) {
      results[key] = { attempts: 0, bestPct: 0, passed: false, lastVariant: null, history: [] };
    }
    results[key].attempts++;
    results[key].bestPct = Math.max(results[key].bestPct, pct);
    results[key].passed = results[key].bestPct >= 80;
    results[key].lastVariant = variant;
    results[key].history.push({ variant: variant, pct: pct, correct: correct, total: total, date: new Date().toISOString() });
    localStorage.setItem('quizResults', JSON.stringify(results));
  }

  function getSectionStatus(section, level) {
    const results = getResults();
    const key = section + '|' + level;
    return results[key] || null;
  }

  function getLearnProgress(section, level) {
    try {
      const all = JSON.parse(localStorage.getItem('learnProgress')) || {};
      return all[section + '|' + level] || null;
    } catch (e) {
      return null;
    }
  }
  function saveLearnProgress(section, level, idx, completed, total) {
    try {
      const all = JSON.parse(localStorage.getItem('learnProgress')) || {};
      const key = section + '|' + level;
      const prev = all[key] || {};
      prev.lastSlide = idx;
      prev.total = total || (prev.total || 0);
      if (completed) prev.completed = true;
      prev.lastUpdated = Date.now();
      all[key] = prev;
      localStorage.setItem('learnProgress', JSON.stringify(all));
    } catch (e) {}
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem('quizTheme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    el.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('quizTheme', theme);
  }
  el.themeToggle.addEventListener('click', function () {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
    // Canvas pixels don't follow CSS variables automatically — redraw the
    // current question if a visual (canvas-based) question is on screen.
    if (state.data && !el.quizContainer.classList.contains('hidden')) {
      renderQuestion();
      resetPqTimer();
    }
    if (state.data && !el.resultsContainer.classList.contains('hidden')) {
      showResults();
    }
  });

   /* ---------- Settings ---------- */
   function initSettings() {
     const savedMinutes = parseInt(localStorage.getItem('quizTimerMinutes'), 10);
     const savedEnabled = localStorage.getItem('quizTimerEnabled');
     state.timerMinutes = Math.min(20, Math.max(0, Number.isFinite(savedMinutes) ? savedMinutes : 5));
     state.timerEnabled = savedEnabled === null ? true : savedEnabled === 'true';
     el.timerMinutes.value = state.timerMinutes;
     el.timerMinutesValue.textContent = state.timerMinutes + ' min';
     el.timerEnabled.checked = state.timerEnabled;

     const savedPqEnabled = localStorage.getItem('quizPqTimerEnabled');
     const savedPqSeconds = parseInt(localStorage.getItem('quizPqTimerSeconds'), 10);
     state.pqTimerEnabled = savedPqEnabled === null ? false : savedPqEnabled === 'true';
     state.pqTimerSeconds = Number.isFinite(savedPqSeconds) && savedPqSeconds > 0 ? savedPqSeconds : 30;
     el.pqTimerEnabledCheckbox.checked = state.pqTimerEnabled;
     el.pqTimerSecondsInput.value = state.pqTimerSeconds;
    }
   el.timerMinutes.addEventListener('input', function () {
     el.timerMinutesValue.textContent = el.timerMinutes.value + ' min';
   });
   function openSettings() { el.settingsModal.classList.remove('hidden'); }
  function closeSettings() { el.settingsModal.classList.add('hidden'); }

  el.settingsBtn.addEventListener('click', openSettings);
  el.closeSettings.addEventListener('click', closeSettings);
  el.cancelSettings.addEventListener('click', closeSettings);
  el.settingsModal.addEventListener('click', function (e) {
    if (e.target === el.settingsModal) closeSettings();
  });
   el.saveSettings.addEventListener('click', function () {
     const minutes = Math.min(20, Math.max(0, parseInt(el.timerMinutes.value, 10) || 5));
     state.timerMinutes = minutes;
     state.timerEnabled = el.timerEnabled.checked;
     el.timerMinutesValue.textContent = minutes + ' min';
     localStorage.setItem('quizTimerMinutes', String(minutes));
     localStorage.setItem('quizTimerEnabled', String(state.timerEnabled));

     const secs = Math.min(300, Math.max(10, parseInt(el.pqTimerSecondsInput.value, 10) || 30));
     state.pqTimerSeconds = secs;
     state.pqTimerEnabled = el.pqTimerEnabledCheckbox.checked;
     localStorage.setItem('quizPqTimerSeconds', String(secs));
     localStorage.setItem('quizPqTimerEnabled', String(state.pqTimerEnabled));

     closeSettings();
   });

   if (el.resetSettings) {
     el.resetSettings.addEventListener('click', function () {
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
     closeSettings();
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

   /* ---------- Tutorial ---------- */
  function initTutorial() {
    const seen = localStorage.getItem('quizTutorialSeen') === 'true';
    if (seen) {
      el.tutorialScreen.classList.add('hidden');
      el.sectionSelection.classList.remove('hidden');
    } else {
      el.tutorialScreen.classList.remove('hidden');
      el.sectionSelection.classList.add('hidden');
    }
  }
  el.startPracticing.addEventListener('click', function () {
    localStorage.setItem('quizTutorialSeen', 'true');
    el.tutorialScreen.classList.add('hidden');
    el.sectionSelection.classList.remove('hidden');
  });
   el.helpBtn.addEventListener('click', function () {
     el.quizContainer.classList.add('hidden');
     el.resultsContainer.classList.add('hidden');
     el.sectionSelection.classList.add('hidden');
     el.timerDisplay.classList.add('hidden');
     el.pqTimerDisplay.classList.add('hidden');
     stopTimer();
     stopPqTimer();
     state.pqLocked = false;
     el.tutorialScreen.classList.remove('hidden');
     window.scrollTo({ top: 0, behavior: 'smooth' });
   });

   /* ---------- Section selection -> start quiz ---------- */
   el.learnBtns.forEach(function (btn) {
     btn.addEventListener('click', function (e) {
       e.stopPropagation();
       const section = btn.getAttribute('data-section');
       const card = btn.closest('.section-card');
       const level = card ? card.getAttribute('data-level') : 'beginner';
       startLearn(section, level);
     });
   });

   el.quizBtns.forEach(function (btn) {
     btn.addEventListener('click', function (e) {
       e.stopPropagation();
       const section = btn.getAttribute('data-section');
       const card = btn.closest('.section-card');
       const level = card ? card.getAttribute('data-level') : 'beginner';
       startQuiz(section, level);
     });
   });

  function startLearn(section, level) {
    state.level = level;
    const path = 'data/' + section + '-learn.json';
    fetch(path)
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load ' + path);
        return res.json();
      })
      .then(function (json) {
        state.learnData = json;
        const saved = getLearnProgress(section, level);
        state.learnIndex = (saved && saved.lastSlide !== undefined) ? saved.lastSlide : 0;
        state.section = section;
        el.sectionSelection.classList.add('hidden');
        el.resultsContainer.classList.add('hidden');
        el.quizContainer.classList.add('hidden');
        el.learnScreen.classList.remove('hidden');
        renderLearnSlide();
      })
      .catch(function (err) {
        console.error(err);
        alert('Sorry, learning content could not be loaded. (' + err.message + ')');
      });
  }

  function renderLearnSlide() {
    const data = state.learnData;
    if (!data) return;
    const slide = data.slides[state.learnIndex];
    if (!slide) {
      el.learnScreen.classList.add('hidden');
      el.sectionSelection.classList.remove('hidden');
      return;
    }

    el.learnTitle.textContent = data.title || 'Learn';
    el.learnProgress.textContent = 'Slide ' + (state.learnIndex + 1) + ' of ' + data.slides.length;
    el.learnSlideTitle.textContent = slide.title || '';
    el.learnSlideContent.textContent = slide.content || '';

    if (slide.example) {
      el.learnSlideExample.textContent = slide.example;
      el.learnSlideExample.classList.remove('hidden');
    } else {
      el.learnSlideExample.classList.add('hidden');
    }

    if (slide.exampleOutput) {
      el.learnSlideOutput.textContent = 'Output: ' + slide.exampleOutput;
      el.learnSlideOutput.classList.remove('hidden');
    } else {
      el.learnSlideOutput.classList.add('hidden');
    }

    if (slide.exercise) {
      el.exerciseContainer.classList.remove('hidden');
      el.exercisePrompt.textContent = slide.exercise.prompt || '';
      el.exerciseFeedback.textContent = '';
      el.exerciseFeedback.className = 'exercise-feedback';
      el.exerciseCheckBtn.classList.remove('hidden');
      renderLearnExercise(slide.exercise);
    } else {
      el.exerciseContainer.classList.add('hidden');
      el.exerciseArea.innerHTML = '';
    }

    if (slide.execution) {
      el.exerciseContainer.classList.remove('hidden');
      renderExecutionPlayer(slide.execution);
    }

    if (slide.flow) {
      el.exerciseContainer.classList.remove('hidden');
      renderFlowDiagram(slide.flow);
    }

    el.learnPrevBtn.disabled = state.learnIndex === 0;
    el.learnNextBtn.textContent = state.learnIndex === data.slides.length - 1 ? 'Start Quiz' : 'Next';

    saveLearnProgress(state.section, state.level, state.learnIndex, state.learnIndex === data.slides.length - 1, data.slides.length);
  }

  function renderLearnExercise(exercise) {
    el.exerciseArea.innerHTML = '';
    if (exercise.type === 'flowbuilder') {
      renderFlowBuilderExercise(exercise);
    } else if (exercise.type === 'dragdrop') {
      renderLearnDragDrop(exercise);
    } else if (exercise.type === 'multiplechoice') {
      renderLearnMultipleChoice(exercise);
    } else if (exercise.type === 'fillblank') {
      renderLearnFillBlank(exercise);
    } else if (exercise.type === 'code') {
      renderLearnCode(exercise);
    }
  }

  function renderLearnMultipleChoice(exercise) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-multiplechoice';

    const options = document.createElement('div');
    options.className = 'exercise-options';
    options.style.display = 'flex';
    options.style.flexDirection = 'column';
    options.style.gap = '0.5rem';

    const shuffled = exercise.options.slice().sort(function () { return Math.random() - 0.5; });
    shuffled.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.className = 'exercise-option';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        options.querySelectorAll('.exercise-option').forEach(function (b) { b.classList.remove('selected', 'correct', 'wrong'); });
        if (opt === exercise.answer) {
          btn.classList.add('correct');
          el.exerciseFeedback.textContent = 'Correct! Well done!';
          el.exerciseFeedback.className = 'exercise-feedback correct';
          el.exerciseCheckBtn.classList.add('hidden');
        } else {
          btn.classList.add('wrong');
          el.exerciseFeedback.textContent = 'Not quite. Try again!';
          el.exerciseFeedback.className = 'exercise-feedback wrong';
        }
      });
      options.appendChild(btn);
    });
    wrap.appendChild(options);
    el.exerciseArea.appendChild(wrap);
  }

  function renderLearnFillBlank(exercise) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-fillblank';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'exercise-option';
    input.placeholder = exercise.placeholder || 'Type your answer...';
    input.style.display = 'block';
    input.style.width = '100%';
    input.style.maxWidth = '320px';
    input.style.marginBottom = '0.75rem';

    el.exerciseCheckBtn.onclick = function () {
      const userAnswer = input.value.trim();
      const correctAnswer = exercise.answer || '';
      const isCorrect = exercise.caseSensitive ? userAnswer === correctAnswer : userAnswer.toLowerCase() === correctAnswer.toLowerCase();

      if (!userAnswer) {
        el.exerciseFeedback.textContent = 'Please enter an answer.';
        el.exerciseFeedback.className = 'exercise-feedback wrong';
        return;
      }

      if (isCorrect) {
        input.style.borderColor = 'var(--good)';
        input.style.background = 'var(--good-soft)';
        const praises = ['Correct! Well done!', 'You got it!', 'Excellent!', 'Spot on!', 'Brilliant!'];
        el.exerciseFeedback.textContent = praises[Math.floor(Math.random() * praises.length)];
        el.exerciseFeedback.className = 'exercise-feedback correct';
        el.exerciseCheckBtn.classList.add('hidden');
      } else {
        input.style.borderColor = 'var(--bad)';
        input.style.background = 'var(--bad-soft)';
        el.exerciseFeedback.textContent = 'Not quite. Try again!';
        el.exerciseFeedback.className = 'exercise-feedback wrong';
      }
    };

    wrap.appendChild(input);
    el.exerciseArea.appendChild(wrap);
    input.focus();
  }

  function renderLearnDragDrop(exercise) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-dragdrop';

    const codeLine = document.createElement('div');
    codeLine.className = 'exercise-code-line';
    codeLine.style.fontFamily = 'var(--font-mono)';
    codeLine.style.background = 'var(--bg)';
    codeLine.style.padding = '0.75rem';
    codeLine.style.borderRadius = '8px';
    codeLine.style.marginBottom = '0.75rem';
    codeLine.style.whiteSpace = 'pre-wrap';
    codeLine.style.border = '1px solid var(--border)';

    const before = exercise.before || '';
    const after = exercise.after || '';
    const blank = document.createElement('span');
    blank.className = 'exercise-blank';
    blank.style.display = 'inline-block';
    blank.style.minWidth = '80px';
    blank.style.minHeight = '1.5em';
    blank.style.border = '2px dashed var(--accent)';
    blank.style.borderRadius = '4px';
    blank.style.padding = '0.1rem 0.4rem';
    blank.style.margin = '0 0.2rem';
    blank.style.verticalAlign = 'middle';
    blank.style.background = 'var(--surface)';
    blank.textContent = '_____';

    codeLine.appendChild(document.createTextNode(before));
    codeLine.appendChild(blank);
    codeLine.appendChild(document.createTextNode(after));
    wrap.appendChild(codeLine);

    const options = document.createElement('div');
    options.className = 'exercise-options';
    options.style.display = 'flex';
    options.style.flexWrap = 'wrap';
    options.style.gap = '0.5rem';
    options.style.marginBottom = '0.75rem';

    const shuffled = exercise.options.slice().sort(function () { return Math.random() - 0.5; });
    shuffled.forEach(function (opt) {
      const btn = document.createElement('button');
      btn.className = 'exercise-option';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        blank.textContent = opt;
        blank.dataset.selected = opt;
        options.querySelectorAll('.exercise-option').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
      options.appendChild(btn);
    });
    wrap.appendChild(options);

    el.exerciseCheckBtn.onclick = function () {
      const selected = blank.dataset.selected;
      if (!selected) {
        el.exerciseFeedback.textContent = 'Please select an option.';
        el.exerciseFeedback.className = 'exercise-feedback wrong';
        return;
      }
      if (selected === exercise.answer) {
        const praises = ['Correct! Well done!', 'You got it!', 'Excellent!', 'Spot on!', 'Brilliant!'];
        el.exerciseFeedback.textContent = praises[Math.floor(Math.random() * praises.length)];
        el.exerciseFeedback.className = 'exercise-feedback correct';
        el.exerciseCheckBtn.classList.add('hidden');
      } else {
        el.exerciseFeedback.textContent = 'Not quite. Try again!';
        el.exerciseFeedback.className = 'exercise-feedback wrong';
      }
    };

    el.exerciseArea.appendChild(wrap);
  }

  function renderLearnCode(exercise) {
    const wrap = document.createElement('div');
    wrap.className = 'exercise-code';

    const editor = document.createElement('textarea');
    editor.className = 'exercise-editor';
    editor.value = exercise.starterCode || '';
    editor.style.width = '100%';
    editor.style.minHeight = '120px';
    editor.style.padding = '0.75rem';
    editor.style.border = '1px solid var(--border)';
    editor.style.borderRadius = '8px';
    editor.style.background = 'var(--bg)';
    editor.style.color = 'var(--ink)';
    editor.style.fontFamily = 'var(--font-mono)';
    editor.style.fontSize = '0.85rem';
    editor.style.lineHeight = '1.5';
    editor.style.resize = 'vertical';
    wrap.appendChild(editor);

    const output = document.createElement('pre');
    output.className = 'exercise-output';
    output.textContent = 'Output will appear here...';
    output.style.background = 'var(--surface)';
    output.style.border = '1px solid var(--border)';
    output.style.borderRadius = '8px';
    output.style.padding = '0.75rem';
    output.style.minHeight = '2.5rem';
    output.style.fontFamily = 'var(--font-mono)';
    output.style.fontSize = '0.85rem';
    output.style.marginTop = '0.5rem';
    output.style.whiteSpace = 'pre-wrap';
    wrap.appendChild(output);

    el.exerciseCheckBtn.textContent = 'Run Code';
    el.exerciseCheckBtn.onclick = function () {
      const code = editor.value;
      const result = simulateCSharp(code, exercise);
      output.textContent = result.output;
      output.style.color = result.ok ? 'var(--good)' : 'var(--bad)';
      output.style.borderColor = result.ok ? 'var(--good)' : 'var(--bad)';

      if (result.ok) {
        const praises = ['Correct! Well done!', 'You got it!', 'Excellent!', 'Spot on!', 'Brilliant!'];
        el.exerciseFeedback.textContent = praises[Math.floor(Math.random() * praises.length)];
        el.exerciseFeedback.className = 'exercise-feedback correct';
      } else {
        el.exerciseFeedback.textContent = 'Not quite. Try again!';
        el.exerciseFeedback.className = 'exercise-feedback wrong';
      }
    };

    const hints = exercise.hints || [];
    if (hints.length > 0) {
      const hintBtn = document.createElement('button');
      hintBtn.className = 'btn btn-secondary';
      hintBtn.style.marginTop = '0.5rem';
      hintBtn.style.fontSize = '0.8rem';
      hintBtn.textContent = 'Show Hint';
      let shown = 0;
      hintBtn.addEventListener('click', function () {
        if (shown < hints.length) {
          const hintEl = document.createElement('p');
          hintEl.className = 'exercise-hint';
          hintEl.style.fontSize = '0.85rem';
          hintEl.style.color = 'var(--accent)';
          hintEl.style.margin = '0.35rem 0 0';
          hintEl.style.fontStyle = 'italic';
          hintEl.textContent = 'Hint ' + (shown + 1) + ': ' + hints[shown];
          output.parentNode.insertBefore(hintEl, output.nextSibling);
          shown++;
          if (shown >= hints.length) {
            hintBtn.disabled = true;
            hintBtn.textContent = 'Hints';
          } else {
            hintBtn.textContent = 'Show next hint';
          }
        }
      });
      wrap.appendChild(hintBtn);
    }

    el.exerciseArea.appendChild(wrap);
  }

  function renderExecutionPlayer(execution) {
    const wrap = document.createElement('div');
    wrap.className = 'execution-player';

    const codeLines = (execution.code || '').split('\n');
    const steps = execution.steps || [];

    const codeBlock = document.createElement('div');
    codeBlock.className = 'execution-code';
    codeBlock.style.fontFamily = 'var(--font-mono)';
    codeBlock.style.background = 'var(--bg)';
    codeBlock.style.padding = '0.75rem';
    codeBlock.style.borderRadius = '8px';
    codeBlock.style.border = '1px solid var(--border)';
    codeBlock.style.marginBottom = '0.75rem';
    codeBlock.style.position = 'relative';

    codeLines.forEach(function (line, i) {
      const lineEl = document.createElement('div');
      lineEl.className = 'execution-line';
      lineEl.style.padding = '0.15rem 0.5rem';
      lineEl.style.borderRadius = '4px';
      lineEl.style.display = 'flex';
      lineEl.style.gap = '0.5rem';
      lineEl.dataset.lineIndex = String(i);

      const lineNum = document.createElement('span');
      lineNum.style.color = 'var(--ink-soft)';
      lineNum.style.userSelect = 'none';
      lineNum.style.minWidth = '1.5rem';
      lineNum.style.textAlign = 'right';
      lineNum.textContent = String(i + 1);

      const lineText = document.createElement('span');
      lineText.textContent = line || ' ';
      lineText.style.flex = '1';

      lineEl.appendChild(lineNum);
      lineEl.appendChild(lineText);
      codeBlock.appendChild(lineEl);
    });

    wrap.appendChild(codeBlock);

    const controls = document.createElement('div');
    controls.className = 'execution-controls';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.style.gap = '0.5rem';
    controls.style.marginBottom = '0.75rem';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-secondary';
    playBtn.textContent = '▶ Play';
    playBtn.style.padding = '0.4rem 0.8rem';
    playBtn.style.fontSize = '0.8rem';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = '↺ Reset';
    resetBtn.style.padding = '0.4rem 0.8rem';
    resetBtn.style.fontSize = '0.8rem';

    const stepLabel = document.createElement('span');
    stepLabel.style.fontFamily = 'var(--font-mono)';
    stepLabel.style.fontSize = '0.8rem';
    stepLabel.style.color = 'var(--ink-soft)';
    stepLabel.textContent = 'Step 0 / ' + steps.length;

    controls.appendChild(playBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(stepLabel);
    wrap.appendChild(controls);

    const varViewer = document.createElement('div');
    varViewer.className = 'variable-viewer';
    varViewer.style.background = 'var(--surface)';
    varViewer.style.border = '1px solid var(--border)';
    varViewer.style.borderRadius = '8px';
    varViewer.style.padding = '0.75rem';
    varViewer.style.marginBottom = '0.75rem';

    const varTitle = document.createElement('strong');
    varTitle.textContent = 'Variables';
    varTitle.style.display = 'block';
    varTitle.style.marginBottom = '0.4rem';
    varTitle.style.fontSize = '0.85rem';
    varViewer.appendChild(varTitle);

    const varContent = document.createElement('div');
    varContent.className = 'variable-content';
    varViewer.appendChild(varContent);

    wrap.appendChild(varViewer);

    const descEl = document.createElement('p');
    descEl.className = 'execution-description';
    descEl.style.fontSize = '0.85rem';
    descEl.style.color = 'var(--ink-soft)';
    descEl.style.margin = '0 0 0.75rem';
    wrap.appendChild(descEl);

    let currentStep = 0;
    let playing = false;
    let playHandle = null;

    function updateView() {
      const step = steps[currentStep] || {};
      const lineIndex = step.line;

      codeBlock.querySelectorAll('.execution-line').forEach(function (el, i) {
        el.style.background = i === lineIndex ? 'var(--accent-soft)' : 'transparent';
        el.style.fontWeight = i === lineIndex ? '600' : '400';
      });

      const vars = step.variables || {};
      varContent.innerHTML = '';
      if (Object.keys(vars).length === 0) {
        varContent.textContent = 'No variables yet';
      } else {
        Object.keys(vars).forEach(function (key) {
          const row = document.createElement('div');
          row.style.display = 'flex';
          row.style.justifyContent = 'space-between';
          row.style.gap = '1rem';
          row.style.padding = '0.2rem 0';
          row.style.borderBottom = '1px solid var(--border)';

          const varName = document.createElement('span');
          varName.style.fontFamily = 'var(--font-mono)';
          varName.style.fontWeight = '600';
          varName.textContent = key;

          const varValue = document.createElement('span');
          varValue.style.fontFamily = 'var(--font-mono)';
          varValue.style.color = 'var(--accent)';
          varValue.textContent = String(vars[key]);

          row.appendChild(varName);
          row.appendChild(varValue);
          varContent.appendChild(row);
        });
      }

      descEl.textContent = step.description || '';
      stepLabel.textContent = 'Step ' + currentStep + ' / ' + steps.length;
    }

    playBtn.addEventListener('click', function () {
      if (playing) {
        playing = false;
        playBtn.textContent = '▶ Play';
        if (playHandle) clearTimeout(playHandle);
      } else {
        playing = true;
        playBtn.textContent = '⏸ Pause';

        function next() {
          if (!playing) return;
          if (currentStep < steps.length - 1) {
            currentStep++;
            updateView();
            playHandle = setTimeout(next, 1200);
          } else {
            playing = false;
            playBtn.textContent = '▶ Play';
          }
        }
        playHandle = setTimeout(next, 1200);
      }
    });

    resetBtn.addEventListener('click', function () {
      playing = false;
      playBtn.textContent = '▶ Play';
      if (playHandle) clearTimeout(playHandle);
      currentStep = 0;
      updateView();
    });

    updateView();
    el.exerciseArea.appendChild(wrap);
  }

  function renderFlowBuilderExercise(exercise) {
    const wrap = document.createElement('div');
    wrap.className = 'flowbuilder-exercise';

    const container = document.createElement('div');
    container.style.height = '620px';
    wrap.appendChild(container);

    el.exerciseArea.appendChild(wrap);

    const fb = new FlowBuilder(container, {
      flow: exercise.flow || {},
      expectedCode: exercise.expectedCode || '',
      examples: exercise.examples || []
    });

    if (exercise.expectedCode) {
      const hint = document.createElement('p');
      hint.style.marginTop = '0.5rem';
      hint.style.fontSize = '0.8rem';
      hint.style.color = 'var(--ink-soft)';
      hint.textContent = 'Use the Compare tab inside the Flow Builder to check your code against the expected output.';
      wrap.appendChild(hint);
    }
  }

  function renderFlowDiagram(flow) {
    const wrap = document.createElement('div');
    wrap.className = 'flow-diagram';

    const container = document.createElement('div');
    container.className = 'flow-container';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '0';

    const nodes = flow.nodes || [];
    nodes.forEach(function (node, i) {
      const nodeEl = document.createElement('div');
      nodeEl.className = 'flow-node';
      nodeEl.style.padding = '0.5rem 1rem';
      nodeEl.style.borderRadius = '8px';
      nodeEl.style.fontFamily = 'var(--font-mono)';
      nodeEl.style.fontSize = '0.8rem';
      nodeEl.style.fontWeight = '600';
      nodeEl.style.textAlign = 'center';
      nodeEl.style.minWidth = '120px';

      if (node.type === 'start' || node.type === 'end') {
        nodeEl.style.background = 'var(--good)';
        nodeEl.style.color = '#fff';
        nodeEl.style.borderRadius = '999px';
      } else if (node.type === 'condition') {
        nodeEl.style.background = 'var(--accent-soft)';
        nodeEl.style.color = 'var(--accent)';
        nodeEl.style.border = '2px solid var(--accent)';
      } else if (node.type === 'true') {
        nodeEl.style.background = 'var(--good-soft)';
        nodeEl.style.color = 'var(--good)';
        nodeEl.style.border = '1px solid var(--good)';
      } else if (node.type === 'false') {
        nodeEl.style.background = 'var(--bad-soft)';
        nodeEl.style.color = 'var(--bad)';
        nodeEl.style.border = '1px solid var(--bad)';
      } else {
        nodeEl.style.background = 'var(--surface)';
        nodeEl.style.color = 'var(--ink)';
        nodeEl.style.border = '1px solid var(--border)';
      }

      nodeEl.textContent = node.label;
      container.appendChild(nodeEl);

      if (node.next !== undefined && node.next < nodes.length) {
        const arrow = document.createElement('div');
        arrow.textContent = '↓';
        arrow.style.color = 'var(--ink-soft)';
        arrow.style.fontSize = '1.2rem';
        container.appendChild(arrow);
      }
    });

    wrap.appendChild(container);
    el.exerciseArea.appendChild(wrap);
  }

  el.learnPrevBtn.addEventListener('click', function () {
    if (state.learnIndex > 0) {
      state.learnIndex--;
      renderLearnSlide();
    }
  });

  el.learnNextBtn.addEventListener('click', function () {
    const data = state.learnData;
    if (state.learnIndex < data.slides.length - 1) {
      state.learnIndex++;
      renderLearnSlide();
    } else {
      el.learnScreen.classList.add('hidden');
      startQuiz(state.section, state.level);
    }
  });

  el.learnSkipBtn.addEventListener('click', function () {
    el.learnScreen.classList.add('hidden');
    startQuiz(state.section, state.level);
  });

  function startQuiz(section, level) {
    state.level = level;
    state.section = section;
    state.quizVariant = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
    const path = 'data/' + section + '-quiz-' + state.quizVariant + '.json';
    fetch(path)
      .then(function (res) {
        if (!res.ok) {
          const fallbackPath = 'data/' + section + '-quiz.json';
          return fetch(fallbackPath).then(function (r) {
            if (!r.ok) throw new Error('Could not load ' + path + ' or ' + fallbackPath);
            return r.json();
          });
        }
        return res.json();
      })
      .then(function (json) {
        state.data = json;
        state.index = 0;
        state.answers = {};
        state.score = 0;
        state.passed = false;
        el.sectionSelection.classList.add('hidden');
        el.resultsContainer.classList.add('hidden');
        el.quizContainer.classList.remove('hidden');
        state.pqLocked = false;
        startTimer();
        startPqTimer();
        renderQuestion();
      })
      .catch(function (err) {
        console.error(err);
        alert('Sorry, that section could not be loaded. (' + err.message + ')');
      });
  }

  /* ---------- Timer ---------- */
  function startTimer() {
    stopTimer();
    if (!state.timerEnabled) {
      el.timerDisplay.classList.add('hidden');
      return;
    }
    state.timerRemaining = state.timerMinutes * 60;
    el.timerDisplay.classList.remove('hidden');
    renderTimer();
    state.timerHandle = setInterval(function () {
      state.timerRemaining--;
      renderTimer();
      if (state.timerRemaining <= 0) {
        stopTimer();
        showResults();
      }
    }, 1000);
  }
  function stopTimer() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }
  function renderTimer() {
    const m = Math.floor(state.timerRemaining / 60);
    const s = state.timerRemaining % 60;
    el.timer.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    el.timer.classList.toggle('low', state.timerRemaining <= 30);
  }

  /* ---------- Per-question timer ---------- */
  function startPqTimer() {
    stopPqTimer();
    if (!state.pqTimerEnabled || state.pqLocked) {
      el.pqTimerDisplay.classList.add('hidden');
      return;
    }
    state.pqTimerRemaining = state.pqTimerSeconds;
    el.pqTimerDisplay.classList.remove('hidden');
    renderPqTimer();
    state.pqTimerHandle = setInterval(function () {
      state.pqTimerRemaining--;
      renderPqTimer();
      if (state.pqTimerRemaining <= 0) {
        stopPqTimer();
        lockCurrentQuestion();
      }
    }, 1000);
  }
  function stopPqTimer() {
    if (state.pqTimerHandle) {
      clearInterval(state.pqTimerHandle);
      state.pqTimerHandle = null;
    }
  }
  function renderPqTimer() {
    const s = state.pqTimerRemaining % 60;
    el.pqTimer.textContent = '0:' + String(s).padStart(2, '0');
    el.pqTimer.classList.toggle('low', state.pqTimerRemaining <= 10);
  }
  function resetPqTimer() {
    stopPqTimer();
    if (state.pqTimerEnabled) {
      startPqTimer();
    } else {
      el.pqTimerDisplay.classList.add('hidden');
    }
  }
  function lockCurrentQuestion() {
    const q = state.data.questions[state.index];
    if (q.type === 'pyramid') {
      const userAnswers = state.answers[q.id] || [];
      if (!checkPyramidAnswer(q, userAnswers)) {
        state.pqLocked = true;
        renderQuestion();
      } else {
        el.pqTimerDisplay.classList.add('hidden');
      }
    } else {
      el.pqTimerDisplay.classList.add('hidden');
    }
  }

  /* ---------- Shape canvas rendering (for visual abstract-reasoning questions) ---------- */
  // desc: { shape: 'square'|'circle'|'triangle', rotation: degrees, fill: 'solid'|'hollow', dots: [0,1,2,3], scale: 0-1 }
  // dot positions are fixed slots around the box: 0=top, 1=right, 2=bottom, 3=left
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function drawShapeCanvas(canvas, desc) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const size = (Math.min(w, h) * 0.42) * (desc.scale || 1);
    const ink = cssVar('--ink', '#1E2340');
    const accent = cssVar('--accent', '#B5792A');

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((desc.rotation || 0) * Math.PI) / 180);
    ctx.lineWidth = 3;
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.beginPath();
    const shape = desc.shape || 'square';
    if (shape === 'square') {
      ctx.rect(-size / 2, -size / 2, size, size);
    } else if (shape === 'circle') {
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
    }
    if (desc.fill === 'solid') ctx.fill(); else ctx.stroke();
    ctx.restore();

    const dotR = 4.5;
    const reach = Math.min(w, h) * 0.42;
    const positions = [
      { x: cx, y: cy - reach },
      { x: cx + reach, y: cy },
      { x: cx, y: cy + reach },
      { x: cx - reach, y: cy },
    ];
    (desc.dots || []).forEach(function (i) {
      const p = positions[i];
      if (!p) return;
      ctx.beginPath();
      ctx.fillStyle = accent;
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  function makeShapeCanvas(desc, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.className = 'shape-canvas';
    drawShapeCanvas(canvas, desc);
    return canvas;
  }

  /* ---------- Rendering the quiz ---------- */
  function renderQuestion() {
    state.selectedTileValue = null;
    const q = state.data.questions[state.index];
    const total = state.data.questions.length;

    el.progressBar.style.width = ((state.index) / total * 100) + '%';
    el.progressLabel.textContent = 'Question ' + (state.index + 1) + ' of ' + total;

    const card = document.createElement('div');
    card.className = 'question-card';

     const prompt = document.createElement('p');
     prompt.className = 'question-prompt';
     prompt.textContent = q.prompt;
     card.appendChild(prompt);

       if (q.type === 'pyramid') {
         renderPyramid(card, q);
       } else if (q.type === 'visual') {
         renderVisualOptions(card, q);
       } else if (q.type === 'cluster-missing') {
         renderClusterMissing(card, q);
       } else if (q.type === 'matrix-3x3') {
         renderMatrix3x3(card, q);
        } else if (q.type === 'typing') {
          renderTypingQuestion(card, q);
        } else if (q.type === 'insert') {
          renderInsertQuestion(card, q);
        } else if (q.type === 'dragorder') {
          renderDragOrder(card, q);
        } else if (q.type === 'coderunner') {
          renderCodeRunner(card, q);
        } else {
          renderTextOptions(card, q);
        }

     el.questionContainer.innerHTML = '';
     el.questionContainer.appendChild(card);

      el.prevBtn.disabled = state.index === 0;
      el.nextBtn.textContent = state.index === total - 1 ? 'Finish' : 'Next';
      resetPqTimer();
    }

  function renderTextOptions(card, q) {
    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'options';

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isProfiled = q.type === 'profiled';
    const isMulti = Array.isArray(q.correctIndices);
    const saved = state.answers[q.id];
    const selected = isMulti ? (saved || []) : saved;

    if (isMulti) {
      const hint = document.createElement('p');
      hint.className = 'multi-hint';
      hint.textContent = 'Select all that apply';
      hint.style.fontSize = '0.8rem';
      hint.style.color = 'var(--accent)';
      hint.style.fontWeight = '600';
      hint.style.margin = '0 0 0.75rem';
      card.appendChild(hint);
    }

    q.options.forEach(function (opt, i) {
      const label = isProfiled ? opt.text : (typeof opt === 'string' ? opt : '');
      const option = document.createElement('div');
      const isSelected = isMulti ? selected.indexOf(i) !== -1 : selected === i;
      option.className = 'option' + (isSelected ? ' selected' : '');

      const marker = document.createElement('span');
      marker.className = 'option-marker';
      marker.textContent = letters[i] || (i + 1);

      const text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = label;

      option.appendChild(marker);
      option.appendChild(text);
      option.addEventListener('click', function () {
        if (isMulti) {
          const current = state.answers[q.id] || [];
          const idx = current.indexOf(i);
          if (idx === -1) {
            current.push(i);
          } else {
            current.splice(idx, 1);
          }
          state.answers[q.id] = current.sort(function (a, b) { return a - b; });
        } else {
          state.answers[q.id] = i;
        }
        renderQuestion();
      });
      optionsWrap.appendChild(option);
    });

    card.appendChild(optionsWrap);
  }

  function renderTypingQuestion(card, q) {
    const saved = state.answers[q.id] || [];
    const wrap = document.createElement('div');
    wrap.className = 'typing-question';

    if (q.template) {
      const promptLine = document.createElement('p');
      promptLine.className = 'typing-template';
      promptLine.style.fontFamily = 'var(--font-mono)';
      promptLine.style.background = 'var(--bg)';
      promptLine.style.padding = '0.75rem 1rem';
      promptLine.style.borderRadius = '8px';
      promptLine.style.border = '1px solid var(--border)';
      promptLine.style.whiteSpace = 'pre-wrap';
      promptLine.style.margin = '0 0 1rem';
      promptLine.textContent = q.template;
      wrap.appendChild(promptLine);
    }

    const blanksWrap = document.createElement('div');
    blanksWrap.className = 'typing-blanks';
    const inputs = [];

    (q.blanks || []).forEach(function (expected, i) {
      const row = document.createElement('div');
      row.className = 'typing-blank-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '0.5rem';
      row.style.marginBottom = '0.5rem';

      const label = document.createElement('label');
      label.textContent = 'Blank ' + (i + 1) + ':';
      label.style.fontSize = '0.85rem';
      label.style.color = 'var(--ink-soft)';
      label.style.fontWeight = '600';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'typing-input';
      input.placeholder = expected.length <= 15 ? 'e.g. ' + expected : 'Type code...';
      input.value = saved[i] || '';
      inputs.push(input);

      input.addEventListener('input', function () {
        state.answers[q.id] = inputs.map(function (inp) { return inp.value; });
      });

      input.addEventListener('blur', function () {
        input.value = input.value.trim();
        state.answers[q.id] = inputs.map(function (inp) { return inp.value; });
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          e.preventDefault();
          const next = inputs[i + 1];
          if (next) {
            next.focus();
          } else {
            input.blur();
          }
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          el.submitBtn.click();
        }
      });

      row.appendChild(label);
      row.appendChild(input);
      blanksWrap.appendChild(row);
    });

    if ((q.blanks || []).length > 1) {
      const hint = document.createElement('p');
      hint.style.fontSize = '0.75rem';
      hint.style.color = 'var(--ink-soft)';
      hint.style.margin = '0.25rem 0 0';
      hint.textContent = 'Press Tab to move between blanks, Enter to submit';
      blanksWrap.appendChild(hint);
    }

    wrap.appendChild(blanksWrap);
    card.appendChild(wrap);
  }

  function renderInsertQuestion(card, q) {
    const saved = state.answers[q.id] || [];
    const wrap = document.createElement('div');
    wrap.className = 'insert-question';

    const template = q.template || '';
    const blanks = q.blanks || [];
    const options = q.options || [];

    const codeLine = document.createElement('div');
    codeLine.className = 'insert-template';
    codeLine.style.fontFamily = 'var(--font-mono)';
    codeLine.style.background = 'var(--bg)';
    codeLine.style.padding = '0.75rem 1rem';
    codeLine.style.borderRadius = '8px';
    codeLine.style.border = '1px solid var(--border)';
    codeLine.style.whiteSpace = 'pre-wrap';
    codeLine.style.margin = '0 0 1rem';
    codeLine.style.position = 'relative';

    const parts = template.split('_____');
    const selected = saved[0] !== undefined ? saved[0] : null;

    parts.forEach(function (part, i) {
      codeLine.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        const slot = document.createElement('span');
        slot.className = 'insert-slot';
        slot.style.display = 'inline-block';
        slot.style.minWidth = '80px';
        slot.style.minHeight = '1.5em';
        slot.style.border = '2px dashed var(--accent)';
        slot.style.borderRadius = '4px';
        slot.style.padding = '0.1rem 0.4rem';
        slot.style.margin = '0 0.2rem';
        slot.style.verticalAlign = 'middle';
        slot.style.background = 'var(--surface)';
        slot.style.textAlign = 'center';
        slot.style.fontWeight = '600';
        slot.textContent = selected !== null ? options[selected] : '_____';
        slot.dataset.slotIndex = String(i);
        codeLine.appendChild(slot);
      }
    });

    wrap.appendChild(codeLine);

    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'insert-options';
    optionsWrap.style.display = 'flex';
    optionsWrap.style.flexWrap = 'wrap';
    optionsWrap.style.gap = '0.5rem';
    optionsWrap.style.marginBottom = '0.75rem';

    options.forEach(function (opt, i) {
      const btn = document.createElement('button');
      btn.className = 'exercise-option';
      btn.textContent = opt;
      btn.addEventListener('click', function () {
        state.answers[q.id] = [i];
        renderQuestion();
      });
      optionsWrap.appendChild(btn);
    });

    wrap.appendChild(optionsWrap);
    card.appendChild(wrap);
  }

  function renderDragOrder(card, q) {
    const saved = state.answers[q.id] || [];
    const wrap = document.createElement('div');
    wrap.className = 'dragorder-question';

    const instr = document.createElement('p');
    instr.className = 'dragorder-instr';
    instr.textContent = 'Drag to arrange in the correct order.';
    instr.style.color = 'var(--ink-soft)';
    instr.style.margin = '0 0 0.75rem';
    instr.style.fontSize = '0.85rem';
    wrap.appendChild(instr);

    const list = document.createElement('div');
    list.className = 'dragorder-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '0.4rem';

    const items = q.items || [];
    const order = saved.length === items.length ? saved : shuffleArray(items.map(function (_, i) { return i; }));

    order.forEach(function (originalIndex) {
      const text = items[originalIndex];
      const item = document.createElement('div');
      item.className = 'dragorder-item';
      item.style.background = 'var(--surface)';
      item.style.border = '1px solid var(--border)';
      item.style.borderRadius = '8px';
      item.style.padding = '0.65rem 1rem';
      item.style.cursor = 'grab';
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '0.5rem';
      item.dataset.index = String(originalIndex);
      item.textContent = text;

      item.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', item.dataset.index);
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', function () {
        item.style.opacity = '1';
      });
      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        list.style.outline = '2px solid var(--accent)';
      });
      item.addEventListener('dragleave', function () {
        list.style.outline = 'none';
      });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        list.style.outline = 'none';
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = parseInt(item.dataset.index, 10);
        const fromItem = list.querySelector('[data-index="' + fromIdx + '"]');
        const toItem = list.querySelector('[data-index="' + toIdx + '"]');
        if (fromItem && toItem && fromItem !== toItem) {
          const tempText = fromItem.textContent;
          fromItem.textContent = toItem.textContent;
          fromItem.dataset.index = toItem.dataset.index;
          toItem.textContent = tempText;
          toItem.dataset.index = String(fromIdx);
          const newOrder = Array.from(list.children).map(function (child) {
            return parseInt(child.dataset.index, 10);
          });
          state.answers[q.id] = newOrder;
        }
      });
      list.appendChild(item);
    });

    wrap.appendChild(list);
    card.appendChild(wrap);

    if (typeof Sortable !== 'undefined') {
      new Sortable(list, {
        animation: 150,
        handle: '.dragorder-item',
        onEnd: function () {
          const newOrder = Array.from(list.children).map(function (child) {
            return parseInt(child.dataset.index, 10);
          });
          state.answers[q.id] = newOrder;
        }
      });
    }
  }

  function renderVisualOptions(card, q) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const selected = state.answers[q.id];

    const seqRow = document.createElement('div');
    seqRow.className = 'visual-sequence';
    (q.sequence || []).forEach(function (desc) {
      const box = document.createElement('div');
      box.className = 'shape-box';
      box.appendChild(makeShapeCanvas(desc, 84));
      seqRow.appendChild(box);
    });
    const placeholder = document.createElement('div');
    placeholder.className = 'shape-box placeholder';
    placeholder.textContent = '?';
    seqRow.appendChild(placeholder);
    card.appendChild(seqRow);

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'visual-options';
    q.options.forEach(function (desc, i) {
      const opt = document.createElement('div');
      opt.className = 'shape-option' + (selected === i ? ' selected' : '');
      const letter = document.createElement('span');
      letter.className = 'shape-option-letter';
      letter.textContent = letters[i] || (i + 1);
      opt.appendChild(letter);
      opt.appendChild(makeShapeCanvas(desc, 84));
      opt.addEventListener('click', function () {
        state.answers[q.id] = i;
        renderQuestion();
      });
      optionsGrid.appendChild(opt);
    });
    card.appendChild(optionsGrid);
  }

  /* ---------- Cluster missing-number rendering ---------- */
  function renderClusterMissing(card, q) {
    const wrap = document.createElement('div');
    wrap.className = 'cluster-missing';

    const instr = document.createElement('p');
    instr.className = 'cluster-instr';
    instr.textContent = 'Each cluster uses the same rule. Find the missing number.';
    wrap.appendChild(instr);

    const clusters = document.createElement('div');
    clusters.className = 'cluster-row';

    q.clusters.forEach(function (c, idx) {
      const cluster = document.createElement('div');
      cluster.className = 'cluster' + (c.top === null ? ' cluster-missing-top' : '');

      const top = document.createElement('div');
      top.className = 'cluster-top';
      top.textContent = c.top === null ? '?' : c.top;
      cluster.appendChild(top);

      const bottom = document.createElement('div');
      bottom.className = 'cluster-bottom';
      c.bottom.forEach(function (val) {
        const b = document.createElement('span');
        b.className = 'cluster-bottom-num';
        b.textContent = val;
        bottom.appendChild(b);
      });
      cluster.appendChild(bottom);

      clusters.appendChild(cluster);
    });
    wrap.appendChild(clusters);

    const opts = document.createElement('div');
    opts.className = 'cluster-options';
    const selected = state.answers[q.id];
    q.options.forEach(function (val, i) {
      const opt = document.createElement('button');
      opt.className = 'cluster-opt' + (selected === i ? ' selected' : '');
      opt.textContent = val;
      opt.addEventListener('click', function () {
        state.answers[q.id] = i;
        renderQuestion();
      });
      opts.appendChild(opt);
    });
    wrap.appendChild(opts);

    card.appendChild(wrap);
  }

  function renderCodeRunner(card, q) {
    const wrap = document.createElement('div');
    wrap.className = 'coderunner-question';

    const instr = document.createElement('p');
    instr.className = 'coderunner-instr';
    instr.textContent = 'Edit the code below, then click Run to see the output.';
    instr.style.color = 'var(--ink-soft)';
    instr.style.margin = '0 0 0.75rem';
    instr.style.fontSize = '0.85rem';
    wrap.appendChild(instr);

    const editorWrap = document.createElement('div');
    editorWrap.className = 'coderunner-editor-wrap';
    editorWrap.style.border = '1px solid var(--border)';
    editorWrap.style.borderRadius = '8px';
    editorWrap.style.overflow = 'hidden';
    editorWrap.style.marginBottom = '0.75rem';

    const editor = document.createElement('textarea');
    editor.className = 'coderunner-editor';
    editor.style.width = '100%';
    editor.style.minHeight = '160px';
    editor.style.padding = '0.75rem';
    editor.style.border = 'none';
    editor.style.background = 'var(--bg)';
    editor.style.color = 'var(--ink)';
    editor.style.fontFamily = 'var(--font-mono)';
    editor.style.fontSize = '0.85rem';
    editor.style.lineHeight = '1.5';
    editor.style.resize = 'vertical';
    editor.value = q.starterCode || '';
    editorWrap.appendChild(editor);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '0.5rem';
    btnRow.style.marginBottom = '0.75rem';

    const runBtn = document.createElement('button');
    runBtn.className = 'btn';
    runBtn.textContent = '▶ Run';
    runBtn.style.padding = '0.5rem 1rem';
    runBtn.style.fontSize = '0.85rem';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = 'Reset';
    resetBtn.style.padding = '0.5rem 1rem';
    resetBtn.style.fontSize = '0.85rem';

    btnRow.appendChild(runBtn);
    btnRow.appendChild(resetBtn);
    wrap.appendChild(editorWrap);
    wrap.appendChild(btnRow);

    const output = document.createElement('pre');
    output.className = 'coderunner-output';
    output.style.background = 'var(--surface)';
    output.style.border = '1px solid var(--border)';
    output.style.borderRadius = '8px';
    output.style.padding = '0.75rem';
    output.style.minHeight = '3rem';
    output.style.fontFamily = 'var(--font-mono)';
    output.style.fontSize = '0.85rem';
    output.style.whiteSpace = 'pre-wrap';
    output.style.marginBottom = '0.75rem';
    output.textContent = 'Output will appear here...';
    output.style.color = 'var(--ink-soft)';
    wrap.appendChild(output);

    runBtn.addEventListener('click', function () {
      const code = editor.value;
      state.answers[q.id] = code;
      const result = simulateCSharp(code, q);
      output.textContent = result.output;
      output.style.color = result.ok ? 'var(--good)' : 'var(--bad)';
      output.style.borderColor = result.ok ? 'var(--good)' : 'var(--bad)';
    });

    resetBtn.addEventListener('click', function () {
      editor.value = q.starterCode || '';
      output.textContent = 'Output will appear here...';
      output.style.color = 'var(--ink-soft)';
      output.style.borderColor = 'var(--border)';
      state.answers[q.id] = q.starterCode || '';
    });

    card.appendChild(wrap);
  }

  function simulateCSharp(code, q) {
    const expected = (q.expectedOutput || '').trim();
    const pattern = q.outputPattern;

    if (!expected && !pattern) {
      return { output: 'No expected output defined for this question.', ok: false };
    }

    if (q.requiredStrings) {
      const missing = q.requiredStrings.filter(function (s) { return code.indexOf(s) === -1; });
      if (missing.length > 0) {
        return { output: 'Missing required code: ' + missing.join(', '), ok: false };
      }
    }

    if (pattern) {
      const regex = new RegExp(pattern);
      if (regex.test(code)) {
        return { output: expected || 'Pattern matched!', ok: true };
      }
      return { output: 'Output did not match the expected pattern.', ok: false };
    }

    return { output: expected, ok: true };
  }

  /* ---------- Matrix 3x3 rendering ---------- */
  function drawMatrixCell(canvas, desc) {
    if (!desc) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const size = Math.min(w, h) * 0.32;
    const ink = cssVar('--ink', '#1E2340');
    const accent = cssVar('--accent', '#B5792A');

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(((desc.rotation || 0) * Math.PI) / 180);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;

    const fill = desc.fill || 'hollow';
    if (fill === 'solid') {
      ctx.fillStyle = ink;
    } else if (fill === 'hatched') {
      ctx.fillStyle = 'rgba(30,35,64,0.3)';
    }

    ctx.beginPath();
    const shape = desc.shape || 'square';
    if (shape === 'circle') {
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    } else if (shape === 'square') {
      ctx.rect(-size, -size, size * 2, size * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(-size, size);
      ctx.closePath();
    } else if (shape === 'diamond') {
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
    } else if (shape === 'cross') {
      const t = size * 0.3;
      ctx.moveTo(-t, -size);
      ctx.lineTo(t, -size);
      ctx.lineTo(t, -t);
      ctx.lineTo(size, -t);
      ctx.lineTo(size, t);
      ctx.lineTo(t, t);
      ctx.lineTo(t, size);
      ctx.lineTo(-t, size);
      ctx.lineTo(-t, t);
      ctx.lineTo(-size, t);
      ctx.lineTo(-size, -t);
      ctx.lineTo(-t, -t);
      ctx.closePath();
    } else if (shape === 'hexagon') {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = Math.cos(a) * size;
        const y = Math.sin(a) * size;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (shape === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? size : size * 0.4;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (shape === 'heart') {
      const s = size * 0.7;
      ctx.moveTo(0, s * 0.6);
      ctx.bezierCurveTo(-s, -s * 0.3, -s * 0.5, -s, 0, -s * 0.4);
      ctx.bezierCurveTo(s * 0.5, -s, s, -s * 0.3, 0, s * 0.6);
      ctx.closePath();
    }
    if (fill === 'solid') ctx.fill();
    else if (fill === 'hatched') { ctx.fill(); ctx.stroke(); }
    else ctx.stroke();

    const count = desc.count || 1;
    if (count > 1) {
      ctx.fillStyle = ink;
      ctx.font = `bold ${Math.round(size * 0.5)}px var(--font)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count, 0, 0);
    }

    ctx.restore();
  }

  function renderMatrix3x3(card, q) {
    const wrap = document.createElement('div');
    wrap.className = 'matrix-3x3';

    const instr = document.createElement('p');
    instr.className = 'matrix-instr';
    instr.textContent = 'Find the pattern and complete the grid.';
    wrap.appendChild(instr);

    const grid = document.createElement('div');
    grid.className = 'matrix-grid';

    q.grid.forEach(function (row) {
      const rowEl = document.createElement('div');
      rowEl.className = 'matrix-row';
      rowEl.style.display = 'flex';
      rowEl.style.gap = '4px';
      rowEl.style.marginBottom = '4px';
      row.forEach(function (cell) {
        const cellEl = document.createElement('div');
        cellEl.className = 'matrix-cell';
        if (cell) {
          const c = document.createElement('canvas');
          c.width = 64;
          c.height = 64;
          drawMatrixCell(c, cell);
          cellEl.appendChild(c);
        } else {
          cellEl.classList.add('matrix-empty');
          cellEl.textContent = '?';
        }
        rowEl.appendChild(cellEl);
      });
      grid.appendChild(rowEl);
    });
    wrap.appendChild(grid);

    const opts = document.createElement('div');
    opts.className = 'matrix-options';
    const selected = state.answers[q.id];
    q.options.forEach(function (opt, i) {
      const optEl = document.createElement('div');
      optEl.className = 'matrix-opt' + (selected === i ? ' selected' : '');
      const c = document.createElement('canvas');
      c.width = 56;
      c.height = 56;
      drawMatrixCell(c, opt);
      optEl.appendChild(c);
      optEl.addEventListener('click', function () {
        state.answers[q.id] = i;
        renderQuestion();
      });
      opts.appendChild(optEl);
    });
    wrap.appendChild(opts);

    card.appendChild(wrap);
  }

  /* ---------- Pyramid rendering (drag-and-drop number pyramids) ---------- */
  function checkPyramidAnswer(q, placed) {
    if (!placed || placed.length < q.solutions.length) return false;
    for (let i = 0; i < q.solutions.length; i++) {
      if (placed[i] === undefined || placed[i] === null) return false;
      if (placed[i] !== q.solutions[i]) return false;
    }
    return true;
  }

  function countValue(arr, val) {
    let n = 0;
    arr.forEach(function (v) { if (v === val) n++; });
    return n;
  }

  function renderPyramid(card, q) {
    const container = document.createElement('div');
    container.className = 'pyramid-container';

    const grid = document.createElement('div');
    grid.className = 'pyramid-grid';

    let nullIdx = 0;
    let placed = state.answers[q.id];
    if (!Array.isArray(placed)) {
      placed = [];
      state.answers[q.id] = placed;
    }

    q.rows.forEach(function (row, rIdx) {
      const rowEl = document.createElement('div');
      rowEl.className = 'pyramid-row';

      row.forEach(function (cell, cIdx) {
        const cellEl = document.createElement('div');
        cellEl.className = 'pyramid-cell';
        cellEl.dataset.row = rIdx;
        cellEl.dataset.col = cIdx;

        if (cell.v !== null && cell.v !== undefined) {
          cellEl.classList.add('filled');
          cellEl.textContent = cell.v;
        } else {
          cellEl.classList.add('empty');
          cellEl.dataset.nullIdx = String(nullIdx);
          if (placed[nullIdx] !== undefined) {
            cellEl.textContent = placed[nullIdx];
            cellEl.classList.remove('empty');
            cellEl.classList.add('filled-user');
            if (state.pqLocked) cellEl.classList.add('locked');
          }
          nullIdx++;
        }

        if (!cellEl.classList.contains('filled') || cellEl.classList.contains('filled-user')) {
          cellEl.addEventListener('dragover', function (e) {
            e.preventDefault();
            if (cellEl.classList.contains('empty') || cellEl.classList.contains('filled-user')) {
              if (!state.pqLocked) cellEl.classList.add('drag-over');
            }
          });
          cellEl.addEventListener('dragleave', function () {
            cellEl.classList.remove('drag-over');
          });
          cellEl.addEventListener('drop', function (e) {
            e.preventDefault();
            cellEl.classList.remove('drag-over');
            if (state.pqLocked) return;
            const val = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const idx = parseInt(cellEl.dataset.nullIdx, 10);
            placed[idx] = val;
            state.answers[q.id] = placed;
            cellEl.textContent = val;
            cellEl.classList.remove('empty');
            cellEl.classList.add('filled-user');
            renderPyramidTiles(card, q, placed);
            updatePyramidCheckBtn(container, q, placed);
          });
          cellEl.addEventListener('click', function () {
            if (state.pqLocked) return;
            if (cellEl.classList.contains('filled-user')) {
              const idx = parseInt(cellEl.dataset.nullIdx, 10);
              placed[idx] = undefined;
              cellEl.textContent = '';
              cellEl.classList.add('empty');
              cellEl.classList.remove('filled-user');
              renderPyramidTiles(card, q, placed);
              updatePyramidCheckBtn(container, q, placed);
            } else if (state.selectedTileValue !== null && state.selectedTileValue !== undefined) {
              const idx = parseInt(cellEl.dataset.nullIdx, 10);
              placed[idx] = state.selectedTileValue;
              state.answers[q.id] = placed;
              cellEl.textContent = state.selectedTileValue;
              cellEl.classList.remove('empty');
              cellEl.classList.add('filled-user');
              renderPyramidTiles(card, q, placed);
              updatePyramidCheckBtn(container, q, placed);
            }
          });
        }

        rowEl.appendChild(cellEl);
      });
      grid.appendChild(rowEl);
    });
    container.appendChild(grid);

    const tilesWrap = document.createElement('div');
    tilesWrap.className = 'pyramid-tiles-wrap';
    renderPyramidTiles(tilesWrap, q, placed);
    container.appendChild(tilesWrap);

    updatePyramidCheckBtn(container, q, placed);

    card.appendChild(container);
  }

  function renderPyramidTiles(parent, q, placed) {
    let tilesEl = parent.querySelector('.pyramid-tiles');
    if (!tilesEl) {
      tilesEl = document.createElement('div');
      tilesEl.className = 'pyramid-tiles';
      parent.appendChild(tilesEl);
    }
    tilesEl.innerHTML = '';

    const tileCount = {};
    q.tiles.forEach(function (t) { tileCount[t] = (tileCount[t] || 0) + 1; });

    q.tiles.forEach(function (value, i) {
      const tile = document.createElement('div');
      tile.className = 'pyramid-tile';
      tile.draggable = true;
      tile.dataset.value = String(value);
      tile.textContent = value;

      const placedCount = countValue(placed, value) || 0;
      if (placedCount >= (tileCount[value] || 1)) tile.classList.add('used');
      if (state.pqLocked) tile.classList.add('locked');

      tile.addEventListener('dragstart', function (e) {
        if (state.pqLocked) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', String(value));
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', function () {
        tile.classList.remove('dragging');
      });
      tile.addEventListener('click', function () {
        if (state.pqLocked) return;
        state.selectedTileValue = value;
        const allTiles = parent.querySelectorAll('.pyramid-tile');
        allTiles.forEach(function (t) {
          t.classList.toggle('selected', t === tile);
        });
      });

      tilesEl.appendChild(tile);
    });
  }

  function updatePyramidCheckBtn(container, q, placed) {
    let existing = container.querySelector('.pyramid-check-btn');
    if (existing) existing.remove();
    let existingHint = container.querySelector('.pyramid-hint');
    if (existingHint) existingHint.remove();

    const allFilled = q.solutions.every(function (_, i) {
      return placed[i] !== undefined && placed[i] !== null;
    });

    if (!allFilled) {
      const hint = document.createElement('p');
      hint.className = 'pyramid-hint';
      const filled = q.solutions.filter(function (_, i) {
        return placed[i] !== undefined && placed[i] !== null;
      }).length;
      const remaining = q.solutions.length - filled;
      hint.textContent = remaining + ' more circle' + (remaining === 1 ? '' : 's') + ' to fill.';
      container.appendChild(hint);
      return;
    }

    const checkBtn = document.createElement('button');
    checkBtn.className = 'btn pyramid-check-btn';
    checkBtn.textContent = 'Check Answer';
    checkBtn.addEventListener('click', function () {
      checkPyramid(q, placed);
    });
    container.appendChild(checkBtn);
  }

  function checkPyramid(q, placed) {
    const correct = checkPyramidAnswer(q, placed);
    const card = document.querySelector('.question-card');
    let msg = card.querySelector('.pyramid-msg');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'pyramid-msg';
      card.appendChild(msg);
    }
    if (correct) {
      msg.textContent = "Correct! The pyramid adds up properly.";
      msg.className = 'pyramid-msg correct-msg';
    } else {
      msg.textContent = "Not quite. Check the explanation below, then try again.";
      msg.className = 'pyramid-msg wrong-msg';
    }
  }

  /* ---------- Results helpers for pyramid questions ---------- */
  function renderPyramidReview(item, q) {
    const userPlaced = state.answers[q.id] || [];
    const correct = checkPyramidAnswer(q, userPlaced);

    let nullIdx = 0;
    q.rows.forEach(function (row, rIdx) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'review-pyramid-row';

      row.forEach(function (cell, cIdx) {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'review-pyramid-cell';

        if (cell.v !== null && cell.v !== undefined) {
          cellDiv.classList.add('filled');
          cellDiv.textContent = cell.v;
        } else {
          const userVal = userPlaced[nullIdx];
          const solVal = q.solutions[nullIdx];
          cellDiv.classList.add('filled-user');
          if (userVal !== undefined) {
            cellDiv.textContent = userVal;
            if (userVal === solVal) {
              cellDiv.classList.add('correct');
            } else {
              cellDiv.classList.add('incorrect');
            }
          } else {
            cellDiv.textContent = solVal;
            cellDiv.classList.add('skipped');
          }
          nullIdx++;
        }
        rowDiv.appendChild(cellDiv);
      });
      item.appendChild(rowDiv);
    });
  }

  /* ---------- Results helpers for matrix-3x3 questions ---------- */
  function renderMatrixReview(item, q) {
    const userIdx = state.answers[q.id];
    const wrap = document.createElement('div');
    wrap.className = 'matrix-review';

    const grid = document.createElement('div');
    grid.className = 'matrix-grid';
    grid.style.marginBottom = '1rem';
    q.grid.forEach(function (row) {
      const rowEl = document.createElement('div');
      rowEl.className = 'matrix-row';
      rowEl.style.display = 'flex';
      rowEl.style.gap = '4px';
      rowEl.style.marginBottom = '4px';
      row.forEach(function (cell, cIdx) {
        const cellEl = document.createElement('div');
        cellEl.className = 'matrix-cell';
        if (cell) {
          const cv = document.createElement('canvas');
          cv.width = 48;
          cv.height = 48;
          drawMatrixCell(cv, cell);
          cellEl.appendChild(cv);
        } else if (userIdx !== undefined && userIdx >= 0) {
          const opt = q.options[userIdx];
          const isCorrect = userIdx === q.answerIndex;
          cellEl.classList.add(isCorrect ? 'matrix-cell-correct' : 'matrix-cell-incorrect');
          const cv = document.createElement('canvas');
          cv.width = 48;
          cv.height = 48;
          drawMatrixCell(cv, opt);
          cellEl.appendChild(cv);
        } else {
          cellEl.classList.add('matrix-empty');
          cellEl.textContent = '?';
        }
        rowEl.appendChild(cellEl);
      });
      grid.appendChild(rowEl);
    });
    wrap.appendChild(grid);

    const answerRow = document.createElement('div');
    answerRow.style.display = 'flex';
    answerRow.style.gap = '0.5rem';
    answerRow.style.alignItems = 'center';

    if (userIdx !== undefined) {
      const yourLabel = document.createElement('span');
      yourLabel.textContent = 'Your answer: ';
      yourLabel.style.color = 'var(--ink-soft)';
      answerRow.appendChild(yourLabel);
      const yourCanvas = document.createElement('canvas');
      yourCanvas.width = 40;
      yourCanvas.height = 40;
      drawMatrixCell(yourCanvas, q.options[userIdx]);
      answerRow.appendChild(yourCanvas);
    }

    if (userIdx !== q.answerIndex) {
      const correctLabel = document.createElement('span');
      correctLabel.textContent = 'Correct: ';
      correctLabel.style.color = 'var(--ink-soft)';
      answerRow.appendChild(correctLabel);
      const correctCanvas = document.createElement('canvas');
      correctCanvas.width = 40;
      correctCanvas.height = 40;
      drawMatrixCell(correctCanvas, q.options[q.answerIndex]);
      answerRow.appendChild(correctCanvas);
    }

    wrap.appendChild(answerRow);
    item.appendChild(wrap);
  }

  el.prevBtn.addEventListener('click', function () {
    if (state.index > 0) {
      state.index--;
      state.pqLocked = false;
      renderQuestion();
      resetPqTimer();
    }
  });

  el.nextBtn.addEventListener('click', function () {
    const total = state.data.questions.length;
    if (state.index < total - 1) {
      state.index++;
      state.pqLocked = false;
      renderQuestion();
      resetPqTimer();
    } else {
      stopPqTimer();
      stopTimer();
      showResults();
    }
  });

  /* ---------- Results ---------- */
  function showResults() {
    stopPqTimer();
    el.pqTimerDisplay.classList.add('hidden');
    state.pqLocked = false;
    el.quizContainer.classList.add('hidden');
    el.resultsContainer.classList.add('hidden');
    el.timerDisplay.classList.add('hidden');

    const questions = state.data.questions;
    const isProfiled = questions[0] && questions[0].type === 'profiled';

    const wrap = document.createElement('div');

    if (isProfiled) {
      renderProfiledResults(wrap, questions);
    } else {
      renderScoredResults(wrap, questions);
    }

    updateCompletionBadges();
    updateOverallProgress();

    const actions = document.createElement('div');
    actions.className = 'results-actions';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back to sections';
    backBtn.addEventListener('click', function () {
      el.resultsContainer.classList.add('hidden');
      el.sectionSelection.classList.remove('hidden');
      updateCompletionBadges();
      updateOverallProgress();
    });

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn';
    retryBtn.textContent = 'Retry this section';
    retryBtn.addEventListener('click', function () {
      startQuiz(state.section, state.level);
    });

    actions.appendChild(retryBtn);
    actions.appendChild(backBtn);
    wrap.appendChild(actions);

    el.resultsContainer.innerHTML = '';
    el.resultsContainer.appendChild(wrap);
    el.resultsContainer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderScoredResults(wrap, questions) {
    let correct = 0;
     questions.forEach(function (q) {
       if (q.type === 'pyramid') {
         if (checkPyramidAnswer(q, state.answers[q.id])) correct++;
       } else if (q.type === 'typing') {
         const user = state.answers[q.id] || [];
         const expected = q.blanks || [];
         if (user.length === expected.length && expected.every(function (v, i) { return String(user[i]).trim().toLowerCase() === String(v).trim().toLowerCase(); })) {
           correct++;
         }
       } else if (q.type === 'dragorder') {
         const user = state.answers[q.id] || [];
         const expected = q.solution || [];
         if (JSON.stringify(user) === JSON.stringify(expected)) correct++;
        } else if (q.type === 'coderunner') {
          const code = state.answers[q.id] || '';
          const result = simulateCSharp(code, q);
          if (result.ok) correct++;
        } else if (q.type === 'insert') {
          const user = (state.answers[q.id] || [])[0];
          if (user === q.answerIndex) correct++;
        } else if (Array.isArray(q.correctIndices)) {
          const user = (state.answers[q.id] || []).sort(function (a, b) { return a - b; });
          const expected = q.correctIndices.slice().sort(function (a, b) { return a - b; });
          if (JSON.stringify(user) === JSON.stringify(expected)) correct++;
        } else if (state.answers[q.id] === q.answerIndex) {
          correct++;
        }
     });
    const pct = Math.round((correct / questions.length) * 100);
    state.score = pct;
    state.passed = pct >= 80;

    saveQuizResult(state.section, state.level, state.quizVariant, pct, correct, questions.length);

    const hero = document.createElement('div');
    hero.className = 'results-hero';
    const passBadge = state.passed
      ? '<span class="pass-badge">PASS</span>'
      : '<span class="fail-badge">FAIL</span>';
    hero.innerHTML =
      '<p class="settings-hint" style="margin:0;">' + sectionTitle() + '</p>' +
      passBadge +
      '<p class="results-score">' + pct + '%</p>' +
      '<p class="results-sub">' + correct + ' of ' + questions.length + ' correct</p>';
    wrap.appendChild(hero);

    const reviewHeading = document.createElement('h2');
    reviewHeading.textContent = 'Review';
    wrap.appendChild(reviewHeading);

     questions.forEach(function (q, i) {
        const userAnswers = state.answers[q.id];
        const isPyramid = q.type === 'pyramid';
        const isVisualType = q.type === 'visual' || q.type === 'matrix-3x3';

        let gotIt = false;
        if (isPyramid) {
          gotIt = checkPyramidAnswer(q, userAnswers);
        } else if (q.type === 'typing') {
          const user = userAnswers || [];
          const expected = q.blanks || [];
          gotIt = user.length === expected.length && expected.every(function (v, idx) { return String(user[idx]).trim().toLowerCase() === String(v).trim().toLowerCase(); });
        } else if (q.type === 'dragorder') {
          gotIt = JSON.stringify(userAnswers || []) === JSON.stringify(q.solution || []);
        } else if (q.type === 'coderunner') {
          gotIt = simulateCSharp(userAnswers || '', q).ok;
        } else if (q.type === 'insert') {
          gotIt = (userAnswers || [])[0] === q.answerIndex;
        } else if (Array.isArray(q.correctIndices)) {
          const user = (userAnswers || []).sort(function (a, b) { return a - b; });
          const expected = q.correctIndices.slice().sort(function (a, b) { return a - b; });
          gotIt = JSON.stringify(user) === JSON.stringify(expected);
        } else {
          gotIt = userAnswers === q.answerIndex;
        }

       const item = document.createElement('div');
       item.className = 'review-item';

       const p = document.createElement('p');
       p.className = 'review-prompt';
       p.textContent = (i + 1) + '. ' + q.prompt;
       item.appendChild(p);

       const tag = document.createElement('span');
       tag.className = 'tag ' + (gotIt ? 'good' : 'bad');
       tag.textContent = gotIt ? 'Correct' : 'Incorrect';
       item.appendChild(tag);

       if (isPyramid) {
         renderPyramidReview(item, q);
       } else if (q.type === 'matrix-3x3') {
         renderMatrixReview(item, q);
          } else if (q.type === 'typing') {
            const user = Array.isArray(userAnswers) ? userAnswers : [];
            const expected = q.blanks || [];
            const yourAnswer = document.createElement('p');
            yourAnswer.textContent = 'Your answer: ' + (user.length ? user.join(', ') : '(skipped)');
            yourAnswer.style.fontFamily = 'var(--font-mono)';
            yourAnswer.style.fontSize = '0.85rem';
            item.appendChild(yourAnswer);
            if (!gotIt) {
              const correctAnswer = document.createElement('p');
              correctAnswer.textContent = 'Correct answer: ' + (expected.length ? expected.join(', ') : '(none)');
              correctAnswer.style.fontFamily = 'var(--font-mono)';
              correctAnswer.style.fontSize = '0.85rem';
              correctAnswer.style.color = 'var(--good)';
              item.appendChild(correctAnswer);
              
              if (expected.length > 1) {
                const detail = document.createElement('p');
                detail.style.fontSize = '0.8rem';
                detail.style.color = 'var(--ink-soft)';
                detail.style.marginTop = '0.25rem';
                
                let wrongBlanks = [];
                expected.forEach(function (exp, idx) {
                  const userVal = (user[idx] || '').trim().toLowerCase();
                  const expVal = String(exp).trim().toLowerCase();
                  if (userVal !== expVal) {
                    wrongBlanks.push('Blank ' + (idx + 1) + ' (expected: ' + exp + ')');
                  }
                });
                
                if (wrongBlanks.length > 0) {
                  detail.textContent = 'Incorrect blanks: ' + wrongBlanks.join('; ');
                  item.appendChild(detail);
                }
              }
            }
          } else if (q.type === 'insert') {
           const user = (userAnswers || [])[0];
           const yourAnswer = document.createElement('p');
           yourAnswer.textContent = 'Your answer: ' + (user !== undefined ? q.options[user] : '(skipped)');
           item.appendChild(yourAnswer);
           if (!gotIt) {
             const correctAnswer = document.createElement('p');
             correctAnswer.textContent = 'Correct answer: ' + q.options[q.answerIndex];
             item.appendChild(correctAnswer);
           }
         } else if (q.type === 'dragorder') {
          const yourAnswer = document.createElement('p');
          const order = Array.isArray(userAnswers) ? userAnswers : [];
          yourAnswer.textContent = 'Your order: ' + (order.length ? order.join(', ') : '(skipped)');
          item.appendChild(yourAnswer);
          if (!gotIt) {
            const correctAnswer = document.createElement('p');
            correctAnswer.textContent = 'Correct order: ' + (q.solution || []).join(', ');
            item.appendChild(correctAnswer);
          }
       } else if (q.type === 'coderunner') {
         const yourAnswer = document.createElement('p');
         const code = userAnswers || '';
         yourAnswer.textContent = 'Your code: ' + (code ? code.substring(0, 200) + (code.length > 200 ? '...' : '') : '(skipped)');
         item.appendChild(yourAnswer);
         if (!gotIt) {
           const exp = document.createElement('p');
           exp.style.color = 'var(--ink-soft)';
           exp.textContent = 'Expected output: ' + (q.expectedOutput || '(none)');
           item.appendChild(exp);
         }
       } else {
         const yourAnswer = document.createElement('p');
         if (q.type === 'visual') {
           yourAnswer.textContent = 'Your answer: ' + (userAnswers !== undefined ? 'Option ' + (['A','B','C','D','E','F'][userAnswers] || (userAnswers + 1)) : '(skipped)');
         } else {
           yourAnswer.textContent = 'Your answer: ' + (userAnswers !== undefined ? q.options[userAnswers] : '(skipped)');
         }
         item.appendChild(yourAnswer);

         if (!gotIt) {
           const correctAnswer = document.createElement('p');
           if (q.type === 'visual') {
             correctAnswer.textContent = 'Correct answer: Option ' + (['A','B','C','D','E','F'][q.answerIndex] || (q.answerIndex + 1));
           } else {
             correctAnswer.textContent = 'Correct answer: ' + q.options[q.answerIndex];
           }
           item.appendChild(correctAnswer);
         }

         if (q.type === 'visual') {
           const thumbs = document.createElement('div');
           thumbs.className = 'review-thumbs';
           if (userAnswers !== undefined) {
             const yourBox = document.createElement('div');
             yourBox.className = 'review-thumb';
             yourBox.appendChild(makeShapeCanvas(q.options[userAnswers], 56));
             const yourLabel = document.createElement('span');
             yourLabel.textContent = 'Yours';
             yourBox.appendChild(yourLabel);
             thumbs.appendChild(yourBox);
           }
           if (!gotIt) {
             const correctBox = document.createElement('div');
             correctBox.className = 'review-thumb';
             correctBox.appendChild(makeShapeCanvas(q.options[q.answerIndex], 56));
             const correctLabel = document.createElement('span');
             correctLabel.textContent = 'Correct';
             correctBox.appendChild(correctLabel);
             thumbs.appendChild(correctBox);
           }
           item.appendChild(thumbs);
         }
       }

       if (q.explanation) {
         const exp = document.createElement('p');
         exp.style.color = 'var(--ink-soft)';
         exp.textContent = q.explanation;
         item.appendChild(exp);
       }

       wrap.appendChild(item);
     });
  }

  function renderProfiledResults(wrap, questions) {
    const traits = state.data.meta.traits || {};
    const tally = {};
    Object.keys(traits).forEach(function (k) { tally[k] = 0; });

    questions.forEach(function (q) {
      const idx = state.answers[q.id];
      if (idx === undefined) return;
      const opt = q.options[idx];
      if (opt && opt.trait && tally.hasOwnProperty(opt.trait)) tally[opt.trait]++;
    });

    const answered = Object.values(tally).reduce(function (a, b) { return a + b; }, 0) || 1;
    const sortedKeys = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; });
    const topKey = sortedKeys[0];

    const hero = document.createElement('div');
    hero.className = 'results-hero';
    hero.innerHTML =
      '<p class="settings-hint" style="margin:0;">' + sectionTitle() + '</p>' +
      '<p class="results-score" style="font-size:2.2rem;">' + (traits[topKey] || topKey) + '</p>' +
      '<p class="results-sub">Your strongest tendency in this attempt</p>';
    wrap.appendChild(hero);

    const heading = document.createElement('h2');
    heading.textContent = 'Trait breakdown';
    wrap.appendChild(heading);

    sortedKeys.forEach(function (key) {
      const pct = Math.round((tally[key] / answered) * 100);
      const row = document.createElement('div');
      row.className = 'trait-row';
      row.innerHTML =
        '<div class="trait-row-head"><span>' + (traits[key] || key) + '</span><span>' + pct + '%</span></div>' +
        '<div class="trait-track"><div class="trait-fill" style="width:' + pct + '%"></div></div>';
      wrap.appendChild(row);
    });
  }

  function sectionTitle() {
    return (state.data.meta && state.data.meta.title) || state.section;
  }

  function updateCompletionBadges() {
    const cards = document.querySelectorAll('.section-card');
    cards.forEach(function (card, index) {
      const section = card.getAttribute('data-section');
      const level = card.getAttribute('data-level');
      const badge = card.querySelector('.completion-badge');
      if (!badge) return;

      const status = getSectionStatus(section, level);
      badge.style.animationDelay = '0.8s';

      if (status && status.passed) {
        badge.className = 'completion-badge passed';
        badge.innerHTML = renderProgressCircle(100, 80, 7, 34, '#ffffff', false);
        const star = document.createElement('span');
        star.className = 'badge-star';
        star.textContent = '★';
        badge.appendChild(star);
        requestAnimationFrame(function () {
          animateProgressCircle(badge);
        });
      } else if (status && status.attempts > 0) {
        const pct = Math.round(status.bestPct);
        let failClass = 'completion-badge failed-low';
        if (pct >= 70) {
          failClass = 'completion-badge failed-high';
        } else if (pct >= 50) {
          failClass = 'completion-badge failed-mid';
        }
        badge.className = failClass;
        badge.innerHTML = renderProgressCircle(pct, 80, 6, 32, '#ffffff', true);
        requestAnimationFrame(function () {
          animateProgressCircle(badge);
        });
      } else {
        badge.className = 'completion-badge';
        badge.innerHTML = '';
      }

      const mark = card.querySelector('.section-mark');
      let learnBadge = mark ? mark.parentNode.querySelector('.learn-badge') : null;
      if (!learnBadge && mark) {
        learnBadge = document.createElement('span');
        learnBadge.className = 'learn-badge';
        mark.parentNode.insertBefore(learnBadge, mark.nextSibling);
      }
      if (learnBadge) {
        const learnStatus = getLearnProgress(section, level);
        if (learnStatus && learnStatus.completed) {
          learnBadge.className = 'learn-badge done';
          learnBadge.textContent = '\u2713 Learned';
        } else if (learnStatus && learnStatus.lastSlide > 0) {
          learnBadge.className = 'learn-badge in-progress';
          learnBadge.textContent = '\u2022 In progress';
        } else {
          learnBadge.className = 'learn-badge';
          learnBadge.textContent = '';
        }
      }
    });
  }

  function animateProgressCircle(badge) {
    const circle = badge.querySelector('.progress-circle');
    if (!circle) return;
    const targetOffset = circle.getAttribute('data-target-offset');
    if (targetOffset === null) return;
    setTimeout(function () {
      circle.style.transition = 'stroke-dashoffset 1s ease';
      circle.setAttribute('stroke-dashoffset', targetOffset);
    }, 50);
  }

  function renderProgressCircle(pct, size, strokeWidth, radius, color, showText) {
    const circumference = 2 * Math.PI * radius;
    const targetOffset = circumference - (pct / 100) * circumference;
    const cx = size / 2;
    const cy = size / 2;

    let svg = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="' + strokeWidth + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="' + strokeWidth + '" ' +
        'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + circumference + '" ' +
        'stroke-linecap="round" transform="rotate(-90 ' + cx + ' ' + cy + ')" class="progress-circle" data-target-offset="' + targetOffset + '"/>';

    if (showText) {
      svg += '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dy="0.35em" fill="#ffffff" ' +
        'font-family="var(--font-mono)" font-size="0.75rem" font-weight="700">' + pct + '%</text>';
    }

    svg += '</svg>';
    return svg;
  }

  function updateOverallProgress() {
    const cards = document.querySelectorAll('.section-card');
    let totalTopics = 0;
    let passedTopics = 0;

    cards.forEach(function (card) {
      const section = card.getAttribute('data-section');
      const level = card.getAttribute('data-level');
      const status = getSectionStatus(section, level);
      totalTopics++;
      if (status && status.passed) {
        passedTopics++;
      }
    });

    const pct = totalTopics > 0 ? Math.round((passedTopics / totalTopics) * 100) : 0;
    const fill = document.getElementById('overallProgressFill');
    const score = document.getElementById('overallScore');
    const hint = document.getElementById('overallProgressHint');

    if (fill) {
      fill.style.width = pct + '%';
    }

    if (score) {
      animateCounter(score, 0, pct, 800);
    }

    if (hint) {
      if (pct === 0) {
        hint.textContent = 'Complete quizzes to earn achievements';
      } else if (pct < 50) {
        hint.textContent = 'Great start! Keep going!';
      } else if (pct < 80) {
        hint.textContent = 'You\'re making progress! Almost there!';
      } else if (pct < 100) {
        hint.textContent = 'Amazing! Just a few more to go!';
      } else {
        hint.textContent = 'Congratulations! You\'re a C# master!';
      }
    }
  }

  function animateCounter(element, start, end, duration) {
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      element.textContent = current + '%';

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  /* ---------- Init ---------- */
  initTheme();
  initSettings();
  initTutorial();
  updateCompletionBadges();
  updateOverallProgress();
})();
