// accessibility.js — full accessibility layer: toggle UI, TTS, keyboard nav, focus management
(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────── */
  var a11y = {
    ttsEnabled: false,
    highContrast: false,
    simpleMode: false,
    largeText: false,
    slowSpeech: false,
    reduceMotion: false,
    soundEnabled: true
  };

  /* ── Sound (Howler.js) ───────────────────────────────── */
  var pingPong = null;
  if (window.Howl) {
    pingPong = new Howl({
      src: ['sfx/ping_pong.mp3'],
      volume: 0.35,
      preload: true
    });
  }

  function playClickSound() {
    if (!a11y.soundEnabled) return;
    if (!pingPong) return;
    try { pingPong.play(); } catch (e) { /* audio may be blocked until user gesture */ }
  }

  /* ── Elements ──────────────────────────────────────────── */
  var modal     = document.getElementById('a11yModal');
  var openBtn   = document.getElementById('a11yBtn');
  var closeBtn  = document.getElementById('closeA11y');
  var closeFooter = document.getElementById('closeA11yFooter');
  var toggleBtns = modal ? modal.querySelectorAll('.toggle-btn[data-feature]') : [];

  /* ── Global button click sound ─────────────────────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('button');
    if (!btn) return;
    if (btn.disabled) return;
    playClickSound();
  });

  /* ── Open / Close Modal ────────────────────────────────── */
  function openA11y() {
    if (modal) modal.classList.remove('hidden');
  }

  function closeA11y() {
    if (modal) modal.classList.add('hidden');
  }

  if (openBtn)    openBtn.addEventListener('click', openA11y);
  if (closeBtn)   closeBtn.addEventListener('click', closeA11y);
  if (closeFooter) closeFooter.addEventListener('click', closeA11y);
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeA11y();
    });
  }

  /* ── TEXT-TO-SPEECH ────────────────────────────────────── */
  function speak(text) {
    if (!a11y.ttsEnabled) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(text);
    utt.rate = a11y.slowSpeech ? 0.65 : 0.9;
    utt.lang = 'en-GB';
    window.speechSynthesis.speak(utt);
  }

  function enableTTS(enabled) {
    a11y.ttsEnabled = enabled;
    if (!enabled && window.speechSynthesis) window.speechSynthesis.cancel();
    localStorage.setItem('a11y-tts', enabled);
    updateToggleUI('tts', enabled);
  }

  /* ── HIGH CONTRAST ─────────────────────────────────────── */
  function enableHighContrast(enabled) {
    a11y.highContrast = enabled;
    document.body.classList.toggle('high-contrast', enabled);
    localStorage.setItem('a11y-contrast', enabled);
    updateToggleUI('high_contrast', enabled);
  }

  /* ── LARGE TEXT ─────────────────────────────────────────── */
  function enableLargeText(enabled) {
    a11y.largeText = enabled;
    document.documentElement.classList.toggle('large-text', enabled);
    localStorage.setItem('a11y-large', enabled);
    updateToggleUI('large_text', enabled);
  }

  /* ── SIMPLE MODE ───────────────────────────────────────── */
  function enableSimpleMode(enabled) {
    a11y.simpleMode = enabled;
    document.body.classList.toggle('simple-mode', enabled);
    if (enabled) applySimpleMode();
    else revertSimpleMode();
    localStorage.setItem('a11y-simple', enabled);
    updateToggleUI('simple_mode', enabled);
  }

  /* ── SIMPLE LANGUAGE: word replacement ──────────────────── */
  var simpleReplacements = {
    'utilise': 'use', 'utilised': 'used', 'utilising': 'using', 'utility': 'tool',
    'demonstrate': 'show', 'demonstrated': 'showed', 'demonstrates': 'shows', 'demonstrating': 'showing',
    'facilitate': 'help', 'facilitates': 'helps', 'facilitated': 'helped',
    'commence': 'start', 'commences': 'starts', 'commenced': 'started',
    'terminate': 'end', 'terminates': 'ends', 'terminated': 'ended',
    'endeavour': 'try', 'endeavours': 'tries',
    'obtain': 'get', 'obtains': 'gets', 'obtained': 'got',
    'purchase': 'buy', 'purchases': 'buys', 'purchased': 'bought',
    'request': 'ask for', 'requests': 'asks for', 'requested': 'asked for',
    'require': 'need', 'requires': 'needs', 'required': 'needed',
    'sufficient': 'enough', 'insufficient': 'not enough',
    'additional': 'extra', 'numerous': 'many',
    'approximately': 'about', 'subsequently': 'then', 'previously': 'before',
    'consequently': 'so', 'furthermore': 'also', 'moreover': 'also',
    'in order to': 'to', 'due to the fact that': 'because', 'in the event that': 'if',
    'a number of': 'some', 'a majority of': 'most', 'the majority of': 'most',
    'endeavor': 'try', 'utilization': 'use'
  };
  var simpleRegex = new RegExp('\\b(' + Object.keys(simpleReplacements).join('|') + ')\\b', 'gi');

  var simpleObserver = null;
  var simpleOriginals = new WeakMap();

  function simplifyTextNode(node) {
    if (!node || !node.nodeValue) return;
    var text = node.nodeValue;
    if (!simpleRegex.test(text)) return;
    simpleRegex.lastIndex = 0;
    if (!simpleOriginals.has(node)) simpleOriginals.set(node, text);
    node.nodeValue = text.replace(simpleRegex, function (m) {
      var key = m.toLowerCase();
      return simpleReplacements[key] || m;
    });
  }

  function revertTextNode(node) {
    if (!node || !node.nodeValue) return;
    if (simpleOriginals.has(node)) node.nodeValue = simpleOriginals.get(node);
  }

  function walkSimplify(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        var tag = p.nodeName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'CODE' || tag === 'PRE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = walker.nextNode())) simplifyTextNode(n);
  }

  function walkRevert(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) revertTextNode(n);
  }

  function applySimpleMode() {
    var targets = [
      document.getElementById('startScreen'),
      document.getElementById('tutorialScreen'),
      document.getElementById('sectionSelection'),
      document.getElementById('learnScreen'),
      document.getElementById('quizContainer'),
      document.getElementById('resultsContainer')
    ];
    targets.forEach(walkSimplify);

    if (simpleObserver) simpleObserver.disconnect();
    simpleObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) walkSimplify(n);
          else if (n.nodeType === 3) simplifyTextNode(n);
        });
      });
    });
    simpleObserver.observe(document.body, { childList: true, subtree: true });
  }

  function revertSimpleMode() {
    if (simpleObserver) { simpleObserver.disconnect(); simpleObserver = null; }
    var targets = [
      document.getElementById('startScreen'),
      document.getElementById('tutorialScreen'),
      document.getElementById('sectionSelection'),
      document.getElementById('learnScreen'),
      document.getElementById('quizContainer'),
      document.getElementById('resultsContainer')
    ];
    targets.forEach(walkRevert);
  }

  /* ── SLOW SPEECH ───────────────────────────────────────── */
  function enableSlowSpeech(enabled) {
    a11y.slowSpeech = enabled;
    localStorage.setItem('a11y-slow-speech', enabled);
    updateToggleUI('slow_speech', enabled);
  }

  /* ── REDUCE MOTION ─────────────────────────────────────── */
  function enableReduceMotion(enabled) {
    a11y.reduceMotion = enabled;
    document.body.classList.toggle('reduce-motion', enabled);
    localStorage.setItem('a11y-reduce-motion', enabled);
    updateToggleUI('reduce_motion', enabled);
  }

  /* ── SOUND ─────────────────────────────────────────────── */
  function enableSound(enabled) {
    a11y.soundEnabled = enabled;
    if (pingPong) pingPong.mute(!enabled);
    localStorage.setItem('a11y-sound', enabled);
    updateToggleUI('sound', enabled);
  }

  /* ── Toggle dispatcher ─────────────────────────────────── */
  var featureMap = {
    high_contrast: function () { enableHighContrast(!a11y.highContrast); },
    large_text:    function () { enableLargeText(!a11y.largeText); },
    tts:           function () { enableTTS(!a11y.ttsEnabled); },
    slow_speech:   function () { enableSlowSpeech(!a11y.slowSpeech); },
    sound:         function () { enableSound(!a11y.soundEnabled); },
    simple_mode:   function () { enableSimpleMode(!a11y.simpleMode); },
    reduce_motion: function () { enableReduceMotion(!a11y.reduceMotion); }
  };

  /* ── Update toggle button UI ───────────────────────────── */
  function updateToggleUI(feature, enabled) {
    if (!modal) return;
    var btn = modal.querySelector('.toggle-btn[data-feature="' + feature + '"]');
    if (btn) {
      btn.setAttribute('aria-checked', enabled ? 'true' : 'false');
      btn.classList.toggle('active', enabled);
    }
  }

  /* ── Wire up toggle buttons ────────────────────────────── */
  toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var feature = btn.getAttribute('data-feature');
      var fn = featureMap[feature];
      if (fn) fn();
    });
  });

  /* ── Restore saved preferences ─────────────────────────── */
  function restorePreferences() {
    if (localStorage.getItem('a11y-contrast')       === 'true') enableHighContrast(true);
    if (localStorage.getItem('a11y-large')           === 'true') enableLargeText(true);
    if (localStorage.getItem('a11y-simple')          === 'true') enableSimpleMode(true);
    if (localStorage.getItem('a11y-tts')             === 'true') enableTTS(true);
    if (localStorage.getItem('a11y-slow-speech')     === 'true') enableSlowSpeech(true);
    if (localStorage.getItem('a11y-reduce-motion')   === 'true') enableReduceMotion(true);
    var soundSaved = localStorage.getItem('a11y-sound');
    if (soundSaved !== null) enableSound(soundSaved === 'true');
  }

  restorePreferences();

  /* ── Keyboard: Escape closes modal ─────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeA11y();
    }
  });

  /* ── Expose on app for other modules to use ────────────── */
  if (window.app) {
    app.a11y = a11y;
    app.openA11y = openA11y;
    app.closeA11y = closeA11y;
    app.speak = speak;
    app.playClickSound = playClickSound;
  }
})();
