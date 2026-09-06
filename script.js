'use strict';

const $ = (selector) => document.querySelector(selector);
const body = document.body;
const MOTION_SPEED = .5;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
let soundOn = false;
let awakened = false;
let audioContext, musicAnalyser, frequencyData;
const audioSources = new Map();
let audioRequest = 0;
let musicEnergy = 0;
const fluteAudio = $('#krishnaFlute');
const finaleAudio = $('#finaleSong');
let activeAudio = fluteAudio;
let soundRequested = false;
fluteAudio.volume = .55;
finaleAudio.volume = .55;
let diyaCount = 0;
let sparkleCount = 0;
let celebrationTimer;
let lastFrame = 0;
let raf = 0;
let particles = [];
let skyWidth = innerWidth, skyHeight = innerHeight;
const sky = $('#sky');
const ctx = sky.getContext('2d');
const constellation = $('#constellationCanvas');
const starsCtx = constellation.getContext('2d');
let cw = 0, ch = 0;
let constellationEnergy = 0;
const stars = Array.from({ length: 75 }, () => ({ x: Math.random(), y: Math.random(), r: .45 + Math.random() * 1.25, phase: Math.random() * Math.PI * 2 }));
const fireflies = Array.from({ length: innerWidth < 701 ? 30 : 58 }, () => ({ x: Math.random(), y: Math.random(), phase: Math.random() * 6.28, radius: .5 + Math.random() * 1.3 }));
const colors = ['#edd29c', '#eab3bd', '#8ccec1', '#f8e8ba'];

function setMessage(message) { $('#sceneMessage').textContent = message; }

// User-supplied recording. The analyser only reads playback, never a microphone.
function getMusicEnergy() {
  let level = 0;
  if (musicAnalyser && soundOn && !activeAudio.paused) {
    musicAnalyser.getByteFrequencyData(frequencyData);
    for (let i = 2; i < 70; i++) level += frequencyData[i];
    level /= 68 * 255;
  }
  musicEnergy += (level - musicEnergy) * .12;
  return musicEnergy;
}
function renderSound() {
  const track = activeAudio === finaleAudio ? 'grand finale song' : 'Krishna flute';
  body.classList.toggle('sound-on', soundOn);
  $('#soundToggle').setAttribute('aria-pressed', String(soundOn));
  $('#soundToggle').setAttribute('aria-label', `${soundOn ? 'Pause' : 'Play'} ${track}`);
  $('#soundLabel').textContent = soundOn ? 'Sound on' : 'Sound off';
  $('#journeySound').setAttribute('aria-pressed', String(soundOn));
  $('#journeySound').setAttribute('aria-label', `${soundOn ? 'Pause' : 'Play'} ${track}`);
  $('.journey-sound-label').textContent = activeAudio === finaleAudio ? 'Song' : 'Flute';
}
async function setSound(enabled) {
  const request = ++audioRequest;
  soundRequested = enabled;
  const target = activeAudio;
  if (!enabled) {
    soundOn = false;
    fluteAudio.pause();
    finaleAudio.pause();
    renderSound();
    return;
  }
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (Audio && !audioContext) {
      try {
        audioContext = new Audio();
        musicAnalyser = audioContext.createAnalyser();
        musicAnalyser.fftSize = 256;
        musicAnalyser.smoothingTimeConstant = .8;
        frequencyData = new Uint8Array(musicAnalyser.frequencyBinCount);
      } catch (_) { /* HTML audio still works when the analyser is unavailable. */ }
    }
    if (audioContext && !audioSources.has(target)) {
      const source = audioContext.createMediaElementSource(target);
      source.connect(audioContext.destination);
      if (musicAnalyser) source.connect(musicAnalyser);
      audioSources.set(target, source);
    }
    // Both operations begin during the click, preserving iPhone audio permission.
    await Promise.all([audioContext ? audioContext.resume() : Promise.resolve(), target.play()]);
    if (request !== audioRequest) {
      if (target !== activeAudio || !soundRequested) target.pause();
      return;
    }
    soundOn = !target.paused;
  } catch (_) {
    if (request !== audioRequest) return;
    soundOn = false;
    soundRequested = false;
    target.pause();
    setMessage('Tap Sound to start the music for this moment. The stars are ready either way.');
  }
  renderSound();
}
function setMusicScene(isFinale) {
  const next = isFinale ? finaleAudio : fluteAudio;
  if (next === activeAudio) return;
  const resume = soundRequested;
  const previous = activeAudio;
  ++audioRequest;
  activeAudio = next;
  previous.pause();
  if (isFinale) next.currentTime = 0;
  soundOn = false;
  renderSound();
  setSound(resume);
}
$('#soundToggle').addEventListener('click', () => setSound(!soundRequested));
$('#journeySound').addEventListener('click', () => setSound(!soundRequested));
for (const audio of [fluteAudio, finaleAudio]) {
  audio.addEventListener('pause', () => { if (audio === activeAudio && audio.paused) { soundOn = false; renderSound(); } });
  audio.addEventListener('error', () => { if (audio === activeAudio) { soundOn = false; soundRequested = false; renderSound(); setMessage('This recording could not load. You can still enjoy every surprise.'); } });
}

