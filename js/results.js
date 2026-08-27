(function () {
  'use strict';

  app.showResults = function () {
    app.stopPqTimer();
    app.el.pqTimerDisplay.classList.add('hidden');
    app.state.pqLocked = false;
    app.el.quizContainer.classList.add('hidden');
    app.el.resultsContainer.classList.add('hidden');
    app.el.timerDisplay.classList.add('hidden');

    const questions = app.state.data.questions;
    const isProfiled = questions[0] && questions[0].type === 'profiled';

    const wrap = document.createElement('div');

    if (isProfiled) {
      app.renderProfiledResults(wrap, questions);
    } else {
      app.renderScoredResults(wrap, questions);
    }

    app.updateCompletionBadges();
    app.updateOverallProgress();

    const actions = document.createElement('div');
    actions.className = 'results-actions';

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = 'Back to sections';
    backBtn.addEventListener('click', function () {
      app.el.resultsContainer.classList.add('hidden');
      app.el.sectionSelection.classList.remove('hidden');
      app.updateCompletionBadges();
      app.updateOverallProgress();
    });

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn';
    retryBtn.textContent = 'Retry this section';
    retryBtn.addEventListener('click', function () {
      app.startQuiz(app.state.section, app.state.level);
    });

    actions.appendChild(retryBtn);
    actions.appendChild(backBtn);
    wrap.appendChild(actions);

    app.el.resultsContainer.innerHTML = '';
    app.el.resultsContainer.appendChild(wrap);
    app.el.resultsContainer.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  app.renderScoredResults = function (wrap, questions) {
    let correct = 0;
    questions.forEach(function (q) {
      if (q.type === 'pyramid') {
        if (app.checkPyramidAnswer(q, app.state.answers[q.id])) correct++;
      } else if (q.type === 'typing') {
        const user = app.state.answers[q.id] || [];
        const expected = q.blanks || [];
        if (user.length === expected.length && expected.every(function (v, i) { return String(user[i]).trim().toLowerCase() === String(v).trim().toLowerCase(); })) {
          correct++;
        }
      } else if (q.type === 'dragorder') {
        const user = app.state.answers[q.id] || [];
        const expected = q.solution || [];
        if (JSON.stringify(user) === JSON.stringify(expected)) correct++;
      } else if (q.type === 'coderunner') {
        const code = app.state.answers[q.id] || '';
        const result = app.simulateCSharp(code, q);
        if (result.ok) correct++;
      } else if (q.type === 'insert') {
        const user = (app.state.answers[q.id] || [])[0];
        if (user === q.answerIndex) correct++;
      } else if (Array.isArray(q.correctIndices)) {
        const user = (app.state.answers[q.id] || []).sort(function (a, b) { return a - b; });
        const expected = q.correctIndices.slice().sort(function (a, b) { return a - b; });
        if (JSON.stringify(user) === JSON.stringify(expected)) correct++;
      } else if (app.state.answers[q.id] === q.answerIndex) {
        correct++;
      }
    });
    const pct = Math.round((correct / questions.length) * 100);
    app.state.score = pct;
    app.state.passed = pct >= 80;
    app.state.correct = correct;
    app.state.total = questions.length;

    app.saveQuizResult(app.state.section, app.state.level, app.state.quizVariant, pct, correct, questions.length);

    const hero = document.createElement('div');
    hero.className = 'results-hero';
    const passBadge = app.state.passed
      ? '<span class="pass-badge">PASS</span>'
      : '<span class="fail-badge">FAIL</span>';
    hero.innerHTML =
      '<p class="settings-hint" style="margin:0;">' + app.sectionTitle() + '</p>' +
      passBadge +
      '<p class="results-score">' + pct + '%</p>' +
      '<p class="results-sub">' + correct + ' of ' + questions.length + ' correct</p>';
    wrap.appendChild(hero);

    const reviewHeading = document.createElement('h2');
    reviewHeading.textContent = 'Review';
    wrap.appendChild(reviewHeading);

    questions.forEach(function (q, i) {
      const userAnswers = app.state.answers[q.id];
      const isPyramid = q.type === 'pyramid';
      const isVisualType = q.type === 'visual' || q.type === 'matrix-3x3';

      let gotIt = false;
      if (isPyramid) {
        gotIt = app.checkPyramidAnswer(q, userAnswers);
      } else if (q.type === 'typing') {
        const user = userAnswers || [];
        const expected = q.blanks || [];
        gotIt = user.length === expected.length && expected.every(function (v, idx) { return String(user[idx]).trim().toLowerCase() === String(v).trim().toLowerCase(); });
      } else if (q.type === 'dragorder') {
        gotIt = JSON.stringify(userAnswers || []) === JSON.stringify(q.solution || []);
      } else if (q.type === 'coderunner') {
        gotIt = app.simulateCSharp(userAnswers || '', q).ok;
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
        app.renderPyramidReview(item, q);
      } else if (q.type === 'matrix-3x3') {
        app.renderMatrixReview(item, q);
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
            yourBox.appendChild(app.makeShapeCanvas(q.options[userAnswers], 56));
            const yourLabel = document.createElement('span');
            yourLabel.textContent = 'Yours';
            yourBox.appendChild(yourLabel);
            thumbs.appendChild(yourBox);
          }
          if (!gotIt) {
            const correctBox = document.createElement('div');
            correctBox.className = 'review-thumb';
            correctBox.appendChild(app.makeShapeCanvas(q.options[q.answerIndex], 56));
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
  };

  app.renderProfiledResults = function (wrap, questions) {
    const traits = app.state.data.meta.traits || {};
    const tally = {};
    Object.keys(traits).forEach(function (k) { tally[k] = 0; });

    questions.forEach(function (q) {
      const idx = app.state.answers[q.id];
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
      '<p class="settings-hint" style="margin:0;">' + app.sectionTitle() + '</p>' +
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
  };
})();
