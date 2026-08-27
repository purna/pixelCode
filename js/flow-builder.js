/*
 * FlowBuilder — drag-free visual flowchart editor that compiles to a small
 * C#-like pseudocode subset, with a step-through debugger and a code
 * comparison view.
 *
 * Usage:
 *   const fb = new FlowBuilder(containerEl, {
 *     flow: { flow: [ ...nodes ], selectedId: null },
 *     expectedCode: 'int i;\n...',   // optional — powers the Compare tab
 *     examples: [ { name: 'For Loop', flow: { flow: [...], selectedId: null } } ], // optional
 *     blocksToShow: ['declare', 'assign', 'output', 'while']                        // optional — restricts the palette
 *   });
 *
 * This file is self-contained: it injects its own <style> block once per
 * page, so it works both standalone (flow-builder.html) and embedded inside
 * the quiz app's exercise area (learn.js), without depending on styles.css.
 */
class FlowBuilder {
  static _NODE_KINDS = ['declare', 'assign', 'input', 'output', 'if', 'switch', 'while', 'do', 'for', 'foreach', 'call', 'comment'];
  static _CONTAINER_KINDS = ['if', 'switch', 'while', 'do', 'for', 'foreach'];
  static _KIND_LABELS = {
    declare: 'Declare', assign: 'Assign', input: 'Input', output: 'Output',
    if: 'If', switch: 'Switch', while: 'While', do: 'Do...While',
    for: 'For', foreach: 'Foreach', call: 'Call', comment: 'Comment'
  };

  constructor(root, options) {
    options = options || {};
    this.root = root;
    this.flowRoot = (options.flow && Array.isArray(options.flow.flow))
      ? JSON.parse(JSON.stringify(options.flow.flow))
      : [];
    this.selectedId = (options.flow && options.flow.selectedId) || null;
    this.expectedCode = options.expectedCode || '';
    this.examples = Array.isArray(options.examples) ? options.examples : [];
    this.blocksToShow = Array.isArray(options.blocksToShow) && options.blocksToShow.length
      ? options.blocksToShow
      : null;

    this._idCounter = 0;
    this.steps = [];
    this.currentStep = -1;
    this.playing = false;
    this.playHandle = null;
    this.nodeHeaderEls = {};
    this.coreLinesCache = [];
    this.codeLinesCache = [];
    this._budget = 4000;

    FlowBuilder._injectStyles();
    this._buildUI();
    this.rerenderAll();
  }

  /* ---------- one-time global styles ---------- */

  static _injectStyles() {
    if (document.getElementById('flow-builder-styles')) return;
    const style = document.createElement('style');
    style.id = 'flow-builder-styles';
    style.textContent = `
.fb-root { display: flex; flex-direction: column; gap: 0.75rem; height: 100%; min-height: 0;
  font-family: var(--font-body); color: var(--ink); }
.fb-toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.fb-toolbar select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface); color: inherit; font-size: 0.82rem; }
.fb-add-btn { padding: 0.3rem 0.6rem; border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface); color: inherit; font-size: 0.78rem; cursor: pointer; }
.fb-add-btn:hover { background: var(--surface-raised); }
.fb-main { display: flex; gap: 0.75rem; flex: 1; min-height: 220px; }
.fb-canvas-col { flex: 1.4; min-width: 0; overflow: auto; border: 1px solid var(--border);
  border-radius: 8px; padding: 0.6rem; background: var(--bg); }
.fb-props-col { flex: 1; min-width: 220px; max-width: 320px; overflow: auto;
  border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem;
  background: var(--surface); }
.fb-props-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.03em; color: var(--ink-soft); margin-bottom: 0.5rem; }
.fb-empty-hint { color: var(--ink-soft); font-size: 0.82rem; }
.fb-seq { display: flex; flex-direction: column; gap: 0.35rem; }
.fb-seq.fb-seq-root { min-height: 40px; }
.flow-block { border: 1px solid var(--border); border-radius: 6px; background: var(--surface); }
.flow-block.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.flow-block.active-step { border-color: var(--good); box-shadow: 0 0 0 1px var(--good); }
.fb-block-header { display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.5rem;
  cursor: pointer; font-family: var(--font-mono); font-size: 0.78rem; }
.fb-block-header .fb-kind-tag { font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  padding: 0.05rem 0.35rem; border-radius: 4px; background: var(--accent-soft); color: var(--accent); }
.fb-block-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-block-moves { display: flex; gap: 0.15rem; }
.fb-move-btn { border: none; background: none; cursor: pointer; font-size: 0.7rem; color: var(--ink-soft);
  padding: 0 0.15rem; line-height: 1; }
.fb-move-btn:hover { color: var(--ink); }
.fb-block-body { margin: 0 0.5rem 0.5rem 1rem; padding-left: 0.5rem;
  border-left: 2px dashed var(--border); display: flex; flex-direction: column; gap: 0.35rem; }
.fb-add-into-body { align-self: flex-start; font-size: 0.7rem; padding: 0.15rem 0.4rem; margin-top: 0.1rem; }
.field-row { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.5rem; font-size: 0.78rem; }
.field-row label { font-weight: 600; color: var(--ink-soft); }
.field-row input[type="text"], .field-row select { padding: 0.3rem 0.4rem; border-radius: 5px;
  border: 1px solid var(--border); background: var(--surface); color: inherit; font-size: 0.8rem; }
.field-2col { display: flex; gap: 0.5rem; }
.field-2col .field-row { flex: 1; }
.fb-checkbox-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; margin-bottom: 0.5rem; }
.fb-btn { padding: 0.35rem 0.7rem; border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface); color: var(--ink); font-size: 0.8rem; cursor: pointer; }
.fb-btn:hover { background: var(--surface-raised); }
.fb-btn-danger { border-color: var(--bad); color: var(--bad); background: none; }
.fb-btn-danger:hover { background: var(--bad-soft); }
.fb-output { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.fb-tabs { display: flex; border-bottom: 1px solid var(--border); background: var(--surface); }
.tab-btn { padding: 0.45rem 0.9rem; border: none; background: none; cursor: pointer; font-size: 0.8rem;
  color: var(--ink-soft); border-bottom: 2px solid transparent; }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.tab-panel { display: none; padding: 0.6rem; }
.tab-panel.active { display: block; }
.fb-code-view { margin: 0; font-family: var(--font-mono); font-size: 0.8rem;
  white-space: pre; overflow: auto; max-height: 260px; }
.code-line { display: block; padding: 0 0.25rem; }
.code-line.active { background: var(--accent-soft); }
.fb-run-controls { display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; }
.fb-run-step-label { font-family: var(--font-mono); font-size: 0.78rem; color: var(--ink-soft); }
.fb-run-desc { font-size: 0.8rem; margin-bottom: 0.5rem; min-height: 1.2em; }
.fb-run-columns { display: flex; gap: 0.75rem; }
.fb-vars-view { flex: 1; min-width: 0; }
.var-row { display: flex; justify-content: space-between; gap: 0.5rem; font-family: var(--font-mono);
  font-size: 0.78rem; padding: 0.1rem 0; border-bottom: 1px dashed var(--border); }
.var-name { color: var(--ink-soft); }
.var-value { font-weight: 600; }
.fb-console-view { flex: 1; min-width: 0; font-family: var(--font-mono);
  font-size: 0.78rem; white-space: pre-wrap; background: var(--bg); color: var(--ink); border-radius: 6px;
  padding: 0.4rem; min-height: 60px; max-height: 200px; overflow: auto; }
.fb-compare-cols { display: flex; gap: 0.75rem; }
.fb-compare-col { flex: 1; min-width: 0; }
.fb-compare-col h4 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--ink-soft); margin-bottom: 0.3rem; }
.fb-compare-col pre { margin: 0; font-family: var(--font-mono); font-size: 0.78rem;
  white-space: pre-wrap; max-height: 220px; overflow: auto; border: 1px solid var(--border);
  border-radius: 6px; padding: 0.4rem; }
.fb-compare-status { font-size: 0.82rem; font-weight: 700; margin-bottom: 0.5rem; }
.fb-compare-status.match { color: var(--good); }
.fb-compare-status.mismatch { color: var(--bad); }
`;
    document.head.appendChild(style);
  }