function resizeCanvas() {
  const scale = Math.min(devicePixelRatio || 1, 2);
  skyWidth = innerWidth; skyHeight = innerHeight;
  sky.width = Math.round(skyWidth * scale); sky.height = Math.round(skyHeight * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  if ($('#surpriseDialog').open) resizeConstellation();
  if (motionPaused) drawStill();
}
function resizeConstellation() {
  const rect = $('#constellationStage').getBoundingClientRect();
  const scale = Math.min(devicePixelRatio || 1, 2);
  cw = rect.width; ch = rect.height;
  constellation.width = Math.round(cw * scale); constellation.height = Math.round(ch * scale);
  starsCtx.setTransform(scale, 0, 0, scale, 0, 0);
  if (motionPaused) drawConstellation(0);
}
function burst(x = skyWidth * .6, y = skyHeight * .4, amount = 75, type = 'petal') {
  if (motionPaused) return;
  for (let i = 0; i < amount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3.6;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.8, life: 1, decay: .003 + Math.random() * .004, size: 2 + Math.random() * 5, rotation: angle, color: colors[i % colors.length], type });
  }
  particles = particles.slice(-300);
}
function drawFireflies(t) {
  fireflies.forEach(f => {
    const x = f.x * skyWidth + Math.sin(t * .0002 + f.phase) * 22;
    const y = f.y * skyHeight + Math.cos(t * .00015 + f.phase) * 15;
    const alpha = .15 + (Math.sin(t * .001 + f.phase) + 1) * .2;
    ctx.beginPath(); ctx.fillStyle = `rgba(226,207,153,${alpha})`;
    ctx.arc(x, y, f.radius, 0, Math.PI * 2); ctx.fill();
  });
}
function drawConstellation(t) {
  if (!cw || !ch) return;
  starsCtx.clearRect(0, 0, cw, ch);
  const energy = constellationEnergy + getMusicEnergy() * .6;
  stars.forEach((star, i) => {
    const x = star.x * cw, y = star.y * ch;
    starsCtx.beginPath();
    starsCtx.fillStyle = `rgba(231,205,155,${.25 + (Math.sin(t * .001 + star.phase) + 1) * .27})`;
    starsCtx.arc(x, y, star.r + energy * .7, 0, Math.PI * 2); starsCtx.fill();
    if (i % 4 === 0) {
      starsCtx.strokeStyle = `rgba(174,205,190,${.08 + energy * .11})`;
      starsCtx.lineWidth = .6; starsCtx.beginPath(); starsCtx.moveTo(x, y);
      const neighbour = stars[(i + 1) % stars.length];
      if (Math.abs(star.x - neighbour.x) < .35 && Math.abs(star.y - neighbour.y) < .3) { starsCtx.lineTo(neighbour.x * cw, neighbour.y * ch); starsCtx.stroke(); }
    }
  });
  // A living peacock-feather halo of fine elliptical filaments.
  const cx = cw / 2, cy = ch * .48;
  const r = Math.min(cw * .42, 340);
  for (let i = 0; i < 28; i++) {
    const a = i * Math.PI * 2 / 28 + t * .000018;
    starsCtx.save(); starsCtx.translate(cx, cy); starsCtx.rotate(a);
    starsCtx.strokeStyle = i % 3 ? `rgba(91,163,148,${.10 + energy * .07})` : `rgba(220,186,111,${.18 + energy * .1})`;
    starsCtx.lineWidth = .7; starsCtx.beginPath(); starsCtx.ellipse(r * .42, 0, r * .6, r * .16, 0, 0, Math.PI * 2); starsCtx.stroke(); starsCtx.restore();
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    starsCtx.beginPath(); starsCtx.fillStyle = `rgba(234,208,145,${.5 + energy * .3})`; starsCtx.arc(px, py, 1.2 + energy, 0, Math.PI * 2); starsCtx.fill();
  }
  constellationEnergy = Math.max(0, constellationEnergy - .008 * MOTION_SPEED);
  if (window.paintPortal) window.paintPortal(t);
}
function drawStill() { ctx.clearRect(0, 0, skyWidth, skyHeight); drawFireflies(0); if ($('#surpriseDialog').open) drawConstellation(0); }
function animate(t) {
  raf = 0;
  if (motionPaused || document.hidden) return;
  const dt = Math.min((t - lastFrame) / 16.67 || 1, 2) * MOTION_SPEED; lastFrame = t;
  ctx.clearRect(0, 0, skyWidth, skyHeight); drawFireflies(t * MOTION_SPEED);
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.type === 'lantern' ? -.006 : .018) * dt; p.life -= p.decay * dt; p.rotation += .016 * dt;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.type === 'lantern' ? 0 : p.rotation); ctx.globalAlpha = Math.min(p.life * 2, 1); ctx.fillStyle = p.color;
    if (p.type === 'lantern') { ctx.shadowColor = '#ffdd88'; ctx.shadowBlur = 20; ctx.fillRect(-p.size, -p.size * 1.3, p.size * 2, p.size * 2.6); }
    else { ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * .4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
  if ($('#surpriseDialog').open) drawConstellation(t * MOTION_SPEED);
  raf = requestAnimationFrame(animate);
}
function startFrames() { if (!raf && !motionPaused && !document.hidden) { lastFrame = performance.now(); raf = requestAnimationFrame(animate); } }
function renderMotion() {
  body.classList.toggle('motion-paused', motionPaused);
  $('#motionToggle').setAttribute('aria-pressed', String(motionPaused));
  $('#motionToggle').setAttribute('aria-label', motionPaused ? 'Resume animations' : 'Pause animations');
  $('#motionIcon').textContent = motionPaused ? '▷' : 'Ⅱ';
  $('#journeyMotion').textContent = motionPaused ? '▷' : 'Ⅱ';
  $('#journeyMotion').setAttribute('aria-label', motionPaused ? 'Resume animations' : 'Pause animations');
  if (motionPaused) { cancelAnimationFrame(raf); raf = 0; particles = []; drawStill(); } else startFrames();
}
$('#motionToggle').addEventListener('click', () => { motionPaused = !motionPaused; renderMotion(); });
$('#journeyMotion').addEventListener('click', () => { motionPaused = !motionPaused; renderMotion(); });
reducedMotion.addEventListener('change', e => { motionPaused = e.matches; renderMotion(); });
window.addEventListener('resize', resizeCanvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; if (soundRequested) setSound(false); }
  else startFrames();
});

