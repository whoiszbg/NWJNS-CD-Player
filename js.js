/* ========================================
   NWJNS CD PLAYER
   Album filtering, case-preserving CD drag,
   audio controls, and spinning disc.
======================================== */
const audio = document.getElementById('audio');
const player = document.getElementById('player');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const currentArt = document.getElementById('currentArt');
const emptyArt = document.getElementById('emptyArt');
const playBtn = document.getElementById('playBtn');
const seek = document.getElementById('seek');
const currentTime = document.getElementById('currentTime');
const duration = document.getElementById('duration');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const volumeBtn = document.getElementById('volumeBtn');
const ejectBtn = document.getElementById('ejectBtn');
const albumToggle = document.getElementById('albumToggle');
const albumList = document.getElementById('albumList');
const chevron = document.getElementById('chevron');
const wave = document.getElementById('wave');
const shelf = document.getElementById('cdShelf');
const shelfPrevBtn = document.getElementById('shelfPrevBtn');
const shelfNextBtn = document.getElementById('shelfNextBtn');
const shelfHeading = document.getElementById('shelfHeading');
const shelfEmpty = document.getElementById('shelfEmpty');
const categoryButtons = [...document.querySelectorAll('.album-category')];
const cdItems = [...document.querySelectorAll('.cd-item')];

let activeIndex = -1;
let isSeeking = false;
let selectedCategory = 'all';
let shelfDrag = null;
let suppressClickUntil = 0;

/* ── DISC SPIN ENGINE ───────────────────────────────────────────── */
// Tracks angle continuously so pause never snaps the disc back to 0°
let discAngle = 0;           // degrees, accumulates forever
let discRafId = null;        // requestAnimationFrame handle
let discLastTime = null;     // last rAF timestamp (ms)
const DISC_DEG_PER_MS = 360 / 3000; // one full rotation every 3 s

function applyDiscTransform() {
  const dx = currentArt.style.getPropertyValue('--disc-x') || '0px';
  const dy = currentArt.style.getPropertyValue('--disc-y') || '0px';
  currentArt.style.transform =
    `translate(calc(-50% + ${dx}), calc(-50% + ${dy})) rotate(${discAngle}deg)`;
}

function spinTick(ts) {
  if (discLastTime !== null) {
    discAngle = (discAngle + (ts - discLastTime) * DISC_DEG_PER_MS) % 360;
  }
  discLastTime = ts;
  applyDiscTransform();
  discRafId = requestAnimationFrame(spinTick);
}

function startSpin() {
  if (discRafId) return;          // already running
  discLastTime = null;
  discRafId = requestAnimationFrame(spinTick);
  currentArt.classList.add('is-playing');
}

function stopSpin() {
  if (discRafId) {
    cancelAnimationFrame(discRafId);
    discRafId = null;
  }
  discLastTime = null;
  currentArt.classList.remove('is-playing');
  // keep transform so disc stays at the angle it stopped at
  applyDiscTransform();
}

function resetSpin() {
  stopSpin();
  discAngle = 0;
  // let CSS transform take over again (eject animation etc.)
  currentArt.style.transform = '';
}
/* ────────────────────────────────────────────────────────────────── */

