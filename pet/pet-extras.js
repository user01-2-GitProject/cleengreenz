// Pet Chris extras: idle fidgets, dozing and a lead cheer.
// Layers on top of the pet built in index.html without touching its state
// machine. It sets wrap.dataset.frame to ask the pet loop for a sprite frame
// while Chris is standing at home, and adds a few classes and floating bits.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HOME_X = 4;
  var F = { lookLeft: 6, lookRight: 7, cheer: 8, stretch: 9, doze: 10 };
  var wrap, bubble;
  var busy = false, timers = [], bubbleTimer = null, zTimer = null;
  var lastActivity = Date.now(), nextFidget = 0, sleeping = false;
  var SLEEP_AFTER = 25000;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function setup() {
    if (wrap && wrap.isConnected) return true;
    wrap = document.querySelector('.pet-wrap');
    if (!wrap) return false;
    bubble = wrap.querySelector('.pet-bubble');
    nextFidget = Date.now() + rnd(6000, 10000);
    return true;
  }

  // Chris is free for extras only while he is standing at home.
  function atHome() {
    if (!wrap || !wrap.isConnected) return false;
    if (wrap.classList.contains('walking') || wrap.classList.contains('blowing')) return false;
    var m = /translate3d\(([-\d.]+)px/.exec(wrap.style.transform || '');
    return m ? Math.abs(parseFloat(m[1]) - HOME_X) < 2 : false;
  }

  function setFrame(f) {
    if (f == null) delete wrap.dataset.frame;
    else wrap.dataset.frame = f;
  }

  // Play a list of [frame, ms, className] steps, then go back to normal.
  function play(steps) {
    stop();
    busy = true;
    var t = 0;
    steps.forEach(function (s) {
      timers.push(setTimeout(function () {
        setFrame(s[0]);
        if (s[2] && !reduceMotion) { wrap.classList.remove(s[2]); void wrap.offsetWidth; wrap.classList.add(s[2]); }
      }, t));
      t += s[1];
    });
    timers.push(setTimeout(function () { stop(); }, t));
  }
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    busy = false;
    if (!wrap) return;
    wrap.classList.remove('x-hop', 'x-cheer');
    if (!sleeping) setFrame(null);
  }

  function say(text, ms) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.hidden = false;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.hidden = true; }, ms);
  }

  function float(text, cls, dx) {
    if (reduceMotion || !wrap) return;
    var el = document.createElement('span');
    el.className = 'px-float' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.setAttribute('aria-hidden', 'true');
    el.style.setProperty('--dx', (dx || rnd(4, 16)) + 'px');
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 2700);
  }

  function confetti() {
    if (reduceMotion || !wrap) return;
    var colors = ['#e2702a', '#f2b134', '#4fa83a', '#b8431e', '#7fcf4f'];
    for (var i = 0; i < 14; i++) {
      var c = document.createElement('span');
      c.className = 'px-confetti';
      c.setAttribute('aria-hidden', 'true');
      c.style.background = colors[i % colors.length];
      var a = rnd(-2.8, -0.35), d = rnd(40, 80);
      c.style.setProperty('--dx', Math.round(Math.cos(a) * d / 4) * 4 + 'px');
      c.style.setProperty('--dy', Math.round(Math.sin(a) * d / 4) * 4 + 'px');
      wrap.appendChild(c);
      setTimeout(function (el) { el.remove(); }.bind(null, c), 1200);
    }
  }

  var fidgets = [
    function () { play([[F.lookLeft, 800], [0, 250], [F.lookRight, 800]]); },
    function () { play([[F.stretch, 1300]]); },
    function () { play([[0, 500, 'x-hop']]); },
    function () { play([[0, 1200]]); float('♪'); setTimeout(function () { float('♫'); }, 450); }
  ];

  function sleep() {
    sleeping = true;
    stop();
    setFrame(F.doze);
    if (!reduceMotion) {
      var n = 0;
      zTimer = setInterval(function () { float(n++ % 2 ? 'z' : 'Z', 'zz', rnd(8, 18)); }, 900);
    }
  }
  function unsleep() {
    sleeping = false;
    clearInterval(zTimer);
    setFrame(null);
  }
  // Returns true if Chris was asleep and just woke up.
  function wake() {
    lastActivity = Date.now();
    if (!sleeping) return false;
    unsleep();
    play([[0, 500, 'x-hop']]);
    say(['Huh? I was just resting my eyes.', 'Oh! Hi there.', 'I\'m up, I\'m up!'][Math.floor(Math.random() * 3)], 2600);
    nextFidget = Date.now() + rnd(8000, 14000);
    return true;
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (!wake()) lastActivity = Date.now(); }, { passive: true });
  });
  var scrollWake = null;
  window.addEventListener('scroll', function () {
    lastActivity = Date.now();
    if (!sleeping) return;
    clearTimeout(scrollWake);
    scrollWake = setTimeout(wake, 150);
  }, { passive: true });

  // Celebrate new leads coming in.
  document.addEventListener('cg:lead', function (e) {
    var type = e.detail && e.detail.lead_type;
    if (type !== 'form' && type !== 'call' && type !== 'email') return;
    if (!setup()) return;
    if (sleeping) unsleep();
    if (type === 'form') {
      play([[F.cheer, 1600, 'x-cheer']]);
      confetti();
      setTimeout(function () { say('Woohoo! Chris will call you soon.', 4000); }, 50);
    } else if (type === 'call' || type === 'email') {
      play([[F.cheer, 900, 'x-hop']]);
      setTimeout(function () { say('Talk soon!', 2500); }, 50);
    }
  });

  function tick() {
    if (!setup()) return;
    var now = Date.now();
    if (!atHome()) {
      if (sleeping) unsleep();
      // Fidget soon after he gets back, before the pet heads out again.
      nextFidget = now + rnd(1200, 3000);
      return;
    }
    if (sleeping || busy || (bubble && !bubble.hidden)) return;
    if (now - lastActivity > SLEEP_AFTER) { sleep(); return; }
    if (now > nextFidget && !reduceMotion) {
      fidgets[Math.floor(Math.random() * fidgets.length)]();
      nextFidget = now + rnd(7000, 13000);
    }
  }
  setInterval(tick, 400);
})();
