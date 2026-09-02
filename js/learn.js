(function () {
  'use strict';

  app.startLearn = function (section, level) {
    app.state.level = level;
    const path = 'data/' + section + '-learn.json';
    fetch(path)
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load ' + path);
        return res.json();
      })
      .then(function (json) {
        app.state.learnData = json;
        const saved = app.getLearnProgress(section, level);
        app.state.learnIndex = (saved && saved.lastSlide !== undefined) ? saved.lastSlide : 0;
        app.state.section = section;
        app.el.sectionSelection.classList.add('hidden');
        app.el.resultsContainer.classList.add('hidden');
        app.el.quizContainer.classList.add('hidden');
        app.el.learnScreen.classList.remove('hidden');
        app.renderLearnSlide();
      })
      .catch(function (err) {
        console.error(err);
        alert('Sorry, learning content could not be loaded. (' + err.message + ')');
      });
  };

  app.renderLearnSlide = function () {
    const data = app.state.learnData;
    if (!data) return;
    const slide = data.slides[app.state.learnIndex];
    if (!slide) {
      app.el.learnScreen.classList.add('hidden');
      app.el.sectionSelection.classList.remove('hidden');
      return;
    }

    app.el.learnTitle.textContent = data.title || 'Learn';
    app.el.learnProgress.textContent = 'Slide ' + (app.state.learnIndex + 1) + ' of ' + data.slides.length;
    app.el.learnSlideTitle.textContent = slide.title || '';
    app.el.learnSlideContent.textContent = slide.content || '';

    if (slide.example) {
      app.el.learnSlideExample.textContent = slide.example;
      app.el.learnSlideExample.classList.remove('hidden');
    } else {
      app.el.learnSlideExample.classList.add('hidden');
    }

    if (slide.exampleOutput) {
      app.el.learnSlideOutput.textContent = 'Output: ' + slide.exampleOutput;
      app.el.learnSlideOutput.classList.remove('hidden');
    } else {
      app.el.learnSlideOutput.classList.add('hidden');
    }

    if (slide.exercise) {
      app.el.exerciseContainer.classList.remove('hidden');
      app.el.exercisePrompt.textContent = slide.exercise.prompt || '';
      app.el.exerciseFeedback.textContent = '';
      app.el.exerciseFeedback.className = 'exercise-feedback';
      app.el.exerciseCheckBtn.classList.remove('hidden');
      app.renderLearnExercise(slide.exercise);
    } else {
      app.el.exerciseContainer.classList.add('hidden');
      app.el.exerciseArea.innerHTML = '';
    }

    if (slide.execution) {
      app.el.exerciseContainer.classList.remove('hidden');
      app.renderExecutionPlayer(slide.execution);
    }

    if (slide.flow) {
      app.el.exerciseContainer.classList.remove('hidden');
      app.renderFlowDiagram(slide.flow);
    }

    app.el.learnPrevBtn.disabled = app.state.learnIndex === 0;
    app.el.learnNextBtn.textContent = app.state.learnIndex === data.slides.length - 1 ? 'Start Quiz' : 'Next';

    app.saveLearnProgress(app.state.section, app.state.level, app.state.learnIndex, app.state.learnIndex === data.slides.length - 1, data.slides.length);
  };

  app.renderLearnExercise = function (exercise) {
    app.el.exerciseArea.innerHTML = '';
    if (exercise.type === 'flowbuilder') {
      app.renderFlowBuilderExercise(exercise);
    } else if (exercise.type === 'dragdrop') {
      app.renderLearnDragDrop(exercise);
    } else if (exercise.type === 'multiplechoice') {
      app.renderLearnMultipleChoice(exercise);
    } else if (exercise.type === 'fillblank') {
      app.renderLearnFillBlank(exercise);
    } else if (exercise.type === 'code') {
      app.renderLearnCode(exercise);
    }
  };

  app.renderLearnMultipleChoice = function (exercise) {
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
          app.el.exerciseFeedback.textContent = 'Correct! Well done!';
          app.el.exerciseFeedback.className = 'exercise-feedback correct';
          app.el.exerciseCheckBtn.classList.add('hidden');
        } else {
          btn.classList.add('wrong');
          app.el.exerciseFeedback.textContent = 'Not quite. Try again!';
          app.el.exerciseFeedback.className = 'exercise-feedback wrong';
        }
      });
      options.appendChild(btn);
    });
    wrap.appendChild(options);
    app.el.exerciseArea.appendChild(wrap);
  };

  app.renderLearnFillBlank = function (exercise) {
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

    app.el.exerciseCheckBtn.onclick = function () {
      const userAnswer = input.value.trim();
      const correctAnswer = exercise.answer || '';
      const isCorrect = exercise.caseSensitive ? userAnswer === correctAnswer : userAnswer.toLowerCase() === correctAnswer.toLowerCase();

      if (!userAnswer) {
        app.el.exerciseFeedback.textContent = 'Please enter an answer.';
        app.el.exerciseFeedback.className = 'exercise-feedback wrong';
        return;
      }

      if (isCorrect) {
        input.style.borderColor = 'var(--good)';
        input.style.background = 'var(--good-soft)';
        const praises = ['Correct! Well done!', 'You got it!', 'Excellent!', 'Spot on!', 'Brilliant!'];
        app.el.exerciseFeedback.textContent = praises[Math.floor(Math.random() * praises.length)];
        app.el.exerciseFeedback.className = 'exercise-feedback correct';
        app.el.exerciseCheckBtn.classList.add('hidden');
      } else {
        input.style.borderColor = 'var(--bad)';
        input.style.background = 'var(--bad-soft)';
        app.el.exerciseFeedback.textContent = 'Not quite. Try again!';
        app.el.exerciseFeedback.className = 'exercise-feedback wrong';
      }
    };

    wrap.appendChild(input);
    app.el.exerciseArea.appendChild(wrap);
    input.focus();
  };

  app.renderLearnDragDrop = function (exercise) {
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

    app.el.exerciseCheckBtn.onclick = function () {
      const selected = blank.dataset.selected;
      if (!selected) {
        app.el.exerciseFeedback.textContent = 'Please select an option.';
        app.el.exerciseFeedback.className = 'exercise-feedback wrong';
        return;
      }
      if (selected === exercise.answer) {
        const praises = ['Correct! Well done!', 'You got it!', 'Excellent!', 'Spot on!', 'Brilliant!'];
        app.el.exerciseFeedback.textContent = praises[Math.floor(Math.random() * praises.length)];
        app.el.exerciseFeedback.className = 'exercise-feedback correct';
        app.el.exerciseCheckBtn.classList.add('hidden');
      } else {
        app.el.exerciseFeedback.textContent = 'Not quite. Try again!';
        app.el.exerciseFeedback.className = 'exercise-feedback wrong';
      }
    };

    app.el.exerciseArea.appendChild(wrap);
  };

  app.renderLearnCode = function (exercise) {
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

    app.el.exerciseCheckBtn.textContent = 'Run Code';
    app.el.exerciseCheckBtn.onclick = function () {
      const code = editor.value;
      const result = app.simulateCSharp(code, exercise);
      output.textContent = result.output;
      output.style.color = result.ok ? 'var(--good)' : 'var(--bad)';
      output.style.borderColor = result.ok ? 'var(--good)' : 'var(--bad)';

      if (result.ok) {
        const praises = ['Correct! Well done!', 'You got it!', 'Excellent!', 'Spot on!', 'Brilliant!'];
        app.el.exerciseFeedback.textContent = praises[Math.floor(Math.random() * praises.length)];
        app.el.exerciseFeedback.className = 'exercise-feedback correct';
      } else {
        app.el.exerciseFeedback.textContent = 'Not quite. Try again!';
        app.el.exerciseFeedback.className = 'exercise-feedback wrong';
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

    app.el.exerciseArea.appendChild(wrap);
  };

  app.renderExecutionPlayer = function (execution) {
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
    app.el.exerciseArea.appendChild(wrap);
  };

  app.renderFlowBuilderExercise = function (exercise) {
    const wrap = document.createElement('div');
    wrap.className = 'flowbuilder-exercise';

    const container = document.createElement('div');
    container.style.height = '620px';
    wrap.appendChild(container);

    app.el.exerciseArea.appendChild(wrap);

    const examples = exercise.examples
      || (exercise.flowExample ? [exercise.flowExample] : []);

    const fb = new FlowBuilder(container, {
      // Lessons always begin with a blank canvas. The configured flow remains
      // available through the explicit example selector instead of being
      // inserted before the learner has made a choice.
      flow: { flow: [], selectedId: null },
      expectedCode: exercise.expectedCode || '',
      examples: examples,
      blocksToShow: exercise.blocksToShow || null
    });

    app.el.exerciseCheckBtn.textContent = 'Check Answer';
    app.el.exerciseCheckBtn.onclick = function () {
      fb.showCompare();
    };

    if (exercise.expectedCode) {
      const hint = document.createElement('p');
      hint.style.marginTop = '0.5rem';
      hint.style.fontSize = '0.8rem';
      hint.style.color = 'var(--ink-soft)';
      hint.textContent = 'Use the Compare tab inside the Flow Builder to check your code against the expected output.';
      wrap.appendChild(hint);
    }
  };

  app.renderFlowDiagram = function (flow) {
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
    app.el.exerciseArea.appendChild(wrap);
  };

  app.el.learnPrevBtn.addEventListener('click', function () {
    if (app.state.learnIndex > 0) {
      app.state.learnIndex--;
      app.renderLearnSlide();
    }
  });

  app.el.learnNextBtn.addEventListener('click', function () {
    const data = app.state.learnData;
    if (app.state.learnIndex < data.slides.length - 1) {
      app.state.learnIndex++;
      app.renderLearnSlide();
    } else {
      app.el.learnScreen.classList.add('hidden');
      app.startQuiz(app.state.section, app.state.level);
    }
  });

  app.el.learnSkipBtn.addEventListener('click', function () {
    app.el.learnScreen.classList.add('hidden');
    app.startQuiz(app.state.section, app.state.level);
  });
})();