const ICONS = {
  play: `<svg class="w-6 h-6 text-black ml-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" /></svg>`,
  pause: `<svg class="w-6 h-6 text-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12a.75.75 0 0 1 .75-.75Z" clip-rule="evenodd" /></svg>`,
  volumeHigh: `<svg class="w-5 h-5 text-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5A2.25 2.25 0 0 0 2.25 9.75v4.5a2.25 2.25 0 0 0 2.25 2.25h1.94l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" /><path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" /></svg>`,
  volumeMute: `<svg class="w-5 h-5 text-black" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5A2.25 2.25 0 0 0 2.25 9.75v4.5a2.25 2.25 0 0 0 2.25 2.25h1.94l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 0 0-1.06-1.06l-1.72 1.72-1.72-1.72Z" /></svg>`
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function updatePlayButton() {
  playBtn.innerHTML = audio.paused ? ICONS.play : ICONS.pause;
  playBtn.title = audio.paused ? 'Play' : 'Pause';
  playBtn.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');

  const isPlaying = !audio.paused && !!audio.src && currentArt.classList.contains('inserted');
  if (isPlaying) {
    startSpin();
  } else {
    stopSpin();
  }
  if (wave) {
    wave.classList.toggle('is-playing', isPlaying);
  }
}

function updateWaveProgress() {
  if (!wave) return;
  const bars = wave.querySelectorAll('i');
  if (!bars.length) return;
  const progress = (Number.isFinite(audio.duration) && audio.duration > 0)
    ? audio.currentTime / audio.duration
    : 0;
  const activeCount = Math.round(progress * bars.length);
  bars.forEach((bar, i) => {
    bar.classList.toggle('played', i < activeCount);
    bar.classList.toggle('unplayed', i >= activeCount);
  });
}

function updateVolumeButton() {
  volumeBtn.innerHTML = audio.muted ? ICONS.volumeMute : ICONS.volumeHigh;
  volumeBtn.title = audio.muted ? 'Unmute' : 'Mute';
  volumeBtn.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute');
}

function loadTrack(index, autoplay = true, fromShelf = false) {
  if (!cdItems.length) return;
  const newIndex = (index + cdItems.length) % cdItems.length;

  // If a CD is already inserted and it's a different one, auto-eject first
  if (currentArt.classList.contains('inserted') && activeIndex !== newIndex) {
    const prevIndex = activeIndex;

    // Stop spin + music immediately
    resetSpin();
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';

    // Clear JS-applied inline transform so CSS eject-out keyframe takes over cleanly
    currentArt.style.transform = '';

    // Play eject animation, then load the new track after it finishes
    currentArt.classList.add('ejecting');
    currentArt.addEventListener('animationend', () => {
      // Return the old disc to its shelf case
      const prevItem = cdItems[prevIndex];
      if (prevItem) {
        prevItem.querySelector('.shelf-disc')?.classList.remove('taken');
        prevItem.classList.remove('active-cd');
      }

      // Reset player visuals
      currentArt.classList.remove('inserted', 'is-playing', 'ejecting');
      currentArt.style.display = 'none';
      emptyArt.classList.remove('hidden');

      // Now load the new track
      _doLoadTrack(newIndex, autoplay, fromShelf);
    }, { once: true });

    activeIndex = -1;
    syncEjectBtn();
    return;
  }

  _doLoadTrack(newIndex, autoplay, fromShelf);
}

function _doLoadTrack(index, autoplay, fromShelf) {
  activeIndex = index;
  const item = cdItems[activeIndex];

  // Reset spin so each new CD starts from 0°
  resetSpin();

  trackTitle.textContent = item.dataset.title || `Track ${activeIndex + 1}`;
  trackArtist.textContent = item.dataset.artist || 'NWJNS';
  currentArt.src = item.dataset.art || item.querySelector('.shelf-disc')?.src || '';
  currentArt.classList.add('inserted');
  currentArt.classList.remove('is-playing');
  currentArt.style.display = 'block';
  currentArt.style.setProperty('--disc-x', '0px');
  currentArt.style.setProperty('--disc-y', '0px');
  emptyArt.classList.add('hidden');

  audio.pause();
  audio.src = item.dataset.audio || '';
  audio.load();

  cdItems.forEach((cd, i) => cd.classList.toggle('active-cd', i === activeIndex));
  if (fromShelf) item.querySelector('.shelf-disc')?.classList.add('taken');

  currentTime.textContent = '0:00';
  duration.textContent = '0:00';
  seek.value = 0;
  updateWaveProgress();

  if (autoplay && audio.src) audio.play().catch(updatePlayButton);
  updatePlayButton();
  if (typeof syncEjectBtn === 'function') syncEjectBtn();
}

function togglePlay() {
  if (activeIndex < 0 && cdItems.length) {
    const firstVisible = cdItems.findIndex(item => !item.hidden);
    loadTrack(firstVisible >= 0 ? firstVisible : 0, false, false);
  }
  if (!audio.src) return;
  if (audio.paused) audio.play().catch(updatePlayButton);
  else audio.pause();
}
playBtn.addEventListener('click', togglePlay);

function showCategory(category) {
  selectedCategory = category;
  const matches = cdItems.filter(item => category === 'all' || item.dataset.category === category);
  cdItems.forEach(item => { item.hidden = category !== 'all' && item.dataset.category !== category; });
  categoryButtons.forEach(button => button.classList.toggle('active', button.dataset.category === category));
  shelfHeading.textContent = category === 'all' ? 'ALL CDs' : `${category.replaceAll('-', ' ')} CDs`;
  shelfEmpty.hidden = matches.length > 0;
}
categoryButtons.forEach(button => {
  button.addEventListener('click', () => showCategory(button.dataset.category));
});

function pointInsidePlayer(x, y) {
  const rect = player.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function beginShelfDrag(event, item, index) {
  if (event.button !== undefined && event.button !== 0) return;
  if (item.querySelector('.shelf-disc')?.classList.contains('taken')) return;
  event.preventDefault();
  const disc = item.querySelector('.shelf-disc');
  const ghost = disc.cloneNode(true);
  ghost.classList.remove('taken');
  ghost.classList.add('drag-ghost');
  ghost.style.left = `${event.clientX}px`;
  ghost.style.top = `${event.clientY}px`;
  document.body.appendChild(ghost);
  shelfDrag = { item, index, ghost, startX: event.clientX, startY: event.clientY, moved: false };
}
cdItems.forEach((item, index) => {
  const disc = item.querySelector('.shelf-disc');
  disc?.addEventListener('pointerdown', event => beginShelfDrag(event, item, index));
  item.addEventListener('click', () => {
    if (Date.now() < suppressClickUntil) return;
    loadTrack(index, true, true);
    if (window.innerWidth < 768) {
      player.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

window.addEventListener('pointermove', event => {
  if (!shelfDrag) return;
  const distance = Math.hypot(event.clientX - shelfDrag.startX, event.clientY - shelfDrag.startY);
  if (distance > 7) shelfDrag.moved = true;
  shelfDrag.ghost.style.left = `${event.clientX}px`;
  shelfDrag.ghost.style.top = `${event.clientY}px`;
  player.classList.toggle('drag-over', pointInsidePlayer(event.clientX, event.clientY));
});
function endShelfDrag(event) {
  if (!shelfDrag) return;
  const drag = shelfDrag;
  const droppedInPlayer = drag.moved && pointInsidePlayer(event.clientX, event.clientY);
  drag.ghost.remove();
  if (droppedInPlayer) {
    loadTrack(drag.index, true, true);
    suppressClickUntil = Date.now() + 350;
  }
  shelfDrag = null;
  player.classList.remove('drag-over');
}
window.addEventListener('pointerup', endShelfDrag);
window.addEventListener('pointercancel', () => {
  if (shelfDrag) shelfDrag.ghost.remove();
  shelfDrag = null;
  player.classList.remove('drag-over');
});

prevBtn.addEventListener('click', () => {
  if (cdItems.length) loadTrack(activeIndex <= 0 ? cdItems.length - 1 : activeIndex - 1, true, false);
});
nextBtn.addEventListener('click', () => {
  if (cdItems.length) loadTrack(activeIndex < 0 ? 0 : activeIndex + 1, true, false);
});
shuffleBtn.addEventListener('click', () => {
  if (cdItems.length < 2) return;
  let next;
  do { next = Math.floor(Math.random() * cdItems.length); } while (next === activeIndex);
  loadTrack(next, true, false);
});
volumeBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateVolumeButton();
});
audio.addEventListener('volumechange', updateVolumeButton);

audio.addEventListener('play', updatePlayButton);
audio.addEventListener('pause', updatePlayButton);
audio.addEventListener('ended', () => {
  if (cdItems.length) loadTrack(activeIndex + 1, true, false);
});
audio.addEventListener('loadedmetadata', () => {
  duration.textContent = formatTime(audio.duration);
  seek.value = 0;
});
audio.addEventListener('timeupdate', () => {
  currentTime.textContent = formatTime(audio.currentTime);
  if (!isSeeking && Number.isFinite(audio.duration) && audio.duration > 0) {
    seek.value = (audio.currentTime / audio.duration) * 100;
  }
  updateWaveProgress();
});
seek.addEventListener('input', () => {
  isSeeking = true;
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    const preview = (Number(seek.value) / 100) * audio.duration;
    currentTime.textContent = formatTime(preview);
    const bars = wave?.querySelectorAll('i');
    if (bars?.length) {
      const activeCount = Math.round((Number(seek.value) / 100) * bars.length);
      bars.forEach((bar, i) => {
        bar.classList.toggle('played', i < activeCount);
        bar.classList.toggle('unplayed', i >= activeCount);
      });
    }
  }
});
seek.addEventListener('change', () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seek.value) / 100) * audio.duration;
  isSeeking = false;
  updateWaveProgress();
});

albumToggle.addEventListener('click', () => {
  const isOpen = albumToggle.getAttribute('aria-expanded') === 'true';
  albumToggle.setAttribute('aria-expanded', String(!isOpen));
  albumList.classList.toggle('closed', isOpen);
  chevron.style.transform = isOpen ? 'rotate(-90deg)' : 'rotate(0deg)';
});

// Start with the one supplied CD visible in the shelf, but leave the player empty.
showCategory('all');
currentArt.classList.remove('inserted', 'is-playing');
currentArt.style.display = 'none';
emptyArt.classList.remove('hidden');
trackTitle.textContent = 'Title';
trackArtist.textContent = '';
updatePlayButton();
updateVolumeButton();
updateWaveProgress();

/* ── EJECT ──────────────────────────────────────────────────────── */
function ejectCD() {
  // Nothing loaded → nothing to eject
  if (activeIndex < 0 || !currentArt.classList.contains('inserted')) return;

  // Stop spin + music immediately
  resetSpin();
  audio.pause();
  audio.currentTime = 0;
  audio.src = '';

  // Return the disc image to its shelf case
  const ejectedItem = cdItems[activeIndex];
  ejectedItem?.querySelector('.shelf-disc')?.classList.remove('taken');
  ejectedItem?.classList.remove('active-cd');

  // Clear JS-applied inline transform so CSS eject-out keyframe takes over cleanly
  currentArt.style.transform = '';

  // Play the eject animation, then reset the player UI
  currentArt.classList.add('ejecting');
  currentArt.addEventListener('animationend', () => {
    currentArt.classList.remove('inserted', 'is-playing', 'ejecting');
    currentArt.style.transform = '';   // clear JS-applied transform
    currentArt.style.display = 'none';
    emptyArt.classList.remove('hidden');
    trackTitle.textContent = 'Title';
    trackArtist.textContent = '';
    seek.value = 0;
    currentTime.textContent = '0:00';
    duration.textContent = '0:00';
    activeIndex = -1;
    updateWaveProgress();
    updatePlayButton();
  }, { once: true });
}

ejectBtn.addEventListener('click', ejectCD);

// Keep eject button disabled when no CD is in the player
function syncEjectBtn() {
  ejectBtn.disabled = activeIndex < 0 || !currentArt.classList.contains('inserted');
}
// Sync on audio events and after the initial setup
audio.addEventListener('play', syncEjectBtn);
audio.addEventListener('pause', syncEjectBtn);
// Initial state: disabled
syncEjectBtn();

/* ── CD SHELF HORIZONTAL CAROUSEL & KEYBOARD NAVIGATION ──────────── */
function updateShelfNavButtons() {
  if (!shelf || !shelfPrevBtn || !shelfNextBtn) return;
  const maxScrollLeft = shelf.scrollWidth - shelf.clientWidth;
  shelfPrevBtn.disabled = shelf.scrollLeft <= 4;
  shelfNextBtn.disabled = shelf.scrollLeft >= maxScrollLeft - 4;
}

function getScrollStep() {
  if (!shelf) return 200;
  const firstItem = shelf.querySelector('.cd-item:not([hidden])');
  return firstItem ? (firstItem.offsetWidth + 20) : 220;
}

shelfPrevBtn?.addEventListener('click', () => {
  shelf?.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
});

shelfNextBtn?.addEventListener('click', () => {
  shelf?.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
});

shelf?.addEventListener('scroll', updateShelfNavButtons, { passive: true });
window.addEventListener('resize', updateShelfNavButtons);

// Arrow key navigation for scrolling the CD shelf horizontally
window.addEventListener('keydown', event => {
  // Ignore if user is focusing an input, textarea or typing
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

  if (event.key === 'ArrowLeft') {
    shelf?.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
  } else if (event.key === 'ArrowRight') {
    shelf?.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
  }
});

// Update button states on category switch as well
const originalShowCategory = showCategory;
showCategory = function(category) {
  originalShowCategory(category);
  setTimeout(() => {
    shelf?.scrollTo({ left: 0, behavior: 'smooth' });
    updateShelfNavButtons();
  }, 50);
};

// Initial state for shelf arrows
setTimeout(updateShelfNavButtons, 100);

// Ensure background video plays seamlessly across all browsers
const bgVideo = document.querySelector('.video-background video');
if (bgVideo) {
  const startBg = () => { bgVideo.play().catch(() => {}); };
  startBg();
  window.addEventListener('click', startBg, { once: true });
  window.addEventListener('touchstart', startBg, { once: true });
}
