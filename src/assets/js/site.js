// Shared behaviour: sending the contact and newsletter forms with on-page feedback.
(function () {
  'use strict';

  // ----- forms (contact + newsletter), sent to send.php on the website -----
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(form) {
    var firstBad = null;
    form.querySelectorAll('[required]').forEach(function (field) {
      var val = (field.value || '').trim();
      var ok = field.type === 'checkbox' ? field.checked : val.length > 0 && (field.type !== 'email' || EMAIL.test(val));
      var err = document.getElementById(field.id + '-err');
      field.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (err) {
        err.hidden = ok;
        if (!ok) field.setAttribute('aria-describedby', err.id); else field.removeAttribute('aria-describedby');
      }
      if (!ok && !firstBad) firstBad = field;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  document.querySelectorAll('form[data-ajax-form]').forEach(function (form) {
    var status = form.querySelector('.form-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';
      if (!validate(form)) {
        if (!form.querySelector('.field__error')) {
          status.classList.add('is-error');
          status.textContent = 'Enter a valid email address.';
        }
        return;
      }
      var button = form.querySelector('[type="submit"]');
      button.disabled = true;
      if (document.body.dataset.preview) {
        button.disabled = false;
        status.classList.add('is-error');
        status.textContent = "This is a preview, so the form can't send yet. It will work once the site is live.";
        status.setAttribute('tabindex', '-1');
        status.focus();
        return;
      }
      var data = new URLSearchParams(new FormData(form)).toString();
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: data })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (j) {
            if (!res.ok || !j.ok) { var err = new Error('HTTP ' + res.status); err.userMessage = res.status === 422 ? j.message : ''; throw err; }
          });
        })
        .then(function () {
          form.reset();
          status.classList.add('is-ok');
          status.textContent = form.getAttribute('name') === 'review'
            ? "Thanks for your review! We'll read it before it appears on the site."
            : form.getAttribute('name') === 'newsletter'
            ? "You're signed up. Thanks for joining."
            : "Message sent. Thanks for getting in touch. We'll reply by email.";
        })
        .catch(function (err) {
          status.classList.add('is-error');
          status.textContent = (err && err.userMessage) || 'Your message could not be sent. Check your connection and try again, or email us directly.';
        })
        .finally(function () {
          button.disabled = false;
          status.setAttribute('tabindex', '-1');
          status.focus();
        });
    });
  });
})();

// Front/back cover switch on book pages. Without JavaScript the thumbnails open the full image.
(function () {
  document.querySelectorAll('.cover-switch').forEach(function (group) {
    var main = (group.closest('.book__cover') || group.parentElement).querySelector('.cover img');
    if (!main) return;
    group.querySelectorAll('[data-cover-src]').forEach(function (btn) {
      btn.setAttribute('role', 'button');
      btn.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); btn.click(); } });
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        main.src = btn.href;
        main.alt = btn.getAttribute('data-cover-alt');
        main.parentElement.classList.toggle('is-back', btn !== group.querySelector('[data-cover-src]'));
        group.querySelectorAll('[data-cover-src]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      });
    });
  });
})();

