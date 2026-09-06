'use strict';

(() => {
  const dialog = document.querySelector('#surpriseDialog');
  const portal = document.querySelector('#featherPortal');
  const context = portal.getContext('2d');
  const stage = document.querySelector('#constellationStage');
  const cards = [...document.querySelectorAll('[data-memory]')];
  const dots = [...document.querySelectorAll('[data-photo]')];
  const textCanvas = document.createElement('canvas');
  const textContext = textCanvas.getContext('2d', { willReadFrequently: true });
  let active = 0, finale = false, pw = 0, ph = 0, pulse = 0;
  let points = [], sparks = [], nameTargets = [];
  let pointer = { x: -999, y: -999 };
  let frameTime = 0;
  let touchStart = null;
  let blessingIndex = 0;
  const wishes = [
    ['Kanha se bas itni si dua hai…', 'teri yeh smile hamesha aise hi rahe.'],
    ['Thoda sa sukoon, bahut saari khushiyaan…', 'aur iss smile ko kabhi nazar na lage.'],
    ['Teri life mein itni pyaari cheezein aayein…', 'ki tu khud bole: “yaar, life kitni sundar hai.”']
  ];
  const blessings = [
    'May the things you quietly wish for find you in the most beautiful ways.',
    'May you always have a safe place to be yourself. No pretending. No overthinking. Just you.',
    'Kanha kare, tere hisse ki khushiyaan thodi jaldi aayein… aur thodi zyada der ruk jaayein.',
    'May your ordinary days turn into the memories you smile about years from now.',
    'And may you never doubt this: your presence makes my world a little more beautiful. 🤍'
  ];
  function resize() {
    if (!dialog.open) return;
    const rect = portal.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pw = rect.width; ph = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    portal.width = Math.round(pw * dpr); portal.height = Math.round(ph * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildName();
    if (!points.length) {
      const count = innerWidth < 701 ? 450 : 740;
      points = Array.from({ length: count }, (_, i) => ({ x: pw * Math.random(), y: ph * Math.random(), i, phase: Math.random() * 6.28, size: .6 + Math.random(), vx: 0, vy: 0 }));
    }
    if (motionPaused) window.paintPortal(0);
  }
  function buildName() {
    textCanvas.width = Math.round(pw); textCanvas.height = Math.round(ph);
    textContext.clearRect(0, 0, pw, ph);
    const fontSize = Math.min(pw * .225, ph * .72);
    textContext.font = `italic ${fontSize}px Georgia`;
    textContext.textAlign = 'center'; textContext.textBaseline = 'middle'; textContext.fillStyle = '#fff';
    textContext.fillText('Nandini', pw / 2, ph * .43);
    const pixels = textContext.getImageData(0, 0, textCanvas.width, textCanvas.height).data;
    nameTargets = [];
    const step = innerWidth < 701 ? 3 : 4;
    for (let y = 0; y < ph; y += step) for (let x = 0; x < pw; x += step) {
      if (pixels[(y * textCanvas.width + x) * 4 + 3] > 100) nameTargets.push({ x, y });
    }
  }
  function featherTarget(i, count, time) {
    const branch = i % 5;
    const t = i / count;
    const cx = pw * .5, cy = ph * .47;
    const size = Math.min(pw * .32, ph * .48);
    let x, y;
    if (branch < 3) {
      const ring = .36 + (i % 13) / 13 * .6;
      const angle = t * Math.PI * 16;
      x = Math.cos(angle) * size * 1.45 * ring;
      y = Math.sin(angle) * size * .7 * ring;
      x += y * .38;
    } else {
      const along = (t * 29) % 1;
      const side = branch === 3 ? -1 : 1;
      x = (along - .5) * size * 3.1;
      y = side * Math.sin(along * Math.PI) * size * .85;
      y += x * .13;
    }
    const breathe = motionPaused ? 1 : 1 + Math.sin(time * .0007) * .025;
    return { x: cx + x * breathe, y: cy + y * breathe };
  }
  function explode(amount = 65) {
    pulse = 1;
    if (motionPaused) { window.paintPortal(0); return; }
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 1 + Math.random() * 2.5;
      sparks.push({ x: pw * .5, y: ph * .45, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, size: 1 + Math.random() * 2 });
    }
    sparks = sparks.slice(-160);
    points.forEach(point => { const a = Math.random() * 6.28; point.vx += Math.cos(a) * 7; point.vy += Math.sin(a) * 7; });
  }
  window.paintPortal = (time) => {
    if (!dialog.open || !pw || !ph) return;
    const dt = Math.min((time - frameTime) / 16.67 || 1, 2); frameTime = time;
    const energy = getMusicEnergy();
    context.clearRect(0, 0, pw, ph);
    context.save();
    context.globalCompositeOperation = 'lighter';
    // Fine concentric music rings: their length follows the supplied flute audio.
    const cx = pw * .5, cy = ph * .45;
    for (let i = 0; i < 64; i++) {
      const angle = i / 64 * Math.PI * 2;
      const radius = Math.min(ph * .42, pw * .27);
      const wave = frequencyData && soundOn ? frequencyData[i + 2] / 255 : 0;
      const length = 2 + wave * 19;
      context.strokeStyle = `rgba(125,200,184,${.12 + energy * .3})`;
      context.beginPath(); context.moveTo(cx + Math.cos(angle) * radius * 1.8, cy + Math.sin(angle) * radius);
      context.lineTo(cx + Math.cos(angle) * (radius * 1.8 + length), cy + Math.sin(angle) * (radius + length * .5)); context.stroke();
    }
    points.forEach((point, i) => {
      const target = finale && nameTargets.length ? nameTargets[Math.floor(i / points.length * nameTargets.length)] : featherTarget(i, points.length, time);
      if (motionPaused) { point.x = target.x; point.y = target.y; point.vx = 0; point.vy = 0; }
      else {
        const dx = point.x - pointer.x, dy = point.y - pointer.y, distance = Math.hypot(dx, dy);
        if (distance < 52 && distance > .1) { point.vx += dx / distance * (1 - distance / 52) * .6 * dt; point.vy += dy / distance * (1 - distance / 52) * .6 * dt; }
        point.vx += (target.x - point.x) * .009 * dt;
        point.vy += (target.y - point.y) * .009 * dt;
        point.vx *= Math.pow(.86, dt); point.vy *= Math.pow(.86, dt);
        point.x += point.vx * dt; point.y += point.vy * dt;
      }
      const glow = .5 + (Math.sin(time * .002 + point.phase) + 1) * .2;
      context.fillStyle = i % 4 ? `rgba(236,211,153,${glow})` : `rgba(98,207,186,${glow})`;
      context.beginPath(); context.arc(point.x, point.y, point.size * (1 + energy * .4 + pulse * .5), 0, Math.PI * 2); context.fill();
    });
    sparks = sparks.filter(s => s.life > 0);
    sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= .015 * dt; context.fillStyle = `rgba(245,216,158,${Math.max(0,s.life)})`; context.fillRect(s.x, s.y, s.size, s.size); });
    context.restore(); pulse = Math.max(0, pulse - .014 * dt);
  };
  function selectPhoto(index) {
    active = (index + cards.length) % cards.length;
    cards.forEach((card, i) => {
      let position = (i - active + 3) % 3;
      if (position === 2) position = -1;
      card.dataset.position = position;
      card.setAttribute('aria-hidden', String(position !== 0 && !finale));
    });
    dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === active)));
    const line = document.querySelector('#memoryWish');
    line.replaceChildren(document.createTextNode(wishes[active][0]), document.createElement('br'));
    const strong = document.createElement('strong'); strong.textContent = wishes[active][1]; line.append(strong);
    if (!motionPaused) explode(20);
  }
  function setFinale(value) {
    finale = value;
    dialog.classList.toggle('in-finale', value);
    document.querySelector('#finaleCopy').hidden = !value;
    dialog.setAttribute('aria-labelledby', value ? 'finaleTitle' : 'surpriseTitle');
    document.querySelector('#portalCaption').textContent = value ? 'a thousand stars, one very special name' : 'a peacock feather, woven from starlight';
    selectPhoto(active); resize(); resizeConstellation(); explode(110);
    stage.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector(value ? '#moreBlessings' : '#finaleButton').focus({ preventScroll: true });
  }
  document.querySelector('#previousMemory').addEventListener('click', () => selectPhoto(active - 1));
  document.querySelector('#nextMemory').addEventListener('click', () => selectPhoto(active + 1));
  dots.forEach(dot => dot.addEventListener('click', () => selectPhoto(Number(dot.dataset.photo))));
  dialog.addEventListener('keydown', event => {
    if (finale || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); selectPhoto(active + (event.key === 'ArrowRight' ? 1 : -1));
  });
  document.querySelector('#memoryOrbit').addEventListener('touchstart', event => { const t = event.changedTouches[0]; touchStart = { x: t.clientX, y: t.clientY }; }, { passive: true });
  document.querySelector('#memoryOrbit').addEventListener('touchend', event => {
    if (!touchStart || finale) return;
    const t = event.changedTouches[0], dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) selectPhoto(active + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  portal.addEventListener('pointermove', event => { const r = portal.getBoundingClientRect(); pointer = { x: event.clientX - r.left, y: event.clientY - r.top }; });
  portal.addEventListener('pointerleave', () => { pointer = { x: -999, y: -999 }; });
  portal.addEventListener('pointerdown', () => explode(35));
  document.querySelector('#finaleButton').addEventListener('click', () => setFinale(true));
  document.querySelector('#replayJourney').addEventListener('click', () => setFinale(false));
  document.querySelector('#moreBlessings').addEventListener('click', () => {
    document.querySelector('#finaleWish').textContent = blessings[blessingIndex++ % blessings.length];
    const content = document.querySelector('#finaleCopy');
    content.classList.remove('is-blooming'); void content.offsetWidth; content.classList.add('is-blooming');
    constellationEnergy = 2.5; explode(130);
  });
  window.addEventListener('journey:sparkle', () => explode(100));
  window.addEventListener('journey:open', () => {
    if (finale) setFinale(false);
    active = 0; selectPhoto(0); resize(); explode(70);
    stage.scrollTop = 0;
    dialog.querySelector('[data-close]').focus({ preventScroll: true });
  });
  new ResizeObserver(() => { if (dialog.open) { resize(); resizeConstellation(); } }).observe(stage);
  selectPhoto(0);
})();
