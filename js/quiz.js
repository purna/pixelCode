(function () {
  'use strict';

  app.startQuiz = function (section, level) {
    app.state.level = level;
    app.state.section = section;
    app.state.quizVariant = ['A', 'B', 'C'][Math.floor(Math.random() * 3)];
    const path = 'data/' + section + '-quiz-' + app.state.quizVariant + '.json';
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
        app.state.data = json;
        app.state.index = 0;
        app.state.answers = {};
        app.state.score = 0;
        app.state.passed = false;
        app.el.sectionSelection.classList.add('hidden');
        app.el.resultsContainer.classList.add('hidden');
        app.el.quizContainer.classList.remove('hidden');
        app.state.pqLocked = false;
        app.startTimer();
        app.startPqTimer();
        app.renderQuestion();
      })
      .catch(function (err) {
        console.error(err);
        alert('Sorry, that section could not be loaded. (' + err.message + ')');
      });
  };

  app.renderQuestion = function () {
    app.state.selectedTileValue = null;
    const q = app.state.data.questions[app.state.index];
    const total = app.state.data.questions.length;

    app.el.progressBar.style.width = ((app.state.index) / total * 100) + '%';
    app.el.progressLabel.textContent = 'Question ' + (app.state.index + 1) + ' of ' + total;

    const card = document.createElement('div');
    card.className = 'question-card';

    const prompt = document.createElement('p');
    prompt.className = 'question-prompt';
    prompt.textContent = q.prompt;
    card.appendChild(prompt);

    if (q.type === 'pyramid') {
      app.renderPyramid(card, q);
    } else if (q.type === 'visual') {
      app.renderVisualOptions(card, q);
    } else if (q.type === 'cluster-missing') {
      app.renderClusterMissing(card, q);
    } else if (q.type === 'matrix-3x3') {
      app.renderMatrix3x3(card, q);
    } else if (q.type === 'typing') {
      app.renderTypingQuestion(card, q);
    } else if (q.type === 'insert') {
      app.renderInsertQuestion(card, q);
    } else if (q.type === 'dragorder') {
      app.renderDragOrder(card, q);
    } else if (q.type === 'coderunner') {
      app.renderCodeRunner(card, q);
    } else {
      app.renderTextOptions(card, q);
    }

    app.el.questionContainer.innerHTML = '';
    app.el.questionContainer.appendChild(card);

    app.el.prevBtn.disabled = app.state.index === 0;
    app.el.nextBtn.textContent = app.state.index === total - 1 ? 'Finish' : 'Next';
    app.resetPqTimer();
  };

  app.renderTextOptions = function (card, q) {
    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'options';

    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const isProfiled = q.type === 'profiled';
    const isMulti = Array.isArray(q.correctIndices);
    const saved = app.state.answers[q.id];
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
          const current = app.state.answers[q.id] || [];
          const idx = current.indexOf(i);
          if (idx === -1) {
            current.push(i);
          } else {
            current.splice(idx, 1);
          }
          app.state.answers[q.id] = current.sort(function (a, b) { return a - b; });
        } else {
          app.state.answers[q.id] = i;
        }
        app.renderQuestion();
      });
      optionsWrap.appendChild(option);
    });

    card.appendChild(optionsWrap);
  };

  app.renderTypingQuestion = function (card, q) {
    const saved = app.state.answers[q.id] || [];
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
        app.state.answers[q.id] = inputs.map(function (inp) { return inp.value; });
      });

      input.addEventListener('blur', function () {
        input.value = input.value.trim();
        app.state.answers[q.id] = inputs.map(function (inp) { return inp.value; });
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
          app.el.submitBtn.click();
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
  };

  app.renderInsertQuestion = function (card, q) {
    const saved = app.state.answers[q.id] || [];
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
        app.state.answers[q.id] = [i];
        app.renderQuestion();
      });
      optionsWrap.appendChild(btn);
    });

    wrap.appendChild(optionsWrap);
    card.appendChild(wrap);
  };

  app.renderDragOrder = function (card, q) {
    const saved = app.state.answers[q.id] || [];
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
    const order = saved.length === items.length ? saved : app.shuffleArray(items.map(function (_, i) { return i; }));

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
          app.state.answers[q.id] = newOrder;
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
          app.state.answers[q.id] = newOrder;
        }
      });
    }
  };

  app.renderVisualOptions = function (card, q) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const selected = app.state.answers[q.id];

    const seqRow = document.createElement('div');
    seqRow.className = 'visual-sequence';
    (q.sequence || []).forEach(function (desc) {
      const box = document.createElement('div');
      box.className = 'shape-box';
      box.appendChild(app.makeShapeCanvas(desc, 84));
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
      opt.appendChild(app.makeShapeCanvas(desc, 84));
      opt.addEventListener('click', function () {
        app.state.answers[q.id] = i;
        app.renderQuestion();
      });
      optionsGrid.appendChild(opt);
    });
    card.appendChild(optionsGrid);
  };

  app.renderClusterMissing = function (card, q) {
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
    const selected = app.state.answers[q.id];
    q.options.forEach(function (val, i) {
      const opt = document.createElement('button');
      opt.className = 'cluster-opt' + (selected === i ? ' selected' : '');
      opt.textContent = val;
      opt.addEventListener('click', function () {
        app.state.answers[q.id] = i;
        app.renderQuestion();
      });
      opts.appendChild(opt);
    });
    wrap.appendChild(opts);

    card.appendChild(wrap);
  };

  app.renderCodeRunner = function (card, q) {
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
      app.state.answers[q.id] = code;
      const result = app.simulateCSharp(code, q);
      output.textContent = result.output;
      output.style.color = result.ok ? 'var(--good)' : 'var(--bad)';
      output.style.borderColor = result.ok ? 'var(--good)' : 'var(--bad)';
    });

    resetBtn.addEventListener('click', function () {
      editor.value = q.starterCode || '';
      output.textContent = 'Output will appear here...';
      output.style.color = 'var(--ink-soft)';
      output.style.borderColor = 'var(--border)';
      app.state.answers[q.id] = q.starterCode || '';
    });

    card.appendChild(wrap);
  };

  app.simulateCSharp = function (code, q) {
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
  };

  app.renderMatrix3x3 = function (card, q) {
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
          app.drawMatrixCell(c, cell);
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
    const selected = app.state.answers[q.id];
    q.options.forEach(function (opt, i) {
      const optEl = document.createElement('div');
      optEl.className = 'matrix-opt' + (selected === i ? ' selected' : '');
      const c = document.createElement('canvas');
      c.width = 56;
      c.height = 56;
      app.drawMatrixCell(c, opt);
      optEl.appendChild(c);
      optEl.addEventListener('click', function () {
        app.state.answers[q.id] = i;
        app.renderQuestion();
      });
      opts.appendChild(optEl);
    });
    wrap.appendChild(opts);

    card.appendChild(wrap);
  };

  app.renderPyramid = function (card, q) {
    const container = document.createElement('div');
    container.className = 'pyramid-container';

    const grid = document.createElement('div');
    grid.className = 'pyramid-grid';

    let nullIdx = 0;
    let placed = app.state.answers[q.id];
    if (!Array.isArray(placed)) {
      placed = [];
      app.state.answers[q.id] = placed;
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
            if (app.state.pqLocked) cellEl.classList.add('locked');
          }
          nullIdx++;
        }

        if (!cellEl.classList.contains('filled') || cellEl.classList.contains('filled-user')) {
          cellEl.addEventListener('dragover', function (e) {
            e.preventDefault();
            if (cellEl.classList.contains('empty') || cellEl.classList.contains('filled-user')) {
              if (!app.state.pqLocked) cellEl.classList.add('drag-over');
            }
          });
          cellEl.addEventListener('dragleave', function () {
            cellEl.classList.remove('drag-over');
          });
          cellEl.addEventListener('drop', function (e) {
            e.preventDefault();
            cellEl.classList.remove('drag-over');
            if (app.state.pqLocked) return;
            const val = parseInt(e.dataTransfer.getData('text/plain'), 10);
            const idx = parseInt(cellEl.dataset.nullIdx, 10);
            placed[idx] = val;
            app.state.answers[q.id] = placed;
            cellEl.textContent = val;
            cellEl.classList.remove('empty');
            cellEl.classList.add('filled-user');
            app.renderPyramidTiles(card, q, placed);
            app.updatePyramidCheckBtn(container, q, placed);
          });
          cellEl.addEventListener('click', function () {
            if (app.state.pqLocked) return;
            if (cellEl.classList.contains('filled-user')) {
              const idx = parseInt(cellEl.dataset.nullIdx, 10);
              placed[idx] = undefined;
              cellEl.textContent = '';
              cellEl.classList.add('empty');
              cellEl.classList.remove('filled-user');
              app.renderPyramidTiles(card, q, placed);
              app.updatePyramidCheckBtn(container, q, placed);
            } else if (app.state.selectedTileValue !== null && app.state.selectedTileValue !== undefined) {
              const idx = parseInt(cellEl.dataset.nullIdx, 10);
              placed[idx] = app.state.selectedTileValue;
              app.state.answers[q.id] = placed;
              cellEl.textContent = app.state.selectedTileValue;
              cellEl.classList.remove('empty');
              cellEl.classList.add('filled-user');
              app.renderPyramidTiles(card, q, placed);
              app.updatePyramidCheckBtn(container, q, placed);
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
    app.renderPyramidTiles(tilesWrap, q, placed);
    container.appendChild(tilesWrap);

    app.updatePyramidCheckBtn(container, q, placed);

    card.appendChild(container);
  };

  app.renderPyramidTiles = function (parent, q, placed) {
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

      const placedCount = app.countValue(placed, value) || 0;
      if (placedCount >= (tileCount[value] || 1)) tile.classList.add('used');
      if (app.state.pqLocked) tile.classList.add('locked');

      tile.addEventListener('dragstart', function (e) {
        if (app.state.pqLocked) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', String(value));
        tile.classList.add('dragging');
      });
      tile.addEventListener('dragend', function () {
        tile.classList.remove('dragging');
      });
      tile.addEventListener('click', function () {
        if (app.state.pqLocked) return;
        app.state.selectedTileValue = value;
        const allTiles = parent.querySelectorAll('.pyramid-tile');
        allTiles.forEach(function (t) {
          t.classList.toggle('selected', t === tile);
        });
      });

      tilesEl.appendChild(tile);
    });
  };

  app.updatePyramidCheckBtn = function (container, q, placed) {
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
      app.checkPyramid(q, placed);
    });
    container.appendChild(checkBtn);
  };

  app.checkPyramid = function (q, placed) {
    const correct = app.checkPyramidAnswer(q, placed);
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
  };

  app.renderPyramidReview = function (item, q) {
    const userPlaced = app.state.answers[q.id] || [];
    const correct = app.checkPyramidAnswer(q, userPlaced);

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
  };

  app.renderMatrixReview = function (item, q) {
    const userIdx = app.state.answers[q.id];
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
          app.drawMatrixCell(cv, cell);
          cellEl.appendChild(cv);
        } else if (userIdx !== undefined && userIdx >= 0) {
          const opt = q.options[userIdx];
          const isCorrect = userIdx === q.answerIndex;
          cellEl.classList.add(isCorrect ? 'matrix-cell-correct' : 'matrix-cell-incorrect');
          const cv = document.createElement('canvas');
          cv.width = 48;
          cv.height = 48;
          app.drawMatrixCell(cv, opt);
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
      app.drawMatrixCell(yourCanvas, q.options[userIdx]);
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
      app.drawMatrixCell(correctCanvas, q.options[q.answerIndex]);
      answerRow.appendChild(correctCanvas);
    }

    wrap.appendChild(answerRow);
    item.appendChild(wrap);
  };

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
})();
