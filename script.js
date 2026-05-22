let currentPage = 0;

// ---- Intro sequence state ----
var introActive = false;
var introTimers = [];

function startVideoPreload() {
  document.querySelectorAll('.video-embed video').forEach(function (v) {
    if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
  });
}

function finalizeIntro() {
  if (!introActive) return;
  introActive = false;
  introTimers.forEach(clearTimeout);
  introTimers = [];
  document.documentElement.classList.remove('lights-flickering');
  document.documentElement.style.willChange = '';
  if (!document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.add('dark');
    var cb = document.getElementById('dark-toggle');
    if (cb) cb.checked = true;
    try { localStorage.setItem('theme', 'dark'); } catch (e) {}
  }
  var hc = document.querySelector('.homepage-content');
  if (hc) { hc.classList.add('fonts-ready-title'); hc.classList.add('fonts-ready'); }
  try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
  document.documentElement.classList.add('intro-complete');
  startVideoPreload();
}

// ---- Page navigation ----
function getPages() {
  return Array.from(document.querySelectorAll('.page'));
}

function goToPage(n) {
  const pages = getPages();
  if (n < 0 || n >= pages.length) return;

  // If user navigates away during intro, snap to final state
  if (introActive && n !== 0) finalizeIntro();

  pages[currentPage].querySelectorAll('video').forEach(function (v) { v.pause(); });

  pages[currentPage].classList.remove('active');
  pages[n].classList.add('active');
  currentPage = n;

  // Lazy-load videos on this page when first visited
  pages[n].querySelectorAll('video').forEach(function (v) {
    if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
  });

  // Preload next two pages' videos in the background
  if (n + 1 < pages.length) {
    pages[n + 1].querySelectorAll('video').forEach(function (v) {
      if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
    });
  }
  if (n + 2 < pages.length) {
    pages[n + 2].querySelectorAll('video').forEach(function (v) {
      if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
    });
  }

  const total = pages.length - 1;
  const progress = n === 0 ? 0 : (n / total) * 100;
  document.getElementById('progress-fill').style.width = progress + '%';

  const pagesEl = document.getElementById('header-pages');
  if (pagesEl) {
    pagesEl.textContent = n === 0
      ? ''
      : n.toString().padStart(2, '0') + ' \u2014 ' + total.toString().padStart(2, '0');
  }

  document.documentElement.classList.toggle('on-homepage', n === 0);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ---- Click video to play/pause (pointer devices only — mobile uses native controls) ----
if (window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.video-embed video').forEach(function (video) {
    video.addEventListener('click', function (e) {
      var controlsHeight = 44;
      var rect = video.getBoundingClientRect();
      if (e.clientY < rect.bottom - controlsHeight) {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      }
    });
  });
}

// ---- Font load: reveal header + run intro or skip ----
// Races fonts.ready against a 1s fallback to guarantee text always appears
var fontsRevealFired = false;
function onFontsReady() {
  if (fontsRevealFired) return;
  fontsRevealFired = true;

  var header = document.getElementById('site-header');
  if (header) header.classList.add('fonts-ready');

  var hc = document.querySelector('.homepage-content');

  if (introActive) {
    // Show only the title in light mode; byline/cta hidden until after flicker
    if (hc) hc.classList.add('fonts-ready-title');

    // Hint browser to prepare GPU layer for the upcoming filter animation
    document.documentElement.style.willChange = 'filter';

    var t1 = setTimeout(function () {
      document.documentElement.classList.add('lights-flickering');

      // Apply dark mode mid-flicker when brightness is near zero (~44%)
      var t2 = setTimeout(function () {
        document.documentElement.classList.add('dark');
        var cb = document.getElementById('dark-toggle');
        if (cb) cb.checked = true;
        try { localStorage.setItem('theme', 'dark'); } catch (e) {}
      }, 700);
      introTimers.push(t2);

      // After flicker ends, reveal byline/CTA and start video preload
      var t3 = setTimeout(function () {
        document.documentElement.classList.remove('lights-flickering');
        document.documentElement.style.willChange = '';
        if (hc) hc.classList.add('fonts-ready');
        introActive = false;
        try { sessionStorage.setItem('intro-seen', '1'); } catch (e) {}
        document.documentElement.classList.add('intro-complete');
        startVideoPreload();
      }, 1800);
      introTimers.push(t3);

    }, 2400);
    introTimers.push(t1);

  } else {
    // Skip intro: reveal all homepage elements and start preloading
    if (hc) hc.classList.add('fonts-ready');
    setTimeout(startVideoPreload, 2500);
  }
}