  /* ---------- UI construction ---------- */

  _buildUI() {
    this.root.innerHTML = '';
    this.root.classList.add('fb-root');

    // Toolbar: examples dropdown + add-block buttons
    const toolbar = document.createElement('div');
    toolbar.className = 'fb-toolbar';

    if (this.examples.length) {
      const sel = document.createElement('select');
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Load example…';
      sel.appendChild(placeholder);
      this.examples.forEach((ex, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = ex.name || ('Example ' + (i + 1));
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        if (sel.value === '') return;
        this._loadExample(this.examples[Number(sel.value)]);
        sel.value = '';
      });
      toolbar.appendChild(sel);
    }

    const kinds = this.blocksToShow || FlowBuilder._NODE_KINDS;
    kinds.forEach(kind => {
      if (!FlowBuilder._KIND_LABELS[kind]) return;
      const btn = document.createElement('button');
      btn.className = 'fb-add-btn';
      btn.type = 'button';
      btn.textContent = '+ ' + FlowBuilder._KIND_LABELS[kind];
      btn.addEventListener('click', () => this._addNode(kind));
      toolbar.appendChild(btn);
    });

    // Main: canvas + props panel
    const main = document.createElement('div');
    main.className = 'fb-main';

    const canvasCol = document.createElement('div');
    canvasCol.className = 'fb-canvas-col';
    const canvas = document.createElement('div');
    canvas.className = 'fb-canvas';
    canvasCol.appendChild(canvas);

    const propsCol = document.createElement('div');
    propsCol.className = 'fb-props-col';
    const propsTitle = document.createElement('div');
    propsTitle.className = 'fb-props-title';
    propsTitle.textContent = 'Block properties';
    const propsPanel = document.createElement('div');
    propsPanel.className = 'fb-props-panel';
    propsCol.appendChild(propsTitle);
    propsCol.appendChild(propsPanel);

    main.appendChild(canvasCol);
    main.appendChild(propsCol);

    // Output: tabs (Code / Run / Compare)
    const output = document.createElement('div');
    output.className = 'fb-output';

    const tabs = document.createElement('div');
    tabs.className = 'fb-tabs';
    const tabDefs = [['code', 'Code'], ['run', 'Run'], ['compare', 'Compare']];
    tabDefs.forEach(([name, label], i) => {
      const tabBtn = document.createElement('button');
      tabBtn.className = 'tab-btn' + (i === 0 ? ' active' : '');
      tabBtn.type = 'button';
      tabBtn.dataset.tab = name;
      tabBtn.textContent = label;
      tabBtn.addEventListener('click', () => this._switchTab(name));
      tabs.appendChild(tabBtn);
    });

    const codePanel = document.createElement('div');
    codePanel.className = 'tab-panel active';
    codePanel.dataset.tab = 'code';
    const codeView = document.createElement('pre');
    codeView.className = 'fb-code-view';
    codePanel.appendChild(codeView);

    const runPanel = document.createElement('div');
    runPanel.className = 'tab-panel';
    runPanel.dataset.tab = 'run';

    const runControls = document.createElement('div');
    runControls.className = 'fb-run-controls';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'fb-btn';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'fb-btn';
    prevBtn.type = 'button';
    prevBtn.textContent = '◀ Step Back';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'fb-btn';
    nextBtn.type = 'button';
    nextBtn.textContent = 'Step ▶';
    const playBtn = document.createElement('button');
    playBtn.className = 'fb-btn';
    playBtn.type = 'button';
    playBtn.textContent = 'Play';
    const stepLabel = document.createElement('span');
    stepLabel.className = 'fb-run-step-label';
    runControls.appendChild(resetBtn);
    runControls.appendChild(prevBtn);
    runControls.appendChild(nextBtn);
    runControls.appendChild(playBtn);
    runControls.appendChild(stepLabel);

    const stepDesc = document.createElement('div');
    stepDesc.className = 'fb-run-desc';

    const runColumns = document.createElement('div');
    runColumns.className = 'fb-run-columns';
    const varsView = document.createElement('div');
    varsView.className = 'fb-vars-view';
    const consoleView = document.createElement('pre');
    consoleView.className = 'fb-console-view';
    runColumns.appendChild(varsView);
    runColumns.appendChild(consoleView);

    runPanel.appendChild(runControls);
    runPanel.appendChild(stepDesc);
    runPanel.appendChild(runColumns);

    const comparePanel = document.createElement('div');
    comparePanel.className = 'tab-panel';
    comparePanel.dataset.tab = 'compare';
    const compareStatus = document.createElement('div');
    compareStatus.className = 'fb-compare-status';
    const compareCols = document.createElement('div');
    compareCols.className = 'fb-compare-cols';
    const expectedCol = document.createElement('div');
    expectedCol.className = 'fb-compare-col';
    expectedCol.innerHTML = '<h4>Expected</h4>';
    const expectedPre = document.createElement('pre');
    expectedCol.appendChild(expectedPre);
    const actualCol = document.createElement('div');
    actualCol.className = 'fb-compare-col';
    actualCol.innerHTML = '<h4>Your code</h4>';
    const actualPre = document.createElement('pre');
    actualCol.appendChild(actualPre);
    compareCols.appendChild(expectedCol);
    compareCols.appendChild(actualCol);
    comparePanel.appendChild(compareStatus);
    comparePanel.appendChild(compareCols);

    output.appendChild(tabs);
    output.appendChild(codePanel);
    output.appendChild(runPanel);
    output.appendChild(comparePanel);

    this.root.appendChild(toolbar);
    this.root.appendChild(main);
    this.root.appendChild(output);

    this.els = {
      canvas, propsPanel,
      codeView, playBtn, stepLabel, stepDesc, varsView, consoleView,
      resetBtn, prevBtn, nextBtn,
      compareStatus, expectedPre, actualPre
    };

    resetBtn.addEventListener('click', () => this._resetRun());
    prevBtn.addEventListener('click', () => this._prevStep());
    nextBtn.addEventListener('click', () => this._nextStep());
    playBtn.addEventListener('click', () => {
      if (this.playing) this.stopPlay();
      else this._startPlay();
    });
  }

