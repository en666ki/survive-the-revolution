/* Quiet, opt-in reader tools. No network, audio files or background playback. */
(() => {
  'use strict';
  if (typeof document === 'undefined' || !document.addEventListener) return;

  function initReader() {
    const host = document.getElementById('reader-tools');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = 'true';
    const get = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
    const save = (key, value) => { try { localStorage.setItem(key, value); } catch (_) { /* Session still works. */ } };
    const sizes = ['normal', 'large', 'small'];
    const labels = ['обычный', 'крупный', 'компактный'];
    let size = Math.max(0, sizes.indexOf(get('rr_reader_size')));
    let plain = get('rr_reader_plain') === 'true';
    let sound = false;
    let audio = null;
    let lastSound = -Infinity;
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Настройки чтения');
    host.innerHTML = '<button type="button" data-reader="size"></button>' +
      '<button type="button" data-reader="art" aria-pressed="false">Без иллюстраций</button>' +
      '<button type="button" data-reader="sound" aria-pressed="false">Звук: выкл.</button>' +
      '<span class="reader-status" role="status" aria-live="polite"></span>';
    const sizeButton = host.querySelector('[data-reader="size"]');
    const artButton = host.querySelector('[data-reader="art"]');
    const soundButton = host.querySelector('[data-reader="sound"]');
    const status = host.querySelector('.reader-status');

    function paint() {
      document.body.dataset.readerSize = sizes[size];
      document.body.classList.toggle('reader-plain', plain);
      sizeButton.textContent = 'Текст: ' + labels[size];
      sizeButton.setAttribute('aria-label', 'Размер текста: ' + labels[size] + '. Нажмите, чтобы изменить.');
      artButton.setAttribute('aria-pressed', String(plain));
      soundButton.setAttribute('aria-pressed', String(sound));
      soundButton.textContent = 'Звук: ' + (sound ? 'вкл.' : 'выкл.');
    }

    // A short filtered noise envelope resembles paper / a pencil / a desk stamp.
    // It stays quieter than speech and never repeats or plays an ambient loop.
    function tick(kind) {
      if (!sound || !audio || audio.state !== 'running') return;
      const now = audio.currentTime;
      if (now - lastSound < 0.055) return;
      lastSound = now;
      const duration = kind === 'paper' ? 0.13 : kind === 'pencil' ? 0.065 : 0.075;
      const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
      const values = buffer.getChannelData(0);
      for (let i = 0; i < values.length; i++) values[i] = Math.random() * 2 - 1;
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = kind === 'pencil' ? 1800 : kind === 'paper' ? 1000 : 350;
      filter.Q.value = 0.65;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(kind === 'paper' ? 0.045 : 0.065, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(gain).connect(audio.destination);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start(now);
      source.stop(now + duration);
    }

    host.addEventListener('click', async event => {
      const button = event.target.closest('button[data-reader]');
      if (!button || button.disabled) return;
      if (button.dataset.reader === 'size') {
        size = (size + 1) % sizes.length;
        save('rr_reader_size', sizes[size]);
      } else if (button.dataset.reader === 'art') {
        plain = !plain;
        save('rr_reader_plain', String(plain));
      } else {
        soundButton.disabled = true;
        try {
          if (sound) {
            sound = false;
            if (audio) await audio.suspend();
          } else {
            if (!audio) audio = new AudioEngine();
            await audio.resume();
            sound = audio.state === 'running';
            if (!sound) status.textContent = 'Браузер не разрешил включить звук.';
            else { status.textContent = ''; tick('paper'); }
          }
        } catch (_) {
          sound = false;
          status.textContent = 'Звук недоступен в этом браузере.';
        } finally {
          soundButton.disabled = !AudioEngine;
        }
      }
      paint();
    });
    document.addEventListener('click', event => {
      if (!event.target.closest) return;
      const target = event.target.closest('.choice button, .pencil-mark, summary, [data-reader-sound]');
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      tick(target.matches('.pencil-mark') ? 'pencil' : target.matches('summary') ? 'paper' : 'stamp');
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && sound) {
        sound = false;
        if (audio) audio.suspend().catch(() => {});
        paint();
      }
    });
    if (!AudioEngine) {
      soundButton.disabled = true;
      soundButton.title = 'Звук недоступен в этом браузере';
    }
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initReader, { once: true });
  else initReader();
})();