// Home page banner: featured books take turns, fading in and out every few seconds.
// Pauses on hover or keyboard focus, has a pause button, and stays still if the visitor prefers reduced motion.
(function () {
  var box = document.querySelector('[data-hero-cycle]');
  if (!box) return;
  var slides = Array.prototype.slice.call(box.querySelectorAll('.bold-hero__book'));
  var dots = Array.prototype.slice.call(box.querySelectorAll('[data-hero-dot]'));
  var pauseBtn = box.querySelector('[data-hero-pause]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0, timer = null, paused = reduce, hovering = false;
  function show(n) {
    current = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) {
      var on = i === current;
      s.classList.toggle('is-active', on);
      if (on) { s.removeAttribute('inert'); s.removeAttribute('aria-hidden'); } else { s.setAttribute('inert', ''); s.setAttribute('aria-hidden', 'true'); }
    });
    dots.forEach(function (d, i) { if (i === current) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
  }
  function stop() { clearInterval(timer); timer = null; }
  function start() { stop(); if (!paused && !hovering) timer = setInterval(function () { show(current + 1); }, 5000); }
  function setPaused(p) {
    paused = p;
    pauseBtn.setAttribute('aria-pressed', String(p));
    pauseBtn.querySelector('.visually-hidden').textContent = p ? 'Play the featured books' : 'Pause the featured books';
    start();
  }
  dots.forEach(function (d, i) { d.addEventListener('click', function () { show(i); start(); }); });
  pauseBtn.addEventListener('click', function () { setPaused(!paused); });
  box.addEventListener('mouseenter', function () { hovering = true; stop(); });
  box.addEventListener('mouseleave', function () { hovering = false; start(); });
  box.addEventListener('focusin', function () { hovering = true; stop(); });
  box.addEventListener('focusout', function () { hovering = false; start(); });
  if (reduce) setPaused(true); else start();
})();

// Audio excerpts: turns each standard audio player into the site's own player.
// Without JavaScript the browser's standard player is shown instead. Only one excerpt plays at a time.
(function () {
  var players = Array.prototype.slice.call(document.querySelectorAll('[data-player]'));
  if (!players.length) return;
  function fmt(s) { if (!isFinite(s)) return '–:––'; s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  var audios = [];
  players.forEach(function (box, index) {
    var audio = box.querySelector('audio');
    var btn = box.querySelector('[data-play]');
    var track = box.querySelector('.player__track');
    var seek = box.querySelector('[data-seek]');
    var now = box.querySelector('[data-now]');
    var total = box.querySelector('[data-total]');
    var title = btn.getAttribute('aria-label').replace(/^Play: /, '');
    audios.push(audio);
    box.classList.add('is-enhanced');
    btn.hidden = false; track.hidden = false;
    function paint() {
      var d = audio.duration, c = audio.currentTime;
      var pct = isFinite(d) && d > 0 ? (c / d) * 100 : 0;
      if (!seek.matches(':active')) seek.value = pct;
      seek.style.setProperty('--pct', pct + '%');
      now.textContent = fmt(c);
      total.textContent = fmt(d);
      seek.setAttribute('aria-valuetext', fmt(c) + ' of ' + fmt(d));
    }
    // The small Listen tile(s) beside the cover thumbnails play the same excerpt.
    var tiles = Array.prototype.slice.call(document.querySelectorAll('[data-listen="' + index + '"]'));
    tiles.forEach(function (tile) {
      tile.setAttribute('role', 'button');
      tile.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); tile.click(); } });
      tile.addEventListener('click', function (e) { e.preventDefault(); btn.click(); });
    });
    function paintTiles() {
      var d = audio.duration, c = audio.currentTime, started = c > 0.05 && !audio.ended;
      tiles.forEach(function (tile) {
        tile.style.setProperty('--pct', (isFinite(d) && d > 0 ? (c / d) * 100 : 0) + '%');
        var label = tile.querySelector('[data-listen-label]');
        if (!label.hasAttribute('data-name')) label.setAttribute('data-name', label.textContent);
        label.textContent = started ? fmt(c) : label.getAttribute('data-name');
      });
    }
    function state() {
      var playing = !audio.paused && !audio.ended;
      box.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-label', (playing ? 'Pause: ' : 'Play: ') + title);
      tiles.forEach(function (tile) {
        tile.classList.toggle('is-playing', playing);
        tile.setAttribute('aria-label', (playing ? 'Pause excerpt: ' : 'Play excerpt: ') + title);
      });
      paintTiles();
    }
    btn.addEventListener('click', function () {
      if (audio.paused) {
        audios.forEach(function (a) { if (a !== audio) a.pause(); });
        audio.play().catch(function () {});
      } else audio.pause();
    });
    // Arrow keys skip 5 seconds, Page Up/Down 30 seconds, Home/End to the start/end.
    seek.addEventListener('keydown', function (e) {
      var d = audio.duration; if (!isFinite(d)) return;
      var jump = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30 }[e.key];
      if (e.key === 'Home') audio.currentTime = 0;
      else if (e.key === 'End') audio.currentTime = Math.max(0, d - 0.5);
      else if (jump) audio.currentTime = Math.min(d, Math.max(0, audio.currentTime + jump));
      else return;
      e.preventDefault(); paint();
    });
    seek.addEventListener('input', function () {
      if (isFinite(audio.duration)) { audio.currentTime = (seek.value / 100) * audio.duration; }
      seek.style.setProperty('--pct', seek.value + '%');
    });
    ['play', 'pause', 'ended'].forEach(function (ev) { audio.addEventListener(ev, state); });
    ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach(function (ev) { audio.addEventListener(ev, paint); audio.addEventListener(ev, paintTiles); });
    audio.addEventListener('ended', function () { audio.currentTime = 0; paint(); paintTiles(); });
    paint();
  });
})();

// Menus: drop-downs on wide screens, and a Menu button on phones.
(function () {
  document.documentElement.classList.add('js');
  var dds = Array.prototype.slice.call(document.querySelectorAll('.dd'));
  function closeAll(except) { dds.forEach(function (d) { if (d !== except) d.querySelector('.dd__btn').setAttribute('aria-expanded', 'false'); }); }
  dds.forEach(function (d) {
    var btn = d.querySelector('.dd__btn');
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      closeAll(d); btn.setAttribute('aria-expanded', String(!open));
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
    d.addEventListener('focusout', function (e) { if (!d.contains(e.relatedTarget) && window.innerWidth > 820) btn.setAttribute('aria-expanded', 'false'); });
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.dd') && window.innerWidth > 820) closeAll(); });
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;
  toggle.hidden = false;
  var label = toggle.querySelector('.menu-toggle__label');
  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    label.textContent = open ? 'Close' : 'Menu';
  }
  toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true' && window.innerWidth <= 820) { setOpen(false); toggle.focus(); } });
  // On a section page, open that section's list when the phone menu opens.
  dds.forEach(function (d) { if (d.classList.contains('is-current') && window.innerWidth <= 820) d.querySelector('.dd__btn').setAttribute('aria-expanded', 'true'); });
})();