  /* ---------- node id / factory helpers ---------- */

  _newId() {
    this._idCounter++;
    return 'node_' + this._idCounter + '_' + Math.random().toString(36).slice(2, 7);
  }

  _defaultNode(kind) {
    const id = this._newId();
    switch (kind) {
      case 'declare': return { id, kind, name: 'x', dataType: 'Integer', structure: 'Scalar', size: '5' };
      case 'assign': return { id, kind, name: 'x', dataType: 'Integer', structure: 'Scalar', index: '0', row: '0', col: '0', expression: '0' };
      case 'comment': return { id, kind, text: 'comment' };
      case 'call': return { id, kind, procedureName: 'DoSomething', arguments: '' };
      case 'input': return { id, kind, variable: 'x', dataType: 'Integer', testValue: '0' };
      case 'output': return { id, kind, expression: '"Hello"', newline: true };
      case 'if': return { id, kind, condition: 'true', body: [] };
      case 'switch': return { id, kind, expression: 'x', caseValue: '0', isDefault: false, body: [] };
      case 'while': return { id, kind, condition: 'i < 10', body: [] };
      case 'do': return { id, kind, condition: 'i < 10', body: [] };
      case 'for': return { id, kind, variable: 'i', start: '0', end: '10', direction: 'Increasing', step: '1', body: [] };
      case 'foreach': return { id, kind, variable: 'item', collection: 'items', body: [] };
      default: return { id, kind };
    }
  }

  _isContainerKind(kind) {
    return FlowBuilder._CONTAINER_KINDS.indexOf(kind) !== -1;
  }

  /* ---------- tree search helpers ---------- */

  _findNode(id, seq) {
    seq = seq || this.flowRoot;
    for (const node of seq) {
      if (node.id === id) return node;
      if (node.body) {
        const found = this._findNode(id, node.body);
        if (found) return found;
      }
    }
    return null;
  }

