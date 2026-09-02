(function () {
  'use strict';

  app.getResults = function () {
    try {
      return JSON.parse(localStorage.getItem('quizResults')) || {};
    } catch (e) {
      return {};
    }
  };

  app.mergeResults = function (remoteResults) {
    try {
      const local = JSON.parse(localStorage.getItem('quizResults')) || {};
      Object.keys(remoteResults).forEach(key => {
        const remote = remoteResults[key];
        const existing = local[key];
        if (!existing || (remote.lastUpdated && (!existing.lastUpdated || remote.lastUpdated > existing.lastUpdated))) {
          local[key] = remote;
        } else if (existing.bestPct < (remote.bestPct || 0)) {
          local[key].bestPct = Math.max(existing.bestPct, remote.bestPct || 0);
          local[key].passed = local[key].bestPct >= 80;
        }
      });
      localStorage.setItem('quizResults', JSON.stringify(local));
    } catch (e) {}
  };

  app.saveQuizResult = function (section, level, variant, pct, correct, total) {
    const results = app.getResults();
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
  };

  app.getSectionStatus = function (section, level) {
    const results = app.getResults();
    const key = section + '|' + level;
    return results[key] || null;
  };

  app.getLearnProgress = function (section, level) {
    try {
      const all = JSON.parse(localStorage.getItem('learnProgress')) || {};
      return all[section + '|' + level] || null;
    } catch (e) {
      return null;
    }
  };

  app.getAllLearnProgress = function () {
    try {
      return JSON.parse(localStorage.getItem('learnProgress')) || {};
    } catch (e) {
      return {};
    }
  };

  app.mergeLearnProgress = function (progress) {
    try {
      const existing = JSON.parse(localStorage.getItem('learnProgress')) || {};
      Object.keys(progress).forEach(key => {
        const remote = progress[key];
        const local = existing[key];
        if (!local || (remote.lastUpdated && (!local.lastUpdated || remote.lastUpdated > local.lastUpdated))) {
          existing[key] = remote;
        }
      });
      localStorage.setItem('learnProgress', JSON.stringify(existing));
    } catch (e) {}
  };

  app.saveLearnProgress = function (section, level, idx, completed, total) {
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
  };
})();