document.fonts.ready.then(onFontsReady);
setTimeout(onFontsReady, 1000); // fallback: reveal text even if fonts.ready stalls

function goNext() { goToPage(currentPage + 1); }
function goPrev() { goToPage(currentPage - 1); }

// ---- Theme toggle ----
function toggleTheme(cb) {
  if (introActive) finalizeIntro();
  document.documentElement.classList.add('theme-transition');
  document.documentElement.classList.toggle('dark', cb.checked);
  try { localStorage.setItem('theme', cb.checked ? 'dark' : 'light'); } catch (e) {}
  setTimeout(function () { document.documentElement.classList.remove('theme-transition'); }, 500);
}

// ---- Init: decide whether to run intro or skip ----
(function () {
  var savedTheme, introSeen;
  try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
  try { introSeen = sessionStorage.getItem('intro-seen'); } catch (e) {}

  if (!introSeen) {
    // First visit this session: run the lights-out intro on all devices
    introActive = true;
    // Start in light mode — dark class intentionally NOT added yet
  } else {
    // Returning visit or already seen: restore theme (dark default)
    if (savedTheme !== 'light') {
      document.documentElement.classList.add('dark');
      var cb = document.getElementById('dark-toggle');
      if (cb) cb.checked = true;
    }
    document.documentElement.classList.add('intro-complete');
  }
})();

// ---- Flashlight: lazy-initialized on first mousemove (works for touchscreen laptops too) ----
document.documentElement.classList.add('on-homepage');
(function () {
  var canvas = document.getElementById('flashlight-canvas');
  var ctx = canvas.getContext('2d');
  var canvasW = 0, canvasH = 0;
  var fx = 0, fy = 0;
  var rafQueued = false;
  var ready = false;

  // Allocate gradient once — centered at origin, repositioned via ctx.translate each frame
  var spotGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 210);
  spotGrad.addColorStop(0,   'rgba(0,0,0,1)');
  spotGrad.addColorStop(0.3, 'rgba(0,0,0,1)');
  spotGrad.addColorStop(1,   'rgba(0,0,0,0)');

  var prevFx, prevFy;

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvasW = window.innerWidth;
    canvasH = window.innerHeight;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + 'px';
    canvas.style.height = canvasH + 'px';
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgb(5, 6, 12)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    prevFx = undefined;
    renderFlashlight();
  }

  function renderFlashlight() {
    // Restore previous spotlight to dark (dirty-rect — no full-canvas redraw)
    if (prevFx !== undefined) {
      ctx.fillStyle = 'rgb(5, 6, 12)';
      ctx.fillRect(prevFx - 215, prevFy - 215, 430, 430);
    }
    // Punch new hole
    ctx.save();
    ctx.translate(fx, fy);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = spotGrad;
    ctx.fillRect(-210, -210, 420, 420);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    prevFx = fx;
    prevFy = fy;
    rafQueued = false;
  }

  document.addEventListener('mousemove', function (e) {
    fx = e.clientX;
    fy = e.clientY;
    if (!ready) {
      ready = true;
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    }
    if (!rafQueued) {
      rafQueued = true;
      requestAnimationFrame(renderFlashlight);
    }
  });
})();

// ---- Keyboard navigation ----
document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'VIDEO') return;
  if (introActive) return; // don't allow navigation during the intro
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      goNext();
      break;
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      goPrev();
      break;
  }
});