  // Returns { arr, index } locating id's position within whichever array holds it.
  _findLocation(id, seq) {
    seq = seq || this.flowRoot;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i].id === id) return { arr: seq, index: i };
      if (seq[i].body) {
        const found = this._findLocation(id, seq[i].body);
        if (found) return found;
      }
    }
    return null;
  }

  /* ---------- node CRUD ---------- */

  _addNode(kind) {
    const node = this._defaultNode(kind);
    let targetArr = this.flowRoot;
    if (this.selectedId) {
      const selected = this._findNode(this.selectedId);
      if (selected && this._isContainerKind(selected.kind)) {
        targetArr = selected.body;
      }
    }
    targetArr.push(node);
    this.selectedId = node.id;
    this.rerenderAll();
  }

  _addIntoBody(containerId, kind) {
    const container = this._findNode(containerId);
    if (!container || !container.body) return;
    const node = this._defaultNode(kind);
    container.body.push(node);
    this.selectedId = node.id;
    this.rerenderAll();
  }

  _deleteNode(id) {
    const loc = this._findLocation(id);
    if (!loc) return;
    loc.arr.splice(loc.index, 1);
    if (this.selectedId === id) this.selectedId = null;
    this.rerenderAll();
  }

  _moveNode(id, dir) {
    const loc = this._findLocation(id);
    if (!loc) return;
    const newIndex = loc.index + dir;
    if (newIndex < 0 || newIndex >= loc.arr.length) return;
    const [node] = loc.arr.splice(loc.index, 1);
    loc.arr.splice(newIndex, 0, node);
    this.rerenderAll();
  }

  _selectNode(id) {
    this.selectedId = id;
    this._rerenderCanvasSelectionOnly();
    this._renderPropsPanel();
  }

  _loadExample(example) {
    if (!example || !example.flow) return;
    this.flowRoot = JSON.parse(JSON.stringify(example.flow.flow || []));
    this.selectedId = example.flow.selectedId || null;
    this.rerenderAll();
  }

  /* ---------- canvas rendering ---------- */

  _blockLabel(node) {
    switch (node.kind) {
      case 'declare': {
        const suffix = node.structure && node.structure !== 'Scalar' ? ' [' + node.structure + ']' : '';
        return 'Declare ' + node.name + ': ' + node.dataType + suffix;
      }
      case 'assign': {
        let lhs = node.name;
        if (node.structure === 'Array') lhs += '[' + node.index + ']';
        else if (node.structure === 'Matrix') lhs += '[' + node.row + '][' + node.col + ']';
        return lhs + ' = ' + node.expression;
      }
      case 'comment': return '// ' + node.text;
      case 'call': return node.procedureName + '(' + (node.arguments || '') + ')';
      case 'input': return 'Input ' + node.variable + ' (' + node.dataType + ')';
      case 'output': return 'Output ' + node.expression;
      case 'if': return 'If (' + node.condition + ')';
      case 'switch': return 'Switch (' + node.expression + ') — case ' + (node.isDefault ? 'default' : node.caseValue);
      case 'while': return 'While (' + node.condition + ')';
      case 'do': return 'Do…While (' + node.condition + ')';
      case 'for': return 'For ' + node.variable + ' = ' + node.start + ' → ' + node.end + ' (' + node.direction + ')';
      case 'foreach': return 'Foreach ' + node.variable + ' in ' + node.collection;
      default: return node.kind;
    }
  }

  _renderCanvas() {
    this.nodeHeaderEls = {};
    this.els.canvas.innerHTML = '';
    const rootSeq = document.createElement('div');
    rootSeq.className = 'fb-seq fb-seq-root';
    this._renderSeq(this.flowRoot, rootSeq);
    this.els.canvas.appendChild(rootSeq);
    if (this.flowRoot.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'fb-empty-hint';
      hint.textContent = 'Use the buttons above to add blocks to your flow.';
      this.els.canvas.appendChild(hint);
    }
  }

  _renderSeq(seq, containerEl) {
    seq.forEach(node => {
      const block = document.createElement('div');
      block.className = 'flow-block' + (node.id === this.selectedId ? ' selected' : '');
      block.dataset.nodeId = node.id;

      const header = document.createElement('div');
      header.className = 'fb-block-header';

      const tag = document.createElement('span');
      tag.className = 'fb-kind-tag';
      tag.textContent = FlowBuilder._KIND_LABELS[node.kind] || node.kind;

      const label = document.createElement('span');
      label.className = 'fb-block-label';
      label.textContent = this._blockLabel(node);

      const moves = document.createElement('span');
      moves.className = 'fb-block-moves';
      const upBtn = document.createElement('button');
      upBtn.className = 'fb-move-btn';
      upBtn.type = 'button';
      upBtn.textContent = '▲';
      upBtn.title = 'Move up';
      upBtn.addEventListener('click', e => { e.stopPropagation(); this._moveNode(node.id, -1); });
      const downBtn = document.createElement('button');
      downBtn.className = 'fb-move-btn';
      downBtn.type = 'button';
      downBtn.textContent = '▼';
      downBtn.title = 'Move down';
      downBtn.addEventListener('click', e => { e.stopPropagation(); this._moveNode(node.id, 1); });
      moves.appendChild(upBtn);
      moves.appendChild(downBtn);

      header.appendChild(tag);
      header.appendChild(label);
      header.appendChild(moves);
      header.addEventListener('click', () => this._selectNode(node.id));

      block.appendChild(header);
      this.nodeHeaderEls[node.id] = header;

      if (this._isContainerKind(node.kind)) {
        const body = document.createElement('div');
        body.className = 'fb-block-body';
        this._renderSeq(node.body, body);

        const addBtn = document.createElement('button');
        addBtn.className = 'fb-add-btn fb-add-into-body';
        addBtn.type = 'button';
        addBtn.textContent = '+ Add inside';
        addBtn.addEventListener('click', e => {
          e.stopPropagation();
          this._selectNode(node.id);
          // Default the inserted block to the first kind allowed by the palette.
          const kinds = this.blocksToShow || FlowBuilder._NODE_KINDS;
          this._addIntoBody(node.id, kinds[0] || 'output');
        });
        body.appendChild(addBtn);
        block.appendChild(body);
      }

      containerEl.appendChild(block);
    });
  }

  _rerenderCanvasSelectionOnly() {
    this.els.canvas.querySelectorAll('.flow-block').forEach(el => {
      el.classList.toggle('selected', el.dataset.nodeId === this.selectedId);
    });
  }

  /* ---------- props panel ---------- */

  _renderPropsPanel() {
    const content = this.els.propsPanel;
    content.innerHTML = '';

    const node = this.selectedId ? this._findNode(this.selectedId) : null;
    if (!node) {
      const hint = document.createElement('div');
      hint.className = 'fb-empty-hint';
      hint.textContent = 'Select a block to edit its properties.';
      content.appendChild(hint);
      return;
    }

    this._renderPropsFields(node, content);
  }

  _renderPropsFields(node, content) {
    switch (node.kind) {
      case 'declare': {
        content.appendChild(this._fieldRow('Name', this._makeText(node.name, v => { node.name = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Data Type', this._makeSelect(['Integer', 'Real', 'String', 'Boolean'], node.dataType, v => { node.dataType = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Structure', this._makeSelect(['Scalar', 'Array', 'Matrix'], node.structure, v => { node.structure = v; this._onFieldChanged(); })));
        if (node.structure !== 'Scalar') {
          content.appendChild(this._fieldRow(node.structure === 'Matrix' ? 'Size (rows,cols)' : 'Size', this._makeText(node.size, v => { node.size = v; this._onFieldChanged(); })));
        }
        break;
      }
      case 'assign': {
        content.appendChild(this._fieldRow('Name', this._makeText(node.name, v => { node.name = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Structure', this._makeSelect(['Scalar', 'Array', 'Matrix'], node.structure, v => { node.structure = v; this._onFieldChanged(); })));
        if (node.structure === 'Array') {
          content.appendChild(this._fieldRow('Index', this._makeText(node.index, v => { node.index = v; this._onFieldChanged(); })));
        } else if (node.structure === 'Matrix') {
          const twoCol = document.createElement('div');
          twoCol.className = 'field-2col';
          twoCol.appendChild(this._fieldRow('Row', this._makeText(node.row, v => { node.row = v; this._onFieldChanged(); })));
          twoCol.appendChild(this._fieldRow('Col', this._makeText(node.col, v => { node.col = v; this._onFieldChanged(); })));
          content.appendChild(twoCol);
        }
        content.appendChild(this._fieldRow('Expression', this._makeText(node.expression, v => { node.expression = v; this._onFieldChanged(); }, 'e.g. i + 1')));
        break;
      }
      case 'comment': {
        content.appendChild(this._fieldRow('Text', this._makeText(node.text, v => { node.text = v; this._onFieldChanged(); })));
        break;
      }
      case 'call': {
        content.appendChild(this._fieldRow('Procedure Name', this._makeText(node.procedureName, v => { node.procedureName = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Arguments', this._makeText(node.arguments, v => { node.arguments = v; this._onFieldChanged(); }, 'e.g. a, b')));
        break;
      }
      case 'if': {
        content.appendChild(this._fieldRow('Condition', this._makeText(node.condition, v => { node.condition = v; this._onFieldChanged(); }, 'e.g. score >= 60')));
        break;
      }
      case 'switch': {
        content.appendChild(this._fieldRow('Expression', this._makeText(node.expression, v => { node.expression = v; this._onFieldChanged(); }, 'e.g. level')));
        content.appendChild(this._makeCheckboxRow('Default case', node.isDefault, v => { node.isDefault = v; this._onFieldChanged(); this._renderPropsPanel(); }));
        if (!node.isDefault) {
          content.appendChild(this._fieldRow('Case Value', this._makeText(node.caseValue, v => { node.caseValue = v; this._onFieldChanged(); })));
        }
        break;
      }
      case 'input': {
        content.appendChild(this._fieldRow('Variable', this._makeText(node.variable, v => { node.variable = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Data Type', this._makeSelect(['Integer', 'Real', 'String', 'Boolean'], node.dataType, v => { node.dataType = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Test Value (used when stepping)', this._makeText(node.testValue, v => { node.testValue = v; this._onFieldChanged(); })));
        break;
      }
      case 'output': {
        content.appendChild(this._fieldRow('Expression', this._makeText(node.expression, v => { node.expression = v; this._onFieldChanged(); }, 'e.g. "Total: " + total')));
        content.appendChild(this._makeCheckboxRow('Add newline (Console.WriteLine)', node.newline, v => { node.newline = v; this._onFieldChanged(); }));
        break;
      }
      case 'while':
      case 'do': {
        content.appendChild(this._fieldRow('Conditional Expression', this._makeText(node.condition, v => { node.condition = v; this._onFieldChanged(); }, 'e.g. i < 10')));
        break;
      }
      case 'for': {
        content.appendChild(this._fieldRow('Variable (Counter)', this._makeText(node.variable, v => { node.variable = v; this._onFieldChanged(); })));
        const twoCol = document.createElement('div');
        twoCol.className = 'field-2col';
        twoCol.appendChild(this._fieldRow('Start Value', this._makeText(node.start, v => { node.start = v; this._onFieldChanged(); })));
        twoCol.appendChild(this._fieldRow('End Value', this._makeText(node.end, v => { node.end = v; this._onFieldChanged(); })));
        content.appendChild(twoCol);
        const twoCol2 = document.createElement('div');
        twoCol2.className = 'field-2col';
        twoCol2.appendChild(this._fieldRow('Direction', this._makeSelect(['Increasing', 'Decreasing'], node.direction, v => { node.direction = v; this._onFieldChanged(); })));
        twoCol2.appendChild(this._fieldRow('Step By', this._makeText(node.step, v => { node.step = v; this._onFieldChanged(); })));
        content.appendChild(twoCol2);
        break;
      }
      case 'foreach': {
        content.appendChild(this._fieldRow('Variable (Item)', this._makeText(node.variable, v => { node.variable = v; this._onFieldChanged(); })));
        content.appendChild(this._fieldRow('Collection', this._makeText(node.collection, v => { node.collection = v; this._onFieldChanged(); }, 'e.g. numbers')));
        break;
      }
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'fb-btn fb-btn-danger';
    delBtn.style.marginTop = '0.5rem';
    delBtn.textContent = 'Delete Block';
    delBtn.addEventListener('click', () => this._deleteNode(node.id));
    content.appendChild(delBtn);
  }

  /* ---------- small field-building helpers ---------- */

  _fieldRow(labelText, inputEl) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const label = document.createElement('label');
    label.textContent = labelText;
    row.appendChild(label);
    row.appendChild(inputEl);
    return row;
  }

  _makeText(value, onChange, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value == null ? '' : value;
    if (placeholder) input.placeholder = placeholder;
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }

  _makeSelect(options, value, onChange) {
    const select = document.createElement('select');
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt;
      el.textContent = opt;
      if (opt === value) el.selected = true;
      select.appendChild(el);
    });
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }

  _makeCheckboxRow(labelText, checked, onChange) {
    const row = document.createElement('div');
    row.className = 'fb-checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!checked;
    checkbox.addEventListener('change', () => onChange(checkbox.checked));
    const label = document.createElement('label');
    label.textContent = labelText;
    row.appendChild(checkbox);
    row.appendChild(label);
    return row;
  }

  // Cheap update after a field edit: refresh canvas labels + regenerate code +
  // invalidate the run, but deliberately skip re-rendering the props panel
  // itself so the input the user is typing in doesn't lose focus.
  _onFieldChanged() {
    this._renderCanvas();
    this._renderCode();
    this._renderCompare();
    this.steps = [];
    this.currentStep = -1;
    this._updateRunView();
  }

  _toCSharpType(dataType) {
    if (dataType === 'Integer') return 'int';
    if (dataType === 'Real') return 'double';
    if (dataType === 'Boolean') return 'bool';
    return 'string';
  }

  _collectHelpers(seq, used) {
    seq.forEach(node => {
      if (node.kind === 'input') {
        if (node.dataType === 'String') used.inputText = true;
        else if (node.dataType === 'Boolean') used.inputBoolean = true;
        else used.inputValue = true;
      } else if (node.kind === 'output') {
        if (node.newline) used.output = true;
        else used.outputNoNewline = true;
      }
      if (node.body) this._collectHelpers(node.body, used);
    });
  }

  /* ---------- compare tab ---------- */

  _renderCompare() {
    if (!this.els.expectedPre) return;
    const expected = this.expectedCode || '';
    const actual = (this.coreLinesCache || []).map(l => l.text).join('\n');
    this.els.expectedPre.textContent = expected || '(no expected code supplied for this exercise)';
    this.els.actualPre.textContent = actual || '// Drag blocks into the flow to generate code';

    const normalize = s => s.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length).join('\n');
    const isMatch = !!expected && normalize(expected) === normalize(actual);
    this.els.compareStatus.textContent = expected
      ? (isMatch ? '✓ Your code matches the expected output.' : '✗ Not matching yet — keep going.')
      : 'No expected code was provided for this exercise.';
    this.els.compareStatus.className = 'fb-compare-status' + (expected ? (isMatch ? ' match' : ' mismatch') : '');
  }

  _genLines(seq, indent) {
    let lines = [];
    const pad = '    '.repeat(indent);
    seq.forEach(node => {
      switch (node.kind) {
        case 'declare': {
          const csType = this._toCSharpType(node.dataType);
          let decl;
          if (node.structure === 'Scalar') decl = csType + ' ' + node.name + ';';
          else if (node.structure === 'Array') decl = csType + '[] ' + node.name + ' = new ' + csType + '[' + node.size + '];';
          else decl = csType + '[][] ' + node.name + ' = new ' + csType + '[' + node.size + '];';
          lines.push({ id: node.id, text: pad + decl });
          break;
        }
        case 'assign': {
          let lhs = node.name;
          if (node.structure === 'Array') lhs += '[' + node.index + ']';
          else if (node.structure === 'Matrix') lhs += '[' + node.row + '][' + node.col + ']';
          lines.push({ id: node.id, text: pad + lhs + ' = ' + node.expression + ';' });
          break;
        }
        case 'comment':
          lines.push({ id: node.id, text: pad + '// ' + node.text });
          break;
        case 'call':
          lines.push({ id: node.id, text: pad + node.procedureName + '(' + (node.arguments || '') + ');' });
          break;
        case 'input': {
          let call;
          if (node.dataType === 'String') call = node.variable + ' = inputText();';
          else if (node.dataType === 'Boolean') call = node.variable + ' = inputBoolean();';
          else if (node.dataType === 'Integer') call = node.variable + ' = (int) inputValue();';
          else call = node.variable + ' = inputValue();';
          lines.push({ id: node.id, text: pad + call });
          break;
        }
        case 'output': {
          const fn = node.newline ? 'output' : 'outputNoNewline';
          lines.push({ id: node.id, text: pad + fn + '(' + node.expression + ');' });
          break;
        }
        case 'if':
          lines.push({ id: node.id, text: pad + 'if (' + node.condition + ')' });
          lines.push({ id: node.id, text: pad + '{' });
          lines = lines.concat(this._genLines(node.body, indent + 1));
          lines.push({ id: node.id, text: pad + '}' });
          break;
        case 'switch':
          lines.push({ id: node.id, text: pad + 'switch (' + node.expression + ')' });
          lines.push({ id: node.id, text: pad + '{' });
          lines.push({ id: node.id, text: pad + '    case ' + (node.isDefault ? 'default' : node.caseValue) + ':' });
          lines = lines.concat(this._genLines(node.body, indent + 2));
          lines.push({ id: node.id, text: pad + '        break;' });
          lines.push({ id: node.id, text: pad + '}' });
          break;
        case 'while':
          lines.push({ id: node.id, text: pad + 'while (' + node.condition + ')' });
          lines.push({ id: node.id, text: pad + '{' });
          lines = lines.concat(this._genLines(node.body, indent + 1));
          lines.push({ id: node.id, text: pad + '}' });
          break;
        case 'do':
          lines.push({ id: node.id, text: pad + 'do' });
          lines.push({ id: node.id, text: pad + '{' });
          lines = lines.concat(this._genLines(node.body, indent + 1));
          lines.push({ id: node.id, text: pad + '} while (' + node.condition + ');' });
          break;
        case 'for': {
          const cmpOp = node.direction === 'Decreasing' ? '>=' : '<=';
          const stepOp = node.direction === 'Decreasing' ? '-=' : '+=';
          lines.push({ id: node.id, text: pad + 'for (' + node.variable + ' = ' + node.start + '; ' + node.variable + ' ' + cmpOp + ' ' + node.end + '; ' + node.variable + ' ' + stepOp + ' ' + node.step + ')' });
          lines.push({ id: node.id, text: pad + '{' });
          lines = lines.concat(this._genLines(node.body, indent + 1));
          lines.push({ id: node.id, text: pad + '}' });
          break;
        }
        case 'foreach': {
          lines.push({ id: node.id, text: pad + 'foreach (var ' + node.variable + ' in ' + node.collection + ')' });
          lines.push({ id: node.id, text: pad + '{' });
          lines = lines.concat(this._genLines(node.body, indent + 1));
          lines.push({ id: node.id, text: pad + '}' });
          break;
        }
      }
    });
    return lines;
  }

  _renderCode() {
    this.coreLinesCache = this._genLines(this.flowRoot, 0);

    const used = {};
    this._collectHelpers(this.flowRoot, used);

    const full = [];
    full.push({ id: null, text: 'using System;' });
    full.push({ id: null, text: '' });
    full.push({ id: null, text: 'class Program' });
    full.push({ id: null, text: '{' });
    full.push({ id: null, text: '    static void Main(string[] args)' });
    full.push({ id: null, text: '    {' });
    this._genLines(this.flowRoot, 2).forEach(l => full.push(l));
    full.push({ id: null, text: '    }' });

    const helperKeys = ['inputText', 'inputValue', 'inputBoolean', 'output', 'outputNoNewline'];
    helperKeys.forEach(key => {
      if (used[key]) {
        full.push({ id: null, text: '' });
        const defs = {
          inputText: ['    private static string inputText()', '    {', '        return Console.ReadLine();', '    }'],
          inputValue: ['    private static double inputValue()', '    {', '        double result;', '        while (!double.TryParse(Console.ReadLine(), out result));', '        return result;', '    }'],
          inputBoolean: ['    private static bool inputBoolean()', '    {', '        bool result;', '        while (!bool.TryParse(Console.ReadLine(), out result));', '        return result;', '    }'],
          output: ['    private static void output(string text)', '    {', '        Console.WriteLine(text);', '    }'],
          outputNoNewline: ['    private static void outputNoNewline(string text)', '    {', '        Console.Write(text);', '    }']
        };
        defs[key].forEach(line => full.push({ id: null, text: line }));
      }
    });

    full.push({ id: null, text: '}' });

    this.codeLinesCache = this.flowRoot.length === 0 ? [] : full;

    const codeEl = this.els.codeView;
    codeEl.innerHTML = '';
    if (this.codeLinesCache.length === 0) {
      codeEl.textContent = '// Drag blocks into the flow to generate code';
      return;
    }
    this.codeLinesCache.forEach((line, i) => {
      const span = document.createElement('span');
      span.className = 'code-line';
      span.dataset.idx = String(i);
      span.textContent = line.text || ' ';
      codeEl.appendChild(span);
    });
  }

  _buildSteps() {
    const vars = {};
    const outputParts = [];
    const stepsLocal = [];
    let budget = 4000;
    let haltReason = null;

    const snapshot = () => {
      const copy = {};
      Object.keys(vars).forEach(k => { copy[k] = JSON.parse(JSON.stringify(vars[k])); });
      return copy;
    };
    const pushStep = (nodeId, desc) => {
      stepsLocal.push({ nodeId: nodeId, vars: snapshot(), output: outputParts.join(''), desc: desc });
    };

    const execSeq = (seq) => {
      for (let i = 0; i < seq.length; i++) {
        if (haltReason) return;
        if (budget-- <= 0) { haltReason = 'Step limit reached — possible infinite loop.'; return; }
        this._execNode(seq[i], vars, outputParts, stepsLocal, execSeq);
      }
    };

    execSeq(this.flowRoot);
    if (haltReason) {
      stepsLocal.push({ nodeId: null, vars: snapshot(), output: outputParts.join('') + '\n[' + haltReason + ']', desc: haltReason });
    }
    return stepsLocal;
  }

  _execNode(node, vars, outputParts, stepsLocal, execSeq) {
    switch (node.kind) {
      case 'declare':
        vars[node.name] = this._defaultValue(node.dataType, node.structure, node.size, vars);
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Declare ' + node.name });
        break;
      case 'assign': {
        let val = this._evalExpr(node.expression, vars);
        if (node.dataType === 'Integer' && typeof val === 'number') val = Math.trunc(val);
        if (node.structure === 'Scalar') {
          vars[node.name] = val;
        } else if (node.structure === 'Array') {
          const idx = parseInt(this._evalExpr(node.index, vars), 10) || 0;
          if (!Array.isArray(vars[node.name])) vars[node.name] = [];
          vars[node.name][idx] = val;
        } else if (node.structure === 'Matrix') {
          const r = parseInt(this._evalExpr(node.row, vars), 10) || 0;
          const c = parseInt(this._evalExpr(node.col, vars), 10) || 0;
          if (!Array.isArray(vars[node.name])) vars[node.name] = [];
          if (!Array.isArray(vars[node.name][r])) vars[node.name][r] = [];
          vars[node.name][r][c] = val;
        }
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Assign ' + node.name + ' = ' + JSON.stringify(val) });
        break;
      }
      case 'comment':
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Comment: ' + node.text });
        break;
      case 'call':
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Call ' + node.procedureName + '(' + (node.arguments || '') + ')' });
        break;
      case 'input': {
        const val = this._castValue(node.testValue, node.dataType);
        vars[node.variable] = val;
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Input ' + node.variable + ' = ' + JSON.stringify(val) });
        break;
      }
      case 'output': {
        const val = this._evalExpr(node.expression, vars);
        outputParts.push(String(val) + (node.newline ? '\n' : ''));
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Output: ' + val });
        break;
      }
      case 'if': {
        const cond = !!this._evalExpr(node.condition, vars);
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'If (' + node.condition + ') → ' + cond });
        if (cond) execSeq(node.body);
        break;
      }
      case 'switch': {
        const exprVal = this._evalExpr(node.expression, vars);
        const caseStr = node.isDefault ? 'default' : node.caseValue;
        const matched = node.isDefault ? true : String(exprVal) === String(node.caseValue);
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Switch (' + node.expression + ') → case ' + caseStr + ': ' + matched });
        if (matched) execSeq(node.body);
        break;
      }
      case 'while': {
        while (true) {
          if (this._checkBudget(stepsLocal, vars, outputParts)) return;
          const cond = !!this._evalExpr(node.condition, vars);
          stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'While (' + node.condition + ') → ' + cond });
          if (!cond) break;
          execSeq(node.body);
        }
        break;
      }
      case 'do': {
        while (true) {
          if (this._checkBudget(stepsLocal, vars, outputParts)) return;
          execSeq(node.body);
          const cond = !!this._evalExpr(node.condition, vars);
          stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Do...While (' + node.condition + ') → ' + cond });
          if (!cond) break;
        }
        break;
      }
      case 'for': {
        const startVal = this._evalExpr(node.start, vars);
        vars[node.variable] = startVal;
        const stepMag = Math.abs(this._evalExpr(node.step, vars)) || 1;
        const inc = node.direction === 'Decreasing' ? -stepMag : stepMag;
        stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'For ' + node.variable + ' = ' + startVal });
        while (true) {
          if (this._checkBudget(stepsLocal, vars, outputParts)) return;
          const endVal = this._evalExpr(node.end, vars);
          const cond = node.direction === 'Decreasing' ? vars[node.variable] >= endVal : vars[node.variable] <= endVal;
          if (!cond) break;
          execSeq(node.body);
          vars[node.variable] += inc;
          stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'For ' + node.variable + ' → ' + vars[node.variable] });
        }
        break;
      }
      case 'foreach': {
        const collection = this._evalExpr(node.collection, vars);
        if (Array.isArray(collection)) {
          collection.forEach(item => {
            if (this._checkBudget(stepsLocal, vars, outputParts)) return;
            vars[node.variable] = item;
            stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Foreach ' + node.variable + ' = ' + JSON.stringify(item) });
            execSeq(node.body);
          });
        } else {
          stepsLocal.push({ nodeId: node.id, vars: this._snapshot(vars), output: outputParts.join(''), desc: 'Foreach collection not array' });
        }
        break;
      }
    }
  }

  _checkBudget(stepsLocal, vars, outputParts) {
    if (this._budget <= 0) {
      stepsLocal.push({ nodeId: null, vars: this._snapshot(vars), output: outputParts.join('') + '\n[Step limit reached — possible infinite loop.]', desc: 'Step limit reached' });
      return true;
    }
    this._budget--;
    return false;
  }

  _snapshot(vars) {
    const copy = {};
    Object.keys(vars).forEach(k => { copy[k] = JSON.parse(JSON.stringify(vars[k])); });
    return copy;
  }

  _evalExpr(expr, scope) {
    try {
      const keys = Object.keys(scope);
      const vals = keys.map(k => scope[k]);
      const fn = new Function(keys.join(','), 'return (' + expr + ');');
      return fn.apply(null, vals);
    } catch (e) {
      return undefined;
    }
  }

  _defaultValue(dataType, structure, sizeExpr, scope) {
    const dv = (dataType === 'Integer' || dataType === 'Real') ? 0 : (dataType === 'String' ? '' : false);
    if (structure === 'Scalar') return dv;
    if (structure === 'Array') {
      const n = parseInt(this._evalExpr(sizeExpr, scope), 10) || 0;
      return new Array(n).fill(dv);
    }
    if (structure === 'Matrix') {
      const parts = String(sizeExpr || '0,0').split(',').map(s => parseInt(this._evalExpr(s.trim(), scope), 10) || 0);
      const rows = parts[0] || 0, cols = parts[1] || 1;
      return Array.from({ length: rows }, () => new Array(cols).fill(dv));
    }
    return dv;
  }

  _castValue(raw, dataType) {
    if (dataType === 'Integer') return parseInt(raw, 10) || 0;
    if (dataType === 'Real') return parseFloat(raw) || 0;
    if (dataType === 'Boolean') return String(raw).toLowerCase() === 'true';
    return String(raw);
  }

  _switchTab(name) {
    this.root.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    this.root.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === name));
  }

  rerenderAll() {
    this._renderCanvas();
    this._renderPropsPanel();
    this._renderCode();
    this._renderCompare();
    this._rerenderCanvasSelectionOnly();
    this.steps = [];
    this.currentStep = -1;
    this._updateRunView();
  }

  _updateRunView() {
    const { stepLabel, stepDesc, varsView, consoleView } = this.els;
    this.root.querySelectorAll('.flow-block.active-step').forEach(el => el.classList.remove('active-step'));
    this.root.querySelectorAll('.code-line.active').forEach(el => el.classList.remove('active'));

    if (this.currentStep < 0 || this.steps.length === 0) {
      stepLabel.textContent = 'Step 0 / ' + Math.max(this.steps.length - 1, 0);
      stepDesc.textContent = this.steps.length === 0 ? 'Nothing to run yet — build a flow first.' : 'Press Play or Step to run the flow.';
      varsView.innerHTML = '<div class="fb-empty-hint">No variables</div>';
      consoleView.textContent = '';
      return;
    }

    const step = this.steps[this.currentStep];
    stepLabel.textContent = 'Step ' + this.currentStep + ' / ' + (this.steps.length - 1);
    stepDesc.textContent = step.desc || '';

    if (step.nodeId && this.nodeHeaderEls[step.nodeId]) {
      this.nodeHeaderEls[step.nodeId].closest('.flow-block').classList.add('active-step');
    }
    this.codeLinesCache.forEach((line, i) => {
      if (line.id !== null && line.id === step.nodeId) {
        const el = this.root.querySelector('.code-line[data-idx="' + i + '"]');
        if (el) el.classList.add('active');
      }
    });

    varsView.innerHTML = '';
    const keys = Object.keys(step.vars);
    if (keys.length === 0) {
      varsView.innerHTML = '<div class="fb-empty-hint">No variables</div>';
    } else {
      keys.forEach(k => {
        const row = document.createElement('div');
        row.className = 'var-row';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'var-name';
        nameSpan.textContent = k;
        const valSpan = document.createElement('span');
        valSpan.className = 'var-value';
        valSpan.textContent = JSON.stringify(step.vars[k]);
        row.appendChild(nameSpan);
        row.appendChild(valSpan);
        varsView.appendChild(row);
      });
    }
    consoleView.textContent = step.output;
  }

  _resetRun() {
    this.stopPlay();
    this.steps = this._buildSteps();
    this.currentStep = this.steps.length > 0 ? 0 : -1;
    this._updateRunView();
  }

  _nextStep() {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      this._updateRunView();
    } else {
      this.stopPlay();
    }
  }

  _prevStep() {
    if (this.currentStep > 0) {
      this.stopPlay();
      this.currentStep--;
      this._updateRunView();
    }
  }

  _startPlay() {
    if (this.playing || this.steps.length === 0) return;
    this.playing = true;
    this.els.playBtn.textContent = 'Pause';
    const tick = () => {
      if (!this.playing) return;
      if (this.currentStep < this.steps.length - 1) {
        this._nextStep();
        this.playHandle = setTimeout(tick, 700);
      } else {
        this.stopPlay();
      }
    };
    this.playHandle = setTimeout(tick, 700);
  }

  stopPlay() {
    this.playing = false;
    this.els.playBtn.textContent = 'Play';
    if (this.playHandle) clearTimeout(this.playHandle);
  }
}
