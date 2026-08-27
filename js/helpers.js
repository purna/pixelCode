(function () {
  'use strict';

  app.cssVar = function (name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };

  app.drawShapeCanvas = function (canvas, desc) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const size = (Math.min(w, h) * 0.42) * (desc.scale || 1);
    const ink = app.cssVar('--ink', '#1E2340');
    const accent = app.cssVar('--accent', '#B5792A');

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
  };

  app.makeShapeCanvas = function (desc, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.className = 'shape-canvas';
    app.drawShapeCanvas(canvas, desc);
    return canvas;
  };

  app.drawMatrixCell = function (canvas, desc) {
    if (!desc) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    const size = Math.min(w, h) * 0.32;
    const ink = app.cssVar('--ink', '#1E2340');
    const accent = app.cssVar('--accent', '#B5792A');

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
  };

  app.checkPyramidAnswer = function (q, placed) {
    if (!placed || placed.length < q.solutions.length) return false;
    for (let i = 0; i < q.solutions.length; i++) {
      if (placed[i] === undefined || placed[i] === null) return false;
      if (placed[i] !== q.solutions[i]) return false;
    }
    return true;
  };

  app.countValue = function (arr, val) {
    let n = 0;
    arr.forEach(function (v) { if (v === val) n++; });
    return n;
  };
})();
