// Pet Chris extras: waving, idle fidgets, dozing and cheering.
// Layers on top of the pet built in index.html without touching its state
// machine. It only adds classes and small floating bits to .pet-wrap.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wrap, pet, bubble, px, arm;
  var action = null, actionTimer = null, bubbleTimer = null;
  var lastActivity = Date.now(), nextFidget = 0, sleeping = false;
  var SLEEP_AFTER = 25000;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function setup() {
    wrap = document.querySelector('.pet-wrap');
    if (!wrap || wrap.dataset.extras) return !!wrap;
    wrap.dataset.extras = '1';
    pet = wrap.querySelector('.pet');
    bubble = wrap.querySelector('.pet-bubble');
    var inner = wrap.querySelector('.pet-inner');

    // Wrap the drawing in a group we can squash and hop without fighting the
    // pet's own bob and facing transforms.
    px = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    px.setAttribute('class', 'px');
    while (inner.firstChild) px.appendChild(inner.firstChild);
    inner.appendChild(px);

    // The free arm (the one not holding the blower) becomes a waving arm.
    var sleeve = px.querySelector('rect[x="13"][y="38"]');
    var hand = px.querySelector('circle[cx="16"][cy="51"]');
    if (sleeve && hand) {
      arm = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      arm.setAttribute('class', 'arm-l');
      sleeve.parentNode.insertBefore(arm, sleeve);
      arm.appendChild(sleeve);
      arm.appendChild(hand);
    }

    // Let the eyes glance around without losing their blink.
    var eyes = px.querySelector('.eyes');
    if (eyes) {
      var look = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      look.setAttribute('class', 'eyes-look');
      eyes.parentNode.insertBefore(look, eyes);
      look.appendChild(eyes);
    }

    pet.addEventListener('click', function () {
      if (wake()) return;
      play('x-wave', 900);
    });
    nextFidget = Date.now() + rnd(6000, 10000);
    return true;
  }

  // The pet is only free for extras when it is standing at home.
  function atHome() {
    if (!wrap || !wrap.isConnected) return false;
    if (wrap.classList.contains('walking') || wrap.classList.contains('blowing')) return false;
    var m = /translate3d\(([-\d.]+)px/.exec(wrap.style.transform || '');
    return m ? Math.abs(parseFloat(m[1]) - 16) < 2 : false;
  }

  function play(cls, ms) {
    if (reduceMotion || !wrap) return;
    if (action) wrap.classList.remove(action);
    clearTimeout(actionTimer);
    void wrap.offsetWidth;
    action = cls;
    wrap.classList.add(cls);
    actionTimer = setTimeout(function () { wrap.classList.remove(cls); action = null; }, ms);
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
    var colors = ['#e2702a', '#f2b134', '#3aa64a', '#b8431e', '#2f9a41'];
    for (var i = 0; i < 12; i++) {
      var c = document.createElement('span');
      c.className = 'px-confetti';
      c.setAttribute('aria-hidden', 'true');
      c.style.background = colors[i % colors.length];
      var a = rnd(-2.6, -0.5);
      var d = rnd(30, 60);
      c.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
      c.style.setProperty('--dy', (Math.sin(a) * d).toFixed(0) + 'px');
      c.style.setProperty('--r', rnd(-300, 300).toFixed(0) + 'deg');
      wrap.appendChild(c);
      setTimeout(function (el) { el.remove(); }.bind(null, c), 1200);
    }
  }

  var fidgets = [
    function () { play('x-look', 2200); },
    function () { play('x-stretch', 1600); },
    function () { play('x-hop', 700); },
    function () { play('x-hop', 700); float('♪'); setTimeout(function () { float('♫'); }, 450); }
  ];

  var zTimer = null;
  function sleep() {
    sleeping = true;
    if (action) { wrap.classList.remove(action); action = null; }
    wrap.classList.add('x-sleep');
    if (!reduceMotion) {
      var n = 0;
      zTimer = setInterval(function () { float(n++ % 2 ? 'z' : 'Z', 'zz', rnd(8, 18)); }, 900);
    }
  }
  // Returns true if Chris was asleep and just woke up.
  function wake() {
    lastActivity = Date.now();
    if (!sleeping) return false;
    sleeping = false;
    clearInterval(zTimer);
    wrap.classList.remove('x-sleep');
    play('x-hop', 700);
    say(['Huh? I was just resting my eyes.', 'Oh! Hi there.', 'I\'m up, I\'m up!'][Math.floor(Math.random() * 3)], 2600);
    nextFidget = Date.now() + rnd(8000, 14000);
    return true;
  }

  ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      lastActivity = Date.now();
      if (sleeping && ev !== 'scroll') wake();
    }, { passive: true });
  });
  // Scrolling nudges him awake too, but only once the page has settled a bit.
  var scrollWake = null;
  window.addEventListener('scroll', function () {
    if (!sleeping) return;
    clearTimeout(scrollWake);
    scrollWake = setTimeout(wake, 150);
  }, { passive: true });

  // Celebrate new leads coming in.
  document.addEventListener('cg:lead', function (e) {
    if (!setup() || !wrap.isConnected) return;
    var type = e.detail && e.detail.lead_type;
    if (sleeping) wake();
    if (type === 'form') {
      play('x-cheer', 1200);
      confetti();
      say('Woohoo! Chris will call you soon.', 4000);
    } else {
      play('x-wave', 900);
      say('Talk soon!', 2500);
    }
  });

  function tick() {
    if (!setup()) return;
    if (!wrap.isConnected) { clearInterval(loop); return; }
    var now = Date.now();
    if (!atHome()) {
      if (sleeping) { sleeping = false; clearInterval(zTimer); wrap.classList.remove('x-sleep'); }
      nextFidget = now + rnd(6000, 10000);
      return;
    }
    if (sleeping || action || (bubble && !bubble.hidden)) return;
    if (now - lastActivity > SLEEP_AFTER) { sleep(); return; }
    if (now > nextFidget) {
      fidgets[Math.floor(Math.random() * fidgets.length)]();
      nextFidget = now + rnd(7000, 13000);
    }
  }
  var loop = setInterval(tick, 400);
})();
