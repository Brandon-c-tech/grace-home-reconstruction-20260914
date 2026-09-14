(function () {
  'use strict';
  const { Archive, Runner, colors, cleanScores } = window.ReconstructionCore;
  const byId = id => document.getElementById(id);
  const archiveCanvas = byId('archive-canvas'), runnerCanvas = byId('runner-canvas');
  const archiveContext = archiveCanvas.getContext('2d'), runnerContext = runnerCanvas.getContext('2d');
  const stage = byId('runner-stage'), popup = byId('project-popup');
  const nameInput = byId('player-name'), duckButton = byId('duck-button'), toggleButton = byId('toggle-game');
  const NAME_KEY = 'grace-independent-r1-player-name', SCORE_KEY = 'grace-independent-r1-local-top8';
  function readStorage(key, fallback) { try { const value = localStorage.getItem(key); return value == null ? fallback : value; } catch (_) { return fallback; } }
  function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* The active visit still retains its state. */ } }
  nameInput.value = String(readStorage(NAME_KEY, 'Grace')).trim().slice(0, 14) || 'Grace';
  let scores;
  try { scores = cleanScores(JSON.parse(readStorage(SCORE_KEY, '[]'))); } catch (_) { scores = []; }
  function saveName() {
    nameInput.value = nameInput.value.trim().slice(0, 14) || 'Grace';
    writeStorage(NAME_KEY, nameInput.value); return nameInput.value;
  }
  nameInput.addEventListener('change', saveName);
  nameInput.addEventListener('blur', saveName);
  function renderScores() {
    const list = byId('leaderboard-list'); list.replaceChildren();
    if (!scores.length) {
      const empty = document.createElement('li'); empty.textContent = 'No runs yet'; list.appendChild(empty); return;
    }
    scores.forEach((row, index) => {
      const li = document.createElement('li'), name = document.createElement('span'), score = document.createElement('strong');
      name.textContent = `${index + 1}. ${row.name}`; score.textContent = String(row.score);
      li.append(name, score); list.appendChild(li);
    });
  }
  renderScores();
  let archive = new Archive(archiveCanvas.clientWidth, archiveCanvas.clientHeight);
  let runner = new Runner(runnerCanvas.clientWidth, runnerCanvas.clientHeight);
  let collapsed = false;
  function prepareCanvas(canvas, context, width, height, cap) {
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    canvas.width = Math.max(1, Math.round(width * ratio)); canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.imageSmoothingEnabled = false;
  }
  function resizeArchive() {
    const width = archiveCanvas.clientWidth, height = archiveCanvas.clientHeight;
    archive.resize(width, height); prepareCanvas(archiveCanvas, archiveContext, width, height, 2);
  }
  function resizeRunner() {
    if (collapsed) return;
    const width = runnerCanvas.clientWidth, height = runnerCanvas.clientHeight;
    if (!width || !height) return;
    runner.resize(width, height); prepareCanvas(runnerCanvas, runnerContext, width, height, 1.25);
  }
  resizeArchive(); resizeRunner();
  window.addEventListener('resize', () => { resizeArchive(); resizeRunner(); });
  function updateCollected() {
    byId('energy-count').textContent = archive.count + '/4';
    archive.fragments.forEach(f => {
      const control = document.querySelector(`[data-collect="${f.id}"]`);
      control.classList.toggle('collected', f.collected); control.setAttribute('aria-pressed', String(f.collected));
      byId('work-' + f.id).classList.toggle('collected', f.collected);
    });
  }
  document.querySelectorAll('[data-collect]').forEach(button => button.addEventListener('click', () => {
    if (archive.collect(button.dataset.collect)) updateCollected();
  }));
  function archivePoint(event) { const rect = archiveCanvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  archiveCanvas.addEventListener('pointermove', event => { Object.assign(archive.pointer, archivePoint(event), { active: true }); });
  archiveCanvas.addEventListener('pointerleave', () => { archive.pointer.active = false; });
  archiveCanvas.addEventListener('pointercancel', () => { archive.pointer.active = false; });
  archiveCanvas.addEventListener('pointerdown', event => { const p = archivePoint(event); if (archive.hit(p.x, p.y)) updateCollected(); });
  function drawArchive() {
    const ctx = archiveContext; ctx.clearRect(0, 0, archive.width, archive.height);
    for (let i = 0; i < archive.fragments.length; i++) {
      const a = archive.fragments[i]; if (a.collected) continue;
      for (let j = i + 1; j < archive.fragments.length; j++) {
        const b = archive.fragments[j]; if (b.collected) continue;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance >= 280) continue;
        ctx.strokeStyle = `rgba(255,247,220,${(1 - distance / 280) * .28})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    archive.step();
    archive.fragments.forEach(f => {
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.angle);
      ctx.beginPath();
      for (let i = 0; i < f.sides; i++) {
        const angle = i / f.sides * Math.PI * 2 - Math.PI / 2;
        const radius = f.radius * (i % 2 ? .72 : 1);
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.shadowBlur = 24; ctx.shadowColor = f.color; ctx.fillStyle = f.color; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,247,220,.82)'; ctx.stroke();
      ctx.fillStyle = colors.ink; ctx.font = `700 ${f.id === 'research' ? 9 : 11}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.label, 0, 0); ctx.restore();
    });
    archive.sparks.forEach(p => { ctx.globalAlpha = p.life / 34; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); });
    ctx.globalAlpha = 1;
  }
  function updateScore() { byId('run-score').textContent = String(runner.displayScore); byId('score-label').textContent = runner.label; }
  function startOrJump() {
    if (runner.action() === 'start') { popup.classList.remove('is-visible'); setDuck(false); }
    updateScore();
  }
  function setDuck(pressed) { runner.player.duck = pressed; duckButton.setAttribute('aria-pressed', String(pressed)); }
  byId('jump-button').addEventListener('click', startOrJump);
  runnerCanvas.addEventListener('pointerdown', startOrJump);
  duckButton.addEventListener('pointerdown', event => { event.preventDefault(); setDuck(true); try { duckButton.setPointerCapture(event.pointerId); } catch (_) {} });
  for (const eventName of ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture']) duckButton.addEventListener(eventName, () => setDuck(false));
  duckButton.addEventListener('keydown', event => { if (event.code === 'Enter') { event.preventDefault(); setDuck(true); } });
  duckButton.addEventListener('keyup', event => { if (event.code === 'Enter') { event.preventDefault(); setDuck(false); } });
  function editingTarget(target) { return target === nameInput || target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName); }
  window.addEventListener('keydown', event => {
    if (editingTarget(event.target)) return;
    if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); startOrJump(); }
    if (event.code === 'ArrowDown') { event.preventDefault(); setDuck(true); }
  });
  window.addEventListener('keyup', event => { if (event.code === 'ArrowDown') { if (!editingTarget(event.target)) event.preventDefault(); setDuck(false); } });
  window.addEventListener('blur', () => { setDuck(false); archive.pointer.active = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) setDuck(false); });
  toggleButton.addEventListener('click', () => {
    collapsed = !collapsed; stage.classList.toggle('is-collapsed', collapsed);
    toggleButton.textContent = collapsed ? 'Show game' : 'Hide game'; toggleButton.setAttribute('aria-expanded', String(!collapsed));
    if (!collapsed) resizeRunner();
  });
  function onDeath(event) {
    const name = saveName(); scores = cleanScores([...scores, { name, score: event.score }]);
    writeStorage(SCORE_KEY, JSON.stringify(scores)); renderScores();
    byId('popup-title').textContent = event.project.title;
    byId('popup-description').textContent = event.project.description;
    byId('popup-link').href = event.project.url; popup.classList.add('is-visible');
  }
  function rect(ctx, color, x, y, width, height) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), width, height); }
  function drawUmbrella(ctx, x, y) {
    ctx.fillStyle = colors.lime; ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.quadraticCurveTo(x + 17, y - 11, x + 34, y + 15);
    ctx.lineTo(x + 25, y + 12); ctx.lineTo(x + 17, y + 16); ctx.lineTo(x + 9, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 17, y + 14); ctx.lineTo(x + 17, y + 29); ctx.quadraticCurveTo(x + 17, y + 35, x + 24, y + 30); ctx.stroke();
  }
  function drawPlayer(ctx) {
    const p = runner.player, x = p.x, y = p.duck ? runner.ground - 34 : p.y;
    if (p.duck) {
      rect(ctx, colors.ink, x + 7, y, 27, 8); rect(ctx, colors.ink, x + 2, y + 6, 36, 16);
      rect(ctx, colors.cream, x + 21, y + 7, 21, 14); rect(ctx, colors.ink, x + 35, y + 10, 4, 4);
      rect(ctx, colors.pink, x + 8, y + 20, 28, 10); rect(ctx, colors.lime, x + 28, y + 19, 10, 4);
      rect(ctx, colors.cyan, x + 26, y + 26, 22, 6); rect(ctx, colors.ink, x + 5, y + 30, 19, 4); rect(ctx, colors.ink, x + 35, y + 30, 15, 4);
    } else {
      const bob = Math.sin(runner.score * .18) * 2;
      rect(ctx, colors.ink, x + 12, y + bob, 28, 8); rect(ctx, colors.ink, x + 7, y + 7 + bob, 36, 24);
      rect(ctx, colors.ink, x + 1, y + 14 + bob, 10, 30); rect(ctx, colors.cream, x + 17, y + 9 + bob, 22, 19);
      rect(ctx, colors.ink, x + 32, y + 15 + bob, 4, 4); rect(ctx, colors.lime, x + 19, y + 27 + bob, 16, 6);
      rect(ctx, colors.pink, x + 10, y + 31 + bob, 31, 16); rect(ctx, colors.pink, x + 4, y + 32 + bob, 8, 12);
      rect(ctx, colors.cream, x + 3, y + 42 + bob, 9, 7); rect(ctx, colors.cream, x + 41, y + 36 + bob, 8, 10);
      rect(ctx, colors.cyan, x + 12, y + 46, 11, 9); rect(ctx, colors.cyan, x + 30, y + 46, 11, 9);
      rect(ctx, colors.ink, x + 9, y + 54, 17, 4); rect(ctx, colors.ink, x + 29, y + 54, 18, 4);
    }
    if (runner.equipped) drawUmbrella(ctx, x + 6, p.y - 37);
  }
  function drawRunner() {
    const ctx = runnerContext, width = runner.width, height = runner.height, ground = runner.ground;
    const weather = runner.weather, score = runner.score, multiplier = runner.weatherMultiplier;
    ctx.clearRect(0, 0, width, height);
    rect(ctx, weather === 'sunny' ? '#fff2ad' : weather === 'rain' ? '#c8edf0' : '#dce5ed', 0, 0, width, height);
    ctx.fillStyle = 'rgba(18,18,23,.11)';
    const cityOffset = score * .22 * multiplier % 86;
    for (let i = -1; i < Math.ceil(width / 86) + 2; i++) {
      const h = 18 + ((i + 4) % 4) * 10, x = i * 86 - cityOffset;
      ctx.fillRect(x, ground - 90 - h, 38, h); ctx.fillRect(x + 12, ground - 96 - h, 14, 6);
    }
    if (weather === 'sunny') {
      ctx.strokeStyle = 'rgba(24,240,255,.24)'; ctx.lineWidth = 2;
      for (let i = -1; i < Math.ceil(width / 120) + 2; i++) {
        const x = i * 120 - score * 2.8 % 120, y = 126 + (i % 3) * 28;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 70, y - 18); ctx.stroke();
      }
    }
    rect(ctx, colors.ink, 0, ground, width, 4);
    const stripOffset = score * .9 * multiplier % 22;
    for (let i = -1; i < Math.ceil(width / 22) + 2; i++) rect(ctx, i % 2 ? colors.cyan : colors.pink, i * 22 - stripOffset, ground + 15, 12, 5);
    const blockOffset = score * 1.45 * multiplier % 72;
    for (let i = -1; i < Math.ceil(width / 72) + 2; i++) {
      ctx.globalAlpha = .45; rect(ctx, i % 2 ? colors.lime : colors.purple, i * 72 - blockOffset, ground - 22, 22, 22);
    }
    ctx.globalAlpha = 1;
    runner.obstacles.forEach(o => {
      if (o.type === 'fly') {
        ctx.fillStyle = colors.cyan; ctx.strokeStyle = colors.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(o.x, o.y + 8); ctx.lineTo(o.x + 12, o.y + 14); ctx.lineTo(o.x + 18, o.y);
        ctx.lineTo(o.x + 28, o.y + 9); ctx.lineTo(o.x + 38, o.y); ctx.lineTo(o.x + 44, o.y + 14);
        ctx.lineTo(o.x + 54, o.y + 8); ctx.lineTo(o.x + 42, o.y + 24); ctx.lineTo(o.x + 12, o.y + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
        rect(ctx, colors.ink, o.x + 29, o.y + 12, 4, 4);
      } else {
        rect(ctx, o.color, o.x, o.y, o.w, o.h); ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.strokeRect(Math.round(o.x), Math.round(o.y), o.w, o.h);
        rect(ctx, 'rgba(255,247,220,.55)', o.x + 6, o.y + 7, 6, 6);
      }
    });
    if (runner.umbrella) drawUmbrella(ctx, runner.umbrella.x, runner.umbrella.y);
    drawPlayer(ctx);
    runner.particles.forEach(p => {
      if (weather === 'snow') { ctx.globalAlpha = .78; rect(ctx, '#ffffff', p.x, p.y, p.size, p.size); }
      else { ctx.globalAlpha = .4; ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 5, p.y + p.size); ctx.stroke(); }
    });
    ctx.globalAlpha = 1;
  }
  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.intersectionRatio >= .14) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .14 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
    document.querySelectorAll('.work-card a').forEach(link => link.addEventListener('focus', () => link.closest('.work-card').classList.add('is-visible')));
  }
  let previous;
  function frame(time) {
    const milliseconds = previous === undefined ? 1000 / 60 : Math.min(50, Math.max(0, time - previous)); previous = time;
    if (archiveContext) drawArchive();
    const event = runner.step(milliseconds); if (event && event.type === 'death') onDeath(event);
    updateScore(); if (runnerContext) drawRunner(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
