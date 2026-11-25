/* ============================================================
   Happy Birthday, Snigtha — interactions
   One rAF engine drives the sky, the marquee, parallax, reveals,
   the dock and the progress bar, so the page stays in step.
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  docEl.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

  /* ------------------------------------------------------------
     headline split
     ------------------------------------------------------------ */

  var titleEl = document.querySelector('[data-split]');

  function splitTitle() {
    if (!titleEl) return;
    var lines = Array.prototype.slice.call(titleEl.querySelectorAll('.hero-line > span'));
    if (!lines.length) return;

    // Join the lines with real spaces: the markup has no whitespace between
    // them, and screen readers would otherwise say "HappyBirthday,Snigtha".
    var fullText = lines.map(function (line) {
      return line.textContent.trim();
    }).filter(Boolean).join(' ');
    titleEl.setAttribute('aria-label', fullText);

    var index = 0;
    lines.forEach(function (line) {
      var text = line.textContent;
      line.setAttribute('aria-hidden', 'true');
      line.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        span.style.setProperty('--d', (0.12 + index * 0.042).toFixed(3) + 's');
        line.appendChild(span);
        index++;
      }
    });
  }

  /* ------------------------------------------------------------
     the seal gate
     ------------------------------------------------------------ */

  var gate = document.getElementById('gate');
  var gateSeal = document.getElementById('gateSeal');
  var mainEl = document.querySelector('main');
  var introStarted = false;

  function startIntro() {
    if (introStarted) return;
    introStarted = true;
    docEl.classList.add('intro-on');
    if (titleEl) titleEl.classList.add('intro');
    // Safety net: if the animation never runs, the headline still shows.
    window.setTimeout(function () {
      docEl.classList.add('intro-done');
      if (titleEl) titleEl.classList.add('intro-done');
    }, 2600);
  }

  function openGate() {
    if (!gate || gate.classList.contains('is-opening')) return;
    gate.classList.add('is-opening');
    docEl.classList.remove('gate-locked');
    if (mainEl) mainEl.inert = false;
    try { sessionStorage.setItem('snigthaGate', '1'); } catch (err) {}
    window.setTimeout(function () {
      gate.classList.add('is-gone');
      // Belt and braces: take it out of the layer entirely once it has faded,
      // so it can never sit over the page on a slow or stalled compositor.
      window.setTimeout(function () { gate.classList.add('is-done'); }, 1100);
      startIntro();
    }, reduceMotion ? 60 : 640);
  }

  splitTitle();

  if (gate && gateSeal) {
    var seenGate = false;
    try { seenGate = sessionStorage.getItem('snigthaGate') === '1'; } catch (err) {}
    if (seenGate) {
      gate.classList.add('is-gone', 'is-done');
      startIntro();
    } else {
      docEl.classList.add('gate-locked');
      if (mainEl) mainEl.inert = true;
      gateSeal.addEventListener('click', openGate);
      try { gateSeal.focus({ preventScroll: true }); } catch (err) { gateSeal.focus(); }
    }
  } else {
    startIntro();
  }

  /* ------------------------------------------------------------
     one frame loop for everything
     ------------------------------------------------------------ */

  var Engine = (function () {
    var fns = [];
    var raf = null;
    var prev = 0;

    function frame(now) {
      var dt = prev ? Math.min(now - prev, 64) : 16;
      prev = now;
      for (var i = 0; i < fns.length; i++) fns[i](dt, now);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf) return;
      prev = 0;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = null;
      prev = 0;
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (fns.length) start();
    });

    return {
      add: function (fn) {
        fns.push(fn);
        start();
      }
    };
  })();

  /* ------------------------------------------------------------
     layout measurements (cached, never read per frame)
     ------------------------------------------------------------ */

  var revealables = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  var photoFigures = Array.prototype.slice.call(document.querySelectorAll('.photo'));
  var heroEl = document.querySelector('.hero');
  var dock = document.getElementById('dock');
  var dockLinks = dock ? Array.prototype.slice.call(dock.querySelectorAll('a')) : [];
  var tracks = Array.prototype.slice.call(document.querySelectorAll('.marquee-track'));

  var marks = dockLinks.map(function (link) {
    return { link: link, el: document.querySelector(link.getAttribute('href')), top: 0 };
  }).filter(function (mark) { return !!mark.el; });

  var heroHeight = 0;
  var marqueeHalf = [];

  function measure() {
    var y = window.scrollY || 0;
    var i;

    for (i = 0; i < revealables.length; i++) {
      revealables[i]._top = revealables[i].getBoundingClientRect().top + y;
    }
    for (i = 0; i < photoFigures.length; i++) {
      var box = photoFigures[i].getBoundingClientRect();
      photoFigures[i]._top = box.top + y;
      photoFigures[i]._h = box.height;
    }
    for (i = 0; i < marks.length; i++) {
      marks[i].top = marks[i].el.getBoundingClientRect().top + y;
    }
    heroHeight = heroEl ? heroEl.getBoundingClientRect().height : 0;
    for (i = 0; i < tracks.length; i++) {
      marqueeHalf[i] = tracks[i].scrollWidth / 2 || 0;
    }
  }

  function revealPass() {
    var vh = window.innerHeight || 800;
    var trigger = (window.scrollY || 0) + vh * 0.92;
    for (var i = 0; i < revealables.length; i++) {
      var el = revealables[i];
      if (el.classList.contains('is-in')) continue;
      // Anything that has reached the viewport (or passed it) is shown, so
      // content can never be left permanently invisible.
      if (el._top < trigger) el.classList.add('is-in');
    }
  }

  function parallaxPass() {
    if (reduceMotion || !heroEl) return;
    var y = window.scrollY || 0;
    var p = clamp(y / (heroHeight || 1), 0, 1);
    heroEl.style.setProperty('--hero-copy-y', (p * 58).toFixed(1) + 'px');
    heroEl.style.setProperty('--hero-portrait-y', (p * -46).toFixed(1) + 'px');
    heroEl.style.setProperty('--hero-fade', (1 - p * 0.72).toFixed(3));

    var vh = window.innerHeight || 800;
    var mid = y + vh / 2;
    for (var i = 0; i < photoFigures.length; i++) {
      var el = photoFigures[i];
      if (!el._h) continue;
      var rel = clamp((el._top + el._h / 2 - mid) / vh, -1, 1);
      el.style.setProperty('--py', (rel * -26).toFixed(1) + 'px');
    }
  }

  var dockVisible = false;
  var activeMark = null;

  function dockPass() {
    if (!dock) return;
    var y = window.scrollY || 0;
    var shouldShow = y > heroHeight * 0.7;
    if (shouldShow !== dockVisible) {
      dockVisible = shouldShow;
      dock.classList.toggle('is-visible', shouldShow);
    }
    var active = null;
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].top <= y + window.innerHeight * 0.4) active = marks[i];
    }
    if (active !== activeMark) {
      if (activeMark) activeMark.link.classList.remove('is-active');
      if (active) active.link.classList.add('is-active');
      activeMark = active;
    }
  }

  var progress = document.getElementById('progress');
  var lastProgress = -1;

  function progressPass() {
    if (!progress) return;
    var max = docEl.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? clamp((window.scrollY || 0) / max, 0, 1) : 0;
    if (Math.abs(ratio - lastProgress) < 0.0005) return;
    lastProgress = ratio;
    progress.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
  }

  var smoothVelocity = 0;
  var lastScrollY = window.scrollY || 0;

  function marqueePass(dt) {
    if (reduceMotion) return;
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      var half = marqueeHalf[i];
      if (!half) continue;
      var reverse = track.classList.contains('marquee-reverse');
      var speed = (reverse ? 26 : 34) + Math.min(Math.abs(smoothVelocity) * 24, 230);
      track._x = (track._x || 0) + (speed * dt) / 1000;
      var x = track._x % half;
      if (x < 0) x += half;
      var shift = reverse ? x - half : -x;
      track.style.transform = 'translate3d(' + shift.toFixed(2) + 'px,0,0)';
    }
  }

  /* ------------------------------------------------------------
     the sky
     ------------------------------------------------------------ */

  var canvas = document.getElementById('sky');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  var stars = [];
  var hearts = [];
  var fireworks = [];
  var fireworkColors = ['#f7ccc6', '#f5dfbd', '#ded6ee', '#fdf6ef', '#e9a5a5', '#e8c48a'];
  var dpr = 1;
  var w = 0;
  var h = 0;
  var lastHearts = 0;

  function resizeSky() {
    if (!ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.round(Math.min(110, Math.max(34, w / 15)));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.55 + 0.12,
        vy: Math.random() * 0.16 + 0.04,
        vx: (Math.random() - 0.5) * 0.08,
        tw: Math.random() * Math.PI * 2,
        tws: Math.random() * 0.02 + 0.005
      });
    }
  }

  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.3);
    c.bezierCurveTo(x, y, x - s, y - s * 0.1, x - s, y + s * 0.5);
    c.bezierCurveTo(x - s, y + s * 1.05, x, y + s * 1.3, x, y + s * 1.6);
    c.bezierCurveTo(x, y + s * 1.3, x + s, y + s * 1.05, x + s, y + s * 0.5);
    c.bezierCurveTo(x + s, y - s * 0.1, x, y, x, y + s * 0.3);
    c.closePath();
  }

  function drawSky() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.y -= s.vy;
      s.x += s.vx;
      s.tw += s.tws;
      if (s.y < -4) { s.y = h + 4; s.x = Math.random() * w; }
      if (s.x < -4) s.x = w + 4;
      if (s.x > w + 4) s.x = -4;

      var alpha = s.a * (0.62 + 0.38 * Math.sin(s.tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253, 246, 239, ' + alpha.toFixed(3) + ')';
      ctx.fill();
    }

    var now = performance.now();
    if (now - lastHearts > 2400 && hearts.length < 8) {
      lastHearts = now;
      hearts.push({
        x: Math.random() * w,
        y: h + 26,
        s: Math.random() * 5 + 4,
        vy: Math.random() * 0.28 + 0.16,
        drift: (Math.random() - 0.5) * 0.22,
        a: 0,
        phase: 0
      });
    }

    for (var j = hearts.length - 1; j >= 0; j--) {
      var p = hearts[j];
      p.y -= p.vy;
      p.x += p.drift;
      p.phase += 0.014;
      p.a = Math.min(p.a + 0.006, 0.16) * (p.y < h * 0.18 ? Math.max(0, p.y / (h * 0.18)) : 1);

      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.fillStyle = '#e9a5a5';
      heartPath(ctx, p.x + Math.sin(p.phase) * 12, p.y, p.s);
      ctx.fill();
      ctx.restore();

      if (p.y < -40) hearts.splice(j, 1);
    }

    for (var f = fireworks.length - 1; f >= 0; f--) {
      var fw = fireworks[f];
      fw.vy += 0.032;
      fw.vx *= 0.986;
      fw.vy *= 0.986;
      fw.x += fw.vx;
      fw.y += fw.vy;
      fw.life -= fw.decay;
      if (fw.life <= 0) { fireworks.splice(f, 1); continue; }
      ctx.globalAlpha = Math.max(fw.life, 0);
      ctx.fillStyle = fw.color;
      ctx.beginPath();
      ctx.arc(fw.x, fw.y, fw.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawStillSky() {
    if (!ctx) return;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(253, 246, 239, ' + s.a.toFixed(3) + ')';
      ctx.fill();
    }
  }

  if (ctx) {
    resizeSky();
    window.addEventListener('resize', resizeSky, { passive: true });
    if (reduceMotion) drawStillSky();
  }

  /* ------------------------------------------------------------
     the frame
     ------------------------------------------------------------ */

  // These three run off scroll as well as the engine: if the frame loop is
  // throttled (hidden tab, stalled compositor), content still arrives.
  function refreshUI() {
    revealPass();
    dockPass();
    progressPass();
  }
  window.addEventListener('scroll', refreshUI, { passive: true });
  window.addEventListener('resize', refreshUI, { passive: true });

  Engine.add(function (dt) {
    var y = window.scrollY || 0;
    var raw = y - lastScrollY;
    lastScrollY = y;
    smoothVelocity += (raw - smoothVelocity) * 0.14;

    revealPass();
    parallaxPass();
    dockPass();
    progressPass();
    marqueePass(dt);
    if (!reduceMotion) drawSky();
  });

  /* ---------------------------------------------------------------
     measurement
     ------------------------------------------------------------ */

  var measureTimer = null;

  function scheduleMeasure(delay) {
    window.clearTimeout(measureTimer);
    measureTimer = window.setTimeout(function () {
      measure();
      lastProgress = -1;
      refreshUI();
    }, delay || 0);
  }

  if (reduceMotion) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  measure();
  window.addEventListener('load', function () { scheduleMeasure(0); });
  window.addEventListener('resize', function () { scheduleMeasure(140); }, { passive: true });
  window.addEventListener('orientationchange', function () { scheduleMeasure(240); }, { passive: true });
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(function () { scheduleMeasure(0); });
  }
  scheduleMeasure(600);
  scheduleMeasure(1800);

  /* ------------------------------------------------------------
     confetti
     ------------------------------------------------------------ */

  var palette = ['#e9a5a5', '#e8c48a', '#fdf6ef', '#c2777f', '#b7a6d6', '#f3d5bd'];

  function confetti(originX, originY, amount) {
    if (reduceMotion) return;
    var x = typeof originX === 'number' ? originX : window.innerWidth / 2;
    var y = typeof originY === 'number' ? originY : window.innerHeight * 0.38;
    var count = amount || 110;
    var frag = document.createDocumentFragment();
    var pieces = [];

    for (var i = 0; i < count; i++) {
      var piece = document.createElement('span');
      piece.className = 'confetti-piece';
      var size = Math.random() * 7 + 4;
      var round = Math.random() > 0.72;
      piece.style.width = size + 'px';
      piece.style.height = (round ? size : size * (Math.random() * 1.2 + 0.7)) + 'px';
      piece.style.background = palette[(Math.random() * palette.length) | 0];
      piece.style.borderRadius = round ? '50%' : '1px';
      piece.style.opacity = '0.95';
      frag.appendChild(piece);
      pieces.push(piece);
    }
    document.body.appendChild(frag);

    pieces.forEach(function (piece, i) {
      var angle = Math.random() * Math.PI * 2;
      var power = Math.random() * 240 + 60;
      var dx = Math.cos(angle) * power * (Math.random() * 0.9 + 0.4);
      var dy = Math.sin(angle) * power * 0.8 - (Math.random() * 160 + 60);
      var fall = window.innerHeight * (Math.random() * 0.5 + 0.55);
      var spin = (Math.random() - 0.5) * 1080;
      var duration = Math.random() * 1400 + 1700;

      var animation = piece.animate([
        { transform: 'translate3d(' + x + 'px,' + y + 'px,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate3d(' + (x + dx) + 'px,' + (y + dy) + 'px,0) rotate(' + (spin * 0.4) + 'deg)', opacity: 1, offset: 0.32 },
        { transform: 'translate3d(' + (x + dx * 1.35) + 'px,' + (y + dy + fall) + 'px,0) rotate(' + spin + 'deg)', opacity: 0 }
      ], {
        duration: duration,
        delay: i * 4,
        easing: 'cubic-bezier(.18,.62,.34,1)',
        fill: 'forwards'
      });

      animation.onfinish = function () { piece.remove(); };
      window.setTimeout(function () { piece.remove(); }, duration + i * 4 + 1200);
    });
  }

  var confettiBtn = document.getElementById('confettiBtn');
  if (confettiBtn) {
    confettiBtn.addEventListener('click', function () {
      var rect = confettiBtn.getBoundingClientRect();
      confetti(rect.left + rect.width / 2, rect.top, 120);
    });
  }

  /* ------------------------------------------------------------
     candles, wish, sparkler
     ------------------------------------------------------------ */

  var candles = Array.prototype.slice.call(document.querySelectorAll('.candle'));
  var cakeStage = document.querySelector('.cake-stage');
  var sparkler = document.getElementById('sparkler');
  var wishMsg = document.getElementById('wishMsg');
  var wishBtn = document.getElementById('wishBtn');
  var wishMade = false;

  function cakeLight() {
    var lit = 0;
    for (var i = 0; i < candles.length; i++) {
      if (!candles[i].classList.contains('is-out')) lit++;
    }
    if (cakeStage) {
      cakeStage.style.setProperty('--lit', (lit / (candles.length || 1)).toFixed(2));
    }
    if (sparkler) sparkler.classList.toggle('is-lit', lit === 0);
  }

  function blowOut(candle) {
    if (candle.classList.contains('is-out')) return;
    candle.classList.add('is-out');
    candle.setAttribute('aria-label', 'Candle blown out');
    candle.setAttribute('aria-pressed', 'true');
    cakeLight();
    if (candles.every(function (c) { return c.classList.contains('is-out'); })) {
      celebrateWish();
    }
  }

  function celebrateWish() {
    if (wishMade) return;
    wishMade = true;
    if (wishMsg) wishMsg.classList.add('is-on');
    confetti(window.innerWidth / 2, window.innerHeight * 0.45, 140);
    if (wishBtn) wishBtn.textContent = 'Wish granted';
  }

  candles.forEach(function (candle) {
    candle.addEventListener('click', function () { blowOut(candle); });
  });

  if (wishBtn) {
    wishBtn.addEventListener('click', function () {
      candles.forEach(function (candle, i) {
        if (candle.classList.contains('is-out')) return;
        window.setTimeout(function () { blowOut(candle); }, i * 140);
      });
    });
  }

  cakeLight();

  /* ------------------------------------------------------------
     cursor sparks
     ------------------------------------------------------------ */

  if (finePointer && !reduceMotion) {
    var lastSpark = 0;
    window.addEventListener('pointermove', function (e) {
      var now = performance.now();
      if (now - lastSpark < 55) return;
      lastSpark = now;
      var spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.left = (e.clientX - 2.5) + 'px';
      spark.style.top = (e.clientY - 2.5) + 'px';
      spark.style.setProperty('--dx', ((Math.random() - 0.5) * 34).toFixed(1) + 'px');
      spark.style.setProperty('--dy', (-Math.random() * 28 - 6).toFixed(1) + 'px');
      document.body.appendChild(spark);
      spark.addEventListener('animationend', function () { spark.remove(); });
      window.setTimeout(function () { spark.remove(); }, 1400);
    }, { passive: true });
  }

  /* ------------------------------------------------------------
     send some love
     ------------------------------------------------------------ */

  var loveBtn = document.getElementById('loveBtn');
  if (loveBtn) {
    loveBtn.addEventListener('click', function () {
      if (reduceMotion) return;
      var rect = loveBtn.getBoundingClientRect();
      var startX = rect.left + rect.width / 2;
      var startY = rect.top;

      for (var i = 0; i < 16; i++) {
        var heart = document.createElement('span');
        heart.className = 'love-heart';
        heart.textContent = '\u2665';
        heart.style.left = (startX + (Math.random() - 0.5) * 90) + 'px';
        heart.style.top = startY + 'px';
        heart.style.fontSize = (Math.random() * 16 + 12) + 'px';
        heart.style.opacity = '0';
        document.body.appendChild(heart);

        var drift = (Math.random() - 0.5) * 200;
        var rise = Math.random() * 320 + 200;

        var anim = heart.animate([
          { transform: 'translate3d(0,0,0) scale(.5)', opacity: 0 },
          { transform: 'translate3d(' + (drift * 0.4) + 'px,' + (-rise * 0.45) + 'px,0) scale(1)', opacity: 0.95, offset: 0.35 },
          { transform: 'translate3d(' + drift + 'px,' + (-rise) + 'px,0) scale(.85)', opacity: 0 }
        ], {
          duration: Math.random() * 1200 + 1900,
          delay: i * 60,
          easing: 'cubic-bezier(.2,.7,.3,1)',
          fill: 'forwards'
        });
        anim.onfinish = (function (el) {
          return function () { el.remove(); };
        })(heart);
        window.setTimeout((function (el) {
          return function () { el.remove(); };
        })(heart), 3800);
      }

      confetti(startX, startY - 10, 40);
    });
  }

  /* ------------------------------------------------------------
     reason cards: cursor light
     ------------------------------------------------------------ */

  Array.prototype.forEach.call(document.querySelectorAll('.reason'), function (card) {
    card.addEventListener('pointermove', function (e) {
      var rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', (((e.clientX - rect.left) / rect.width) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (((e.clientY - rect.top) / rect.height) * 100).toFixed(1) + '%');
    });
  });

  /* ------------------------------------------------------------
     photographs + lightbox
     ------------------------------------------------------------ */

  var frames = Array.prototype.slice.call(document.querySelectorAll('.photo-frame'));
  var lightbox = document.getElementById('lightbox');
  var lightboxImg = document.getElementById('lightboxImg');
  var lightboxCap = document.getElementById('lightboxCap');
  var lightboxClose = document.getElementById('lightboxClose');
  var lightboxPrev = document.getElementById('lightboxPrev');
  var lightboxNext = document.getElementById('lightboxNext');
  var currentPhoto = 0;
  var lightboxOpen = false;
  var lastFocus = null;

  function showPhoto(index) {
    if (!frames.length || !lightboxImg) return;
    currentPhoto = ((index % frames.length) + frames.length) % frames.length;
    var frame = frames[currentPhoto];
    var img = frame.querySelector('img');
    if (!img) return;
    lightboxImg.src = img.getAttribute('src');
    lightboxImg.alt = img.getAttribute('alt') || '';
    var figure = frame.closest ? frame.closest('figure') : null;
    var caption = figure ? figure.querySelector('figcaption') : null;
    if (lightboxCap) lightboxCap.textContent = caption ? caption.textContent : '';
  }

  function openLightbox(index, trigger) {
    if (!lightbox) return;
    lastFocus = trigger || null;
    showPhoto(index);
    lightboxOpen = true;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!lightbox || !lightboxOpen) return;
    lightboxOpen = false;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lastFocus) { lastFocus.focus(); lastFocus = null; }
  }

  frames.forEach(function (frame, index) {
    frame.addEventListener('click', function () { openLightbox(index, frame); });
  });

  if (lightbox) {
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox || event.target === lightboxClose) closeLightbox();
    });
    if (lightboxPrev) {
      lightboxPrev.addEventListener('click', function () { showPhoto(currentPhoto - 1); });
    }
    if (lightboxNext) {
      lightboxNext.addEventListener('click', function () { showPhoto(currentPhoto + 1); });
    }
    document.addEventListener('keydown', function (event) {
      if (!lightboxOpen) return;
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showPhoto(currentPhoto + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPhoto(currentPhoto - 1);
      } else if (event.key === 'Tab') {
        var items = [lightboxClose, lightboxPrev, lightboxNext].filter(Boolean);
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  var printBtn = document.getElementById('printBtn');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

  /* ------------------------------------------------------------
     balloons
     ------------------------------------------------------------ */

  var balloonLayer = document.getElementById('balloons');
  var balloonPalette = [
    ['#f7ccc6', '#c2777f'],
    ['#f5dfbd', '#d9b075'],
    ['#ded6ee', '#9c8bc0'],
    ['#f8e6dc', '#c9908f'],
    ['#e7d9f0', '#b088a8']
  ];

  function popBalloon(balloon) {
    if (balloon.classList.contains('is-popped')) return;
    var box = balloon.getBoundingClientRect();
    balloon.style.position = 'fixed';
    balloon.style.left = box.left + 'px';
    balloon.style.top = box.top + 'px';
    balloon.style.bottom = 'auto';
    balloon.classList.add('is-popped');
    confetti(box.left + box.width / 2, box.top + box.height / 2, 16);
    window.setTimeout(function () { balloon.remove(); }, 520);
  }

  function spawnBalloon(initial) {
    if (!balloonLayer || reduceMotion) return;
    if (balloonLayer.children.length > 7) return;

    var pair = balloonPalette[(Math.random() * balloonPalette.length) | 0];
    var balloon = document.createElement('span');
    balloon.className = 'balloon';
    balloon.style.left = (Math.random() * 86 + 3).toFixed(2) + '%';
    balloon.style.setProperty('--bdur', (Math.random() * 9 + 14).toFixed(1) + 's');
    balloon.style.setProperty('--bdelay', initial ? (-Math.random() * 12).toFixed(1) + 's' : '0s');
    balloon.style.setProperty('--sway', (Math.random() * 2 + 3.6).toFixed(1) + 's');
    balloon.style.setProperty('--c1', pair[0]);
    balloon.style.setProperty('--c2', pair[1]);
    balloon.innerHTML = '<span class="balloon-body"></span><span class="balloon-string"></span>';

    balloon.addEventListener('animationend', function (event) {
      if (event.animationName === 'balloon-rise') balloon.remove();
    });
    balloon.addEventListener('click', function () { popBalloon(balloon); });

    balloonLayer.appendChild(balloon);
  }

  if (balloonLayer && !reduceMotion) {
    for (var b = 0; b < 3; b++) spawnBalloon(true);
    window.setInterval(function () { spawnBalloon(false); }, 3200);
  }

  /* ------------------------------------------------------------
     the gift
     ------------------------------------------------------------ */

  var giftStage = document.querySelector('.gift-stage');
  var giftBox = document.getElementById('giftBox');
  var giftCard = document.getElementById('giftCard');

  if (giftStage && giftBox) {
    giftBox.addEventListener('click', function () {
      if (giftStage.classList.contains('is-open')) return;
      giftStage.classList.add('is-open');
      giftBox.setAttribute('aria-expanded', 'true');
      if (giftCard) giftCard.setAttribute('aria-hidden', 'false');

      var box = giftBox.getBoundingClientRect();
      confetti(box.left + box.width / 2, box.top + 20, 90);
      window.setTimeout(function () {
        confetti(window.innerWidth / 2, window.innerHeight * 0.42, 60);
      }, 520);
    });
  }

  /* ------------------------------------------------------------
     the oracle
     ------------------------------------------------------------ */

  var oracle = document.querySelector('.oracle');
  var oracleText = document.getElementById('oracleText');
  var oracleBtn = document.getElementById('oracleBtn');
  var oracleBusy = false;

  var fortunes = [
    'A year with fewer things to worry about and far more reasons to laugh.',
    'You will be right about something, and everyone will have to admit it.',
    'Someone is going to cook for you. Sit down and let them.',
    'The good kind of tired, at the end of a day that was entirely yours.',
    'A holiday with a view, and a photograph you keep for years.',
    'You will hear from someone you have been missing.',
    'Long phone calls that go nowhere and fix everything.',
    'A small win on a Tuesday. Entirely unearned, entirely deserved.',
    'More sleep. Genuinely. I have seen it.',
    'Something you have been putting off will be easier than you think.',
    'You will be thanked out loud, by someone who means it.',
    'A windowsill of plants that finally behaves itself.',
    'Cake. Not this one. Another one.',
    'Nobody will ask you where anything is for a whole weekend.',
    'A photograph where you actually like how you look. It exists.',
    'The good seat, the warm cup, the quiet hour. All three at once.'
  ];

  var oracleShuffle = null;

  function finalizeOracle() {
    if (!oracleBusy) return;
    oracleBusy = false;
    if (oracleShuffle) { window.clearInterval(oracleShuffle); oracleShuffle = null; }
    oracle.classList.remove('is-thinking');
    oracleText.textContent = fortunes[(Math.random() * fortunes.length) | 0];
    void oracleText.offsetWidth;
    oracleText.classList.add('is-landed');
  }

  if (oracle && oracleText && oracleBtn) {
    oracleBtn.addEventListener('click', function () {
      if (oracleBusy) return;
      oracleBusy = true;
      oracle.classList.add('is-thinking');
      oracleText.classList.remove('is-landed');

      if (oracleShuffle) window.clearInterval(oracleShuffle);
      oracleShuffle = window.setInterval(function () {
        oracleText.textContent = fortunes[(Math.random() * fortunes.length) | 0];
      }, 78);

      // Guaranteed landing, even if the shuffle ticker is throttled.
      window.setTimeout(finalizeOracle, 1150);
    });
  }

  /* ------------------------------------------------------------
     fireworks
     ------------------------------------------------------------ */

  function launchFirework(x, y) {
    if (reduceMotion) return;
    var color = fireworkColors[(Math.random() * fireworkColors.length) | 0];
    var count = 52;
    for (var i = 0; i < count; i++) {
      var angle = (Math.PI * 2 * i) / count;
      var speed = Math.random() * 3.1 + 1.1;
      fireworks.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        life: 1,
        decay: Math.random() * 0.008 + 0.007,
        size: Math.random() * 1.6 + 1,
        color: color
      });
    }
  }

  var fireworksBtn = document.getElementById('fireworksBtn');
  if (fireworksBtn) {
    if (reduceMotion) {
      fireworksBtn.textContent = 'Already lit, just for you';
    } else {
      fireworksBtn.addEventListener('click', function () {
        var baseY = window.innerHeight * 0.3;
        for (var i = 0; i < 7; i++) {
          (function (n) {
            window.setTimeout(function () {
              launchFirework(
                window.innerWidth * (0.15 + Math.random() * 0.7),
                baseY + (Math.random() - 0.5) * window.innerHeight * 0.3
              );
            }, n * 210);
          })(i);
        }
        confetti(window.innerWidth / 2, window.innerHeight * 0.55, 50);
      });
    }
  }
})();
