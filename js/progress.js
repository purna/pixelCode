(function () {
  'use strict';

  app.sectionTitle = function () {
    return (app.state.data.meta && app.state.data.meta.title) || app.state.section;
  };

  app.updateCompletionBadges = function () {
    const cards = document.querySelectorAll('.section-card');
    cards.forEach(function (card, index) {
      const section = card.getAttribute('data-section');
      const level = card.getAttribute('data-level');
      const badge = card.querySelector('.completion-badge');
      if (!badge) return;

      const status = app.getSectionStatus(section, level);
      badge.style.animationDelay = '0.8s';

      if (status && status.passed) {
        badge.className = 'completion-badge passed';
        badge.innerHTML = app.renderProgressCircle(100, 80, 7, 34, '#ffffff', false);
        const star = document.createElement('span');
        star.className = 'badge-star';
        star.textContent = '★';
        badge.appendChild(star);
        requestAnimationFrame(function () {
          app.animateProgressCircle(badge);
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
        badge.innerHTML = app.renderProgressCircle(pct, 80, 6, 32, '#ffffff', true);
        requestAnimationFrame(function () {
          app.animateProgressCircle(badge);
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
        const learnStatus = app.getLearnProgress(section, level);
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
  };

  app.animateProgressCircle = function (badge) {
    const circle = badge.querySelector('.progress-circle');
    if (!circle) return;
    const targetOffset = circle.getAttribute('data-target-offset');
    if (targetOffset === null) return;
    setTimeout(function () {
      circle.style.transition = 'stroke-dashoffset 1s ease';
      circle.setAttribute('stroke-dashoffset', targetOffset);
    }, 50);
  };

  app.renderProgressCircle = function (pct, size, strokeWidth, radius, color, showText) {
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
  };

  app.updateOverallProgress = function () {
    const cards = document.querySelectorAll('.section-card');
    let totalTopics = 0;
    let passedTopics = 0;

    cards.forEach(function (card) {
      const section = card.getAttribute('data-section');
      const level = card.getAttribute('data-level');
      const status = app.getSectionStatus(section, level);
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
      app.animateCounter(score, 0, pct, 800);
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
  };

  app.animateCounter = function (element, start, end, duration) {
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
  };

  app.updateCompletionBadges();
  app.updateOverallProgress();
})();