function openDialog(dialog) {
  clearTimeout(celebrationTimer); $('#celebration').classList.remove('visible');
  dialog.showModal(); dialog.scrollTop = 0;
  if (dialog.id === 'surpriseDialog') { resizeConstellation(); constellationEnergy = 1; window.dispatchEvent(new Event('journey:open')); }
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { if (dialog.id === 'wishDialog') $('#wishText').value = ''; });
});
function awaken() {
  body.classList.add('awakened');
  if (!awakened) { awakened = true; setSound(true); }
  $('#magicLabel').textContent = 'Visit your constellation';
  $('#actionHint').textContent = 'Your smile was the inspiration all along.';
}
$('#magicButton').addEventListener('click', () => {
  awaken();
  openDialog($('#surpriseDialog'));
  setMessage('Of all the stars in this little sky, you are my favourite, Nandini.');
});
const sparkleMessages = ['For that smile. A thousand more stars. ✦', 'Thodi si aur khushi. Sirf tere liye. ♡', 'Even this sky isn’t big enough for all my good wishes for you.', 'Nandini, keep being your own kind of magic. ✦'];
$('#sparkleButton').addEventListener('click', () => {
  constellationEnergy = 3;
  $('#surpriseDialog').classList.remove('sparkling');
  void $('#surpriseDialog').offsetWidth;
  $('#surpriseDialog').classList.add('sparkling');
  $('#sparkleStatus').textContent = sparkleMessages[sparkleCount++ % sparkleMessages.length];
  window.dispatchEvent(new Event('journey:sparkle'));
  if (motionPaused) drawConstellation(0);
});
const diyaMessages = ['Three little diyas: one for your peace, one for your dreams, and one for that beautiful smile.', 'Three more lights for softer days, a lighter heart, and happiness that stays.', 'A little more hope, a little more love, and a little more magic. Sirf tere liye, Nandini.'];
$('#diyaButton').addEventListener('click', () => {
  body.classList.add('awakened');
  const batch = diyaCount / 3;
  for (let i = 0; i < 3; i++) {
    const diya = document.createElement('span'); diya.className = 'floating-diya';
    diya.style.left = `${10 + (diyaCount * 17) % 72}%`; diya.style.top = `${15 + (diyaCount * 23) % 62}%`; diya.style.animationDelay = `${-Math.random() * 5}s`;
    $('#riverLights').append(diya);
    diyaCount++;
  }
  while ($('#riverLights').children.length > 18) $('#riverLights').firstElementChild.remove();
  setMessage(diyaMessages[batch % diyaMessages.length]);
  const bounds = $('#heroArt').getBoundingClientRect();
  burst(Math.min(skyWidth - 30, bounds.left + bounds.width * .65), Math.max(50, Math.min(skyHeight - 50, bounds.bottom - 80)), 35);
  $('#diyaButton .ritual-copy strong').textContent = 'Click once more';
  $('#diyaButton .ritual-copy > span').textContent = `${diyaCount} wishes lit · add 3 more diyas`;
});
$('#wishButton').addEventListener('click', () => openDialog($('#wishDialog')));
$('#noteButton').addEventListener('click', () => openDialog($('#noteDialog')));
$('#wishForm').addEventListener('submit', event => {
  event.preventDefault();
  // Deliberately never read, store, log or transmit the private wish.
  $('#wishText').value = '';
  $('#wishDialog').close();
  body.classList.add('awakened');
  burst(skyWidth * .5, skyHeight * .8, 22, 'lantern');
  setMessage('Your wish is with the stars now. Dil se hope hai, woh poori ho. 🤍');
  $('#wishButton .ritual-copy strong').textContent = 'Whisper another wish';
});
$('#noteCelebrate').addEventListener('click', () => {
  $('#noteDialog').close();
  burst(skyWidth * .5, skyHeight * .4, 160);
  setMessage('Bas, yeh wali smile! Happy Janmashtami, meri pyaari Nandini. 🤍');
  if (!motionPaused) {
    $('#celebration').classList.add('visible');
    clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => $('#celebration').classList.remove('visible'), 4800);
  }
});

// Fine-pointer parallax only: touch scrolling never competes with the scene.
const finePointer = matchMedia('(pointer:fine)');
let lastTrail = 0;
document.addEventListener('pointermove', event => {
  if (motionPaused || !finePointer.matches || document.querySelector('dialog[open]')) return;
  if (performance.now() - lastTrail > 80) { lastTrail = performance.now(); burst(event.clientX, event.clientY, 1); }
  const x = (event.clientX / innerWidth - .5) * 6;
  const y = (event.clientY / innerHeight - .5) * 4;
  $('#heroArt img').style.transform = `translate(${x}px,${y}px)`;
  $('#livingArt').style.transform = `translate(${x}px,${y}px)`;
});
resizeCanvas(); renderMotion();
