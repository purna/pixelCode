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
    delBtn.className = 'btn btn-danger';
    delBtn.style.marginTop = '0.5rem';
    delBtn.textContent = 'Delete Block';
    delBtn.addEventListener('click', () => this._deleteNode(node.id));
    content.appendChild(delBtn);
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
      varsView.innerHTML = '<div style="color:#9ca3af;font-size:0.8rem;">No variables</div>';
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
      varsView.innerHTML = '<div style="color:#9ca3af;font-size:0.8rem;">No variables</div>';
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
