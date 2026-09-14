(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const clamp = function (value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); };
  const random = function (minimum, maximum) { return minimum + Math.random() * (maximum - minimum); };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Each item is revealed once, including cards clipped by the horizontal track.
  let revealObserver = null;
  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-waiting');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -16px 0px' });
    revealItems.forEach(function (item) {
      item.classList.add('is-waiting');
      revealObserver.observe(item);
    });
  }
  function motionPreferenceChanged() {
    if (reducedMotion.matches) {
      revealItems.forEach(function (item) { item.classList.remove('is-waiting'); });
      if (revealObserver) revealObserver.disconnect();
    }
  }
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', motionPreferenceChanged);
  else if (reducedMotion.addListener) reducedMotion.addListener(motionPreferenceChanged);

  // Archive fragments are decorative drawings with equivalent semantic buttons.
  const hero = $('play');
  const fragmentCanvas = $('fragment-canvas');
  const fragmentContext = fragmentCanvas.getContext('2d');
  let heroWidth = 1;
  let heroHeight = 1;
  let fragmentScale = 1;
  let energy = 0;
  const pointer = { x: -10000, y: -10000, active: false };
  const fragments = [
    { key: 'research', label: 'Research', color: '#69e1d4', sides: 6, radius: 65 },
    { key: 'venture', label: 'Venture', color: '#ff896a', sides: 4, radius: 47 },
    { key: 'music', label: 'Music', color: '#dcff64', sides: 5, radius: 48 },
    { key: 'writing', label: 'Writing', color: '#b4a1ff', sides: 3, radius: 43 }
  ].map(function (fragment) {
    return Object.assign(fragment, { collected: false, x: 0, y: 0, vx: 0, vy: 0, angle: 0, spin: 0, homeX: 0, homeY: 0 });
  });
  let sparks = [];

  function sizeCanvas(canvas, context, width, height) {
    const density = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    if (context) context.setTransform(density, 0, 0, density, 0, 0);
  }

  function resizeFragments() {
    const box = hero.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const oldWidth = heroWidth;
    const oldHeight = heroHeight;
    heroWidth = box.width;
    heroHeight = box.height;
    fragmentScale = heroWidth < 600 ? 0.7 : (heroWidth < 900 ? 0.85 : 1);
    sizeCanvas(fragmentCanvas, fragmentContext, heroWidth, heroHeight);
    const anchors = heroWidth < 600
      ? [[0.21, 0.19], [0.68, 0.18], [0.79, 0.30], [0.28, 0.31]]
      : [[0.16, 0.25], [0.46, 0.21], [0.74, 0.27], [0.88, 0.37]];
    fragments.forEach(function (fragment, index) {
      const radius = fragment.radius * fragmentScale;
      fragment.homeX = anchors[index][0] * heroWidth;
      fragment.homeY = anchors[index][1] * heroHeight;
      if (fragment.collected) {
        fragment.x = clamp(fragment.x / oldWidth * heroWidth, radius + 8, heroWidth - radius - 8);
        fragment.y = clamp(fragment.y / oldHeight * heroHeight, radius + 8, heroHeight - radius - 8);
      } else {
        fragment.x = clamp(fragment.homeX + random(-16, 16), radius + 8, heroWidth - radius - 8);
        fragment.y = clamp(fragment.homeY + random(-16, 16), radius + 8, heroHeight - radius - 8);
        fragment.vx = random(-0.28, 0.28);
        fragment.vy = random(-0.24, 0.24);
        fragment.angle = random(-Math.PI, Math.PI);
        fragment.spin = random(-0.003, 0.003);
      }
    });
  }

  function collectFragment(key) {
    const fragment = fragments.find(function (item) { return item.key === key; });
    if (!fragment || fragment.collected) return;
    fragment.collected = true;
    fragment.vx = 0;
    fragment.vy = 0;
    energy += 1;
    $('energy-count').textContent = energy + '/4';
    const button = document.querySelector('[data-collect="' + key + '"]');
    if (button) button.setAttribute('aria-pressed', 'true');
    const project = document.querySelector('[data-project="' + key + '"]');
    if (project) project.classList.add('is-collected');
    for (let index = 0; index < 24; index += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(60, 240);
      sparks.push({ x: fragment.x, y: fragment.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 45, life: random(0.7, 1.2), age: 0, size: random(3, 7), color: fragment.color });
    }
  }
  document.querySelectorAll('[data-collect]').forEach(function (button) {
    button.addEventListener('click', function () { collectFragment(button.dataset.collect); });
  });
  hero.addEventListener('pointermove', function (event) {
    const box = hero.getBoundingClientRect();
    pointer.x = event.clientX - box.left;
    pointer.y = event.clientY - box.top;
    pointer.active = true;
    const near = fragments.some(function (fragment) {
      return !fragment.collected && Math.hypot(fragment.x - pointer.x, fragment.y - pointer.y) < fragment.radius * fragmentScale + 20;
    });
    fragmentCanvas.style.cursor = near ? 'pointer' : 'crosshair';
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { pointer.active = false; });
  hero.addEventListener('pointercancel', function () { pointer.active = false; });
  hero.addEventListener('pointerup', function (event) {
    if (event.pointerType === 'touch') pointer.active = false;
  }, { passive: true });
  fragmentCanvas.addEventListener('click', function (event) {
    const box = fragmentCanvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    for (let index = 0; index < fragments.length; index += 1) {
      const fragment = fragments[index];
      if (Math.hypot(x - fragment.x, y - fragment.y) <= fragment.radius * fragmentScale + 20) {
        collectFragment(fragment.key);
        break;
      }
    }
  });

  function updateFragments(delta) {
    const frameScale = delta * 60;
    fragments.forEach(function (fragment) {
      if (fragment.collected) return;
      fragment.vx += (fragment.homeX - fragment.x) * 0.00011 * frameScale;
      fragment.vy += (fragment.homeY - fragment.y) * 0.00011 * frameScale;
      if (pointer.active) {
        const dx = fragment.x - pointer.x;
        const dy = fragment.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        const influence = fragment.radius * fragmentScale + 110;
        if (distance < influence && distance > 0.01) {
          const force = (1 - distance / influence) * 0.19 * frameScale;
          fragment.vx += dx / distance * force;
          fragment.vy += dy / distance * force;
        }
      }
      fragment.vx *= Math.pow(0.991, frameScale);
      fragment.vy *= Math.pow(0.991, frameScale);
      fragment.x += fragment.vx * frameScale;
      fragment.y += fragment.vy * frameScale;
      fragment.angle += fragment.spin * frameScale;
      const radius = fragment.radius * fragmentScale + 8;
      if (fragment.x < radius || fragment.x > heroWidth - radius) {
        fragment.x = clamp(fragment.x, radius, heroWidth - radius);
        fragment.vx *= -0.8;
      }
      if (fragment.y < radius || fragment.y > heroHeight - radius) {
        fragment.y = clamp(fragment.y, radius, heroHeight - radius);
        fragment.vy *= -0.8;
      }
    });
    sparks.forEach(function (spark) {
      spark.age += delta;
      spark.vy += 340 * delta;
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
    });
    sparks = sparks.filter(function (spark) { return spark.age < spark.life; });
  }

  function drawFragments() {
    if (!fragmentContext) return;
    const context = fragmentContext;
    context.clearRect(0, 0, heroWidth, heroHeight);
    for (let first = 0; first < fragments.length; first += 1) {
      for (let second = first + 1; second < fragments.length; second += 1) {
        const a = fragments[first];
        const b = fragments[second];
        if (a.collected || b.collected) continue;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const reach = Math.max(230, heroWidth * 0.43);
        if (distance < reach) {
          context.strokeStyle = 'rgba(220,235,233,' + ((1 - distance / reach) * 0.32) + ')';
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }
    }
    fragments.forEach(function (fragment) {
      const radius = fragment.radius * fragmentScale;
      context.save();
      context.translate(fragment.x, fragment.y);
      context.rotate(fragment.angle);
      context.beginPath();
      for (let side = 0; side < fragment.sides; side += 1) {
        const angle = side / fragment.sides * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (side === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.shadowColor = fragment.color;
      context.shadowBlur = fragment.collected ? 22 : 15;
      context.fillStyle = fragment.collected ? fragment.color + '65' : fragment.color + '26';
      context.strokeStyle = fragment.color;
      context.lineWidth = fragment.collected ? 2.5 : 1.7;
      context.fill();
      context.stroke();
      context.restore();
      context.save();
      context.font = '600 ' + (heroWidth < 600 ? 11 : 13) + 'px "Space Grotesk", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = '#fff9ef';
      context.shadowColor = '#111319';
      context.shadowBlur = 6;
      context.fillText(fragment.label, fragment.x, fragment.y);
      context.restore();
    });
    sparks.forEach(function (spark) {
      context.globalAlpha = Math.max(0, 1 - spark.age / spark.life);
      context.fillStyle = spark.color;
      context.fillRect(spark.x, spark.y, spark.size, spark.size);
    });
    context.globalAlpha = 1;
  }

  // This leaderboard has its own local keys and never contacts a remote service.
  const nameKey = 'grace.effects.home.name.v1';
  const scoresKey = 'grace.effects.home.scores.v1';
  const nameInput = $('runner-name');
  let savedName = 'Grace';
  let localScores = [];
  function displayName(value) {
    return (typeof value === 'string' ? value.trim().slice(0, 14) : '') || 'Grace';
  }
  function leaderboardName(value) {
    return (typeof value === 'string' ? value.replace(/[^A-Za-z0-9_ .'-]/g, '').slice(0, 14).trim() : '') || 'Grace';
  }
  function normalizeScore(value) {
    if (typeof value !== 'number' && typeof value !== 'string') return 0;
    const text = String(value).trim();
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return 0;
    const number = Number(text);
    return Number.isFinite(number) ? clamp(Math.trunc(number), 0, 999999) : 0;
  }
  try {
    savedName = displayName(window.localStorage.getItem(nameKey));
    const stored = JSON.parse(window.localStorage.getItem(scoresKey) || '[]');
    if (Array.isArray(stored)) {
      localScores = stored.filter(function (row) { return row && typeof row === 'object'; }).map(function (row) {
        return { name: leaderboardName(row.name), score: normalizeScore(row.score) };
      }).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);
    }
  } catch (error) {
    // An unavailable or malformed store does not interrupt the in-memory game.
  }
  nameInput.value = savedName;
  function commitName() {
    savedName = displayName(nameInput.value);
    nameInput.value = savedName;
    try { window.localStorage.setItem(nameKey, savedName); } catch (error) { /* Memory remains usable. */ }
    return savedName;
  }
  function renderScores() {
    const list = $('score-list');
    list.textContent = '';
    const rows = localScores.length ? localScores : [{ name: 'Grace', score: 0 }];
    rows.forEach(function (row) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const score = document.createElement('span');
      name.textContent = row.name;
      score.textContent = String(row.score);
      item.appendChild(name);
      item.appendChild(score);
      if (!localScores.length) item.setAttribute('aria-label', 'No saved scores. Grace 0.');
      list.appendChild(item);
    });
  }
  function recordScore(score) {
    localScores.push({ name: leaderboardName(commitName()), score: normalizeScore(score) });
    localScores.sort(function (a, b) { return b.score - a.score; });
    localScores = localScores.slice(0, 8);
    try { window.localStorage.setItem(scoresKey, JSON.stringify(localScores)); } catch (error) { /* Keep the local in-memory list. */ }
    renderScores();
  }
  nameInput.addEventListener('blur', commitName);
  nameInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitName();
      nameInput.blur();
    }
  });
  renderScores();

  const recommendations = [
    { title: 'Research', description: 'Project management for responsible technology infrastructure at Brown.', url: 'https://www.cntr-aisle.org/' },
    { title: 'Future News 2036', description: 'A future media simulator where sliders drive world state, market signals, and social discourse.', url: 'https://www.gracezrx.com/future-news-2036/' },
    { title: 'Gatherwise', description: 'An agentic planner for ranked outings, real places, and booking handoff.', url: 'https://gatherwise.gracezrx.com/' },
    { title: 'Lyrebird Art', description: 'A nonprofit arts platform connecting concerts, fundraising, and community impact.', url: 'https://lyrebirdart.com/' },
    { title: 'MyMusicID', description: 'A social platform concept for music enthusiasts to share, discuss, and collaborate.', url: 'https://gracezhong.me/my-music-id/' },
    { title: 'Awarded Writing', description: 'Scholastic-recognized fiction and poetry as the narrative layer of the work.', url: 'https://www.gracezrx.com/writing.html' }
  ];
  let recommendationIndex = 0;
  const popup = $('project-popup');
  const popupLink = $('recommendation-link');
  const gameCanvas = $('runner-canvas');
  const gameContext = gameCanvas.getContext('2d');
  const gameStage = $('game-stage');
  const startButton = $('start-jump');
  const duckButton = $('duck');
  const toggleButton = $('game-toggle');
  let gameHidden = false;
  const duckSources = new Set();
  const game = {
    width: 760, height: 450, ground: 284, running: false, dead: false,
    elapsed: 0, score: 0, distance: 0, weather: 'sunny', weatherTimer: 12,
    spawnTimer: 0, umbrellaTimer: 0, shield: false, umbrella: null,
    obstacles: [], particles: [], player: { x: 80, lift: 0, velocity: 0 }
  };
  function isDucking() { return duckSources.size > 0; }
  function updateDuckAppearance() { duckButton.classList.toggle('is-held', isDucking()); }
  function clearDuck() { duckSources.clear(); updateDuckAppearance(); }

  function resizeGame() {
    const box = gameStage.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    game.width = box.width;
    game.height = box.height;
    game.ground = box.height - (window.innerWidth <= 600 ? 185 : 166);
    game.player.x = clamp(box.width * 0.12, 34, 88);
    game.player.lift = Math.max(0, game.player.lift);
    sizeCanvas(gameCanvas, gameContext, game.width, game.height);
  }
  function updateWeatherLabel() {
    const names = { sunny: 'Sunny', rain: 'Rain', snow: 'Snow' };
    $('weather-label').textContent = names[game.weather] + (game.weather === 'rain' && game.shield ? ' · Protected' : '');
    $('weather-label').style.background = game.weather === 'sunny' ? '#dcff64' : (game.weather === 'rain' ? '#b4a1ff' : '#e7f7fb');
  }
  function hideRecommendation() {
    if (popup.contains(document.activeElement)) startButton.focus({ preventScroll: true });
    popup.classList.remove('is-visible');
    popup.setAttribute('aria-hidden', 'true');
    popupLink.setAttribute('tabindex', '-1');
  }
  function showRecommendation() {
    const recommendation = recommendations[recommendationIndex];
    recommendationIndex = (recommendationIndex + 1) % recommendations.length;
    $('recommendation-title').textContent = recommendation.title;
    $('recommendation-description').textContent = recommendation.description;
    popupLink.href = recommendation.url;
    popupLink.removeAttribute('tabindex');
    popup.setAttribute('aria-hidden', 'false');
    popup.classList.add('is-visible');
    $('runner-announcement').textContent = 'Run score ' + game.score + '. Project pop-up: ' + recommendation.title + '. ' + recommendation.description;
  }
  function startRun() {
    game.running = true;
    game.dead = false;
    game.elapsed = 0;
    game.score = 0;
    game.distance = 0;
    game.weather = 'sunny';
    game.weatherTimer = random(10, 15);
    game.spawnTimer = 0.8;
    game.umbrellaTimer = 0;
    game.shield = false;
    game.umbrella = null;
    game.obstacles = [];
    game.particles = [];
    game.player.lift = 0;
    game.player.velocity = 0;
    $('run-score').textContent = '0';
    updateWeatherLabel();
    hideRecommendation();
    $('runner-announcement').textContent = 'Run started. Sunny.';
  }
  function startOrJump() {
    if (!game.running) {
      startRun();
      return;
    }
    if (game.player.lift <= 3 && game.player.velocity <= 0) game.player.velocity = 650;
  }
  function endRun() {
    if (!game.running) return;
    game.running = false;
    game.dead = true;
    recordScore(game.score);
    showRecommendation();
  }
  function baseSpeed() { return clamp(game.width * 0.38, 170, 320) + game.elapsed * 2.1; }
  function weatherMultiplier() { return game.weather === 'sunny' ? 1.08 : (game.weather === 'rain' ? 0.88 : 0.69); }
  function changeWeather() {
    const options = ['sunny', 'rain', 'snow'].filter(function (weather) { return weather !== game.weather; });
    game.weather = options[Math.floor(Math.random() * options.length)];
    game.weatherTimer = game.weather === 'rain' ? random(7, 9) : random(11, 16);
    game.umbrella = null;
    game.shield = false;
    game.umbrellaTimer = random(1.4, 2.4);
    updateWeatherLabel();
  }
  function createObstacle(x) {
    const type = Math.floor(random(0, 3));
    if (type === 0) return { x: x, type: 'low', width: random(26, 36), height: 27, elevation: 0 };
    if (type === 1) return { x: x, type: 'tall', width: random(24, 32), height: 49, elevation: 0 };
    return { x: x, type: 'flying', width: 38, height: 21, elevation: random(32, 62) };
  }
  function spawnObstacles(speed) {
    const firstX = game.width + 30;
    game.obstacles.push(createObstacle(firstX));
    const combo = Math.random() < 0.19;
    if (combo) game.obstacles.push(createObstacle(firstX + speed * random(0.57, 0.83)));
    const delay = game.weather === 'sunny' ? random(1.35, 2.05) : (game.weather === 'rain' ? random(1.75, 2.5) : random(2.2, 3.1));
    game.spawnTimer = delay + (combo ? 0.5 : 0);
  }
  function playerRectangle() {
    if (isDucking()) return { x: game.player.x + 3, y: game.ground - 22, width: 34, height: 20 };
    return { x: game.player.x + 7, y: game.ground - game.player.lift - 45, width: 23, height: 43 };
  }
  function obstacleRectangle(obstacle) {
    return { x: obstacle.x + 3, y: game.ground - obstacle.elevation - obstacle.height + 2, width: obstacle.width - 6, height: obstacle.height - 3 };
  }
  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }
  function updateWeatherParticles(delta) {
    if (game.weather !== 'sunny' && game.particles.length < 120) {
      const attempts = game.weather === 'rain' ? 2 : 1;
      for (let index = 0; index < attempts; index += 1) {
        if (Math.random() < (game.weather === 'rain' ? 0.68 : 0.52)) {
          game.particles.push({ type: game.weather, x: random(-25, game.width + 80), y: random(-25, -4), speed: game.weather === 'rain' ? random(290, 470) : random(35, 75), drift: random(-18, 14), size: random(2, 4), phase: random(0, Math.PI * 2) });
        }
      }
    }
    game.particles.forEach(function (particle) {
      particle.y += particle.speed * delta;
      particle.x += (particle.type === 'rain' ? -95 : particle.drift + Math.sin(game.elapsed * 1.7 + particle.phase) * 11) * delta;
    });
    game.particles = game.particles.filter(function (particle) { return particle.y < game.ground + 18 && particle.x > -100 && particle.x < game.width + 100; });
  }
  function updateGame(delta) {
    if (!game.running) return;
    game.elapsed += delta;
    const score = Math.floor(game.elapsed * 10);
    if (score !== game.score) {
      game.score = score;
      $('run-score').textContent = String(score);
    }
    game.weatherTimer -= delta;
    if (game.weatherTimer <= 0) changeWeather();
    const speed = baseSpeed();
    const obstacleSpeed = speed * weatherMultiplier();
    game.distance += obstacleSpeed * delta;
    if (game.player.lift > 0 || game.player.velocity > 0) {
      game.player.lift += game.player.velocity * delta;
      game.player.velocity -= 1720 * delta;
      if (game.player.lift <= 0) {
        game.player.lift = 0;
        game.player.velocity = 0;
      }
    }
    game.spawnTimer -= delta;
    if (game.spawnTimer <= 0) spawnObstacles(obstacleSpeed);
    game.obstacles.forEach(function (obstacle) { obstacle.x -= obstacleSpeed * delta; });
    game.obstacles = game.obstacles.filter(function (obstacle) { return obstacle.x + obstacle.width > -25; });
    updateWeatherParticles(delta);
    if (game.weather === 'rain' && !game.shield && !game.umbrella) {
      game.umbrellaTimer -= delta;
      if (game.umbrellaTimer <= 0) game.umbrella = { x: game.width + 32, elevation: random(96, 121), width: 29, height: 27 };
    }
    const player = playerRectangle();
    if (game.umbrella) {
      game.umbrella.x -= speed * delta;
      const umbrellaRectangle = { x: game.umbrella.x, y: game.ground - game.umbrella.elevation - game.umbrella.height, width: game.umbrella.width, height: game.umbrella.height };
      if (overlaps(player, umbrellaRectangle)) {
        game.shield = true;
        game.umbrella = null;
        updateWeatherLabel();
      } else if (game.umbrella.x + game.umbrella.width < 0) {
        game.umbrella = null;
        game.umbrellaTimer = random(1.1, 2);
      }
    }
    // A pickup is resolved first. Only the first real obstacle overlap is handled.
    for (let index = 0; index < game.obstacles.length; index += 1) {
      if (overlaps(player, obstacleRectangle(game.obstacles[index]))) {
        if (game.weather === 'rain' && game.shield) {
          game.shield = false;
          game.umbrella = null;
          game.umbrellaTimer = random(1.3, 2.2);
          game.obstacles.splice(index, 1);
          updateWeatherLabel();
        } else {
          endRun();
        }
        break;
      }
    }
  }

  function rectangle(context, color, x, y, width, height) {
    context.fillStyle = color;
    context.fillRect(Math.round(x), Math.round(y), width, height);
  }
  function drawUmbrella(context, x, y) {
    rectangle(context, '#111319', x + 12, y + 9, 3, 19);
    rectangle(context, '#111319', x + 8, y + 25, 6, 3);
    rectangle(context, '#111319', x + 1, y + 8, 28, 5);
    rectangle(context, '#dcff64', x + 3, y + 6, 24, 5);
    rectangle(context, '#dcff64', x + 7, y + 2, 16, 6);
    rectangle(context, '#69e1d4', x + 14, y + 2, 7, 9);
  }
  function drawPlayer(context) {
    const x = Math.round(game.player.x);
    if (isDucking()) {
      const y = game.ground - 25;
      rectangle(context, '#202339', x + 2, y + 18, 36, 7);
      rectangle(context, '#69e1d4', x + 1, y + 8, 26, 12);
      rectangle(context, '#f0bc91', x + 25, y + 4, 13, 13);
      rectangle(context, '#bd3d77', x + 21, y, 18, 7);
      rectangle(context, '#111319', x + 34, y + 9, 3, 3);
      if (game.weather === 'rain' && game.shield) drawUmbrella(context, x + 5, y - 31);
      return;
    }
    const bob = game.running && game.player.lift === 0 ? Math.sin(game.elapsed * 17) * 1.4 : 0;
    const y = Math.round(game.ground - game.player.lift - 48 + bob);
    rectangle(context, '#242237', x + 6, y + 4, 24, 19);
    rectangle(context, '#bd3d77', x + 5, y, 25, 10);
    rectangle(context, '#ef6cab', x + 9, y - 3, 15, 6);
    rectangle(context, '#f0bc91', x + 14, y + 10, 18, 14);
    rectangle(context, '#111319', x + 27, y + 13, 3, 4);
    rectangle(context, '#69e1d4', x + 7, y + 24, 23, 14);
    rectangle(context, '#f0bc91', x + 29, y + 28, 6, 7);
    rectangle(context, '#3e3a86', x + 9, y + 38, 8, 10);
    rectangle(context, '#3e3a86', x + 23, y + 38, 7, 10);
    rectangle(context, '#111319', x + 7, y + 46, 12, 3);
    rectangle(context, '#111319', x + 22, y + 46, 12, 3);
    if (game.weather === 'rain' && game.shield) drawUmbrella(context, x + 2, y - 32);
  }
  function drawObstacle(context, obstacle) {
    const x = Math.round(obstacle.x);
    const y = Math.round(game.ground - obstacle.elevation - obstacle.height);
    if (obstacle.type === 'flying') {
      rectangle(context, '#111319', x + 4, y + 3, 30, 15);
      rectangle(context, '#b4a1ff', x + 7, y + 5, 24, 11);
      rectangle(context, '#111319', x, y, 10, 5);
      rectangle(context, '#111319', x + 28, y, 10, 5);
      rectangle(context, '#dcff64', x + 12, y + 8, 5, 4);
      rectangle(context, '#dcff64', x + 22, y + 8, 5, 4);
    } else {
      rectangle(context, '#111319', x, y, obstacle.width, obstacle.height);
      rectangle(context, obstacle.type === 'low' ? '#ff896a' : '#b4a1ff', x + 3, y + 3, obstacle.width - 6, obstacle.height - 3);
      rectangle(context, '#111319', x + 7, y + 8, 4, Math.max(4, obstacle.height - 15));
      rectangle(context, '#fff9ef', x + obstacle.width - 8, y + 5, 3, 6);
    }
  }
  function drawGame() {
    if (!gameContext || gameHidden) return;
    const context = gameContext;
    const width = game.width;
    const height = game.height;
    const ground = game.ground;
    const sky = context.createLinearGradient(0, 0, 0, ground);
    sky.addColorStop(0, game.weather === 'sunny' ? '#dff0e8' : (game.weather === 'rain' ? '#b4bed1' : '#dfe8ed'));
    sky.addColorStop(1, game.weather === 'sunny' ? '#f9f2d9' : (game.weather === 'rain' ? '#e0dce6' : '#f6f7f4'));
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
    if (game.weather === 'sunny') {
      context.fillStyle = '#f4db87';
      context.beginPath();
      context.arc(width - 52, 55, 23, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#718f983d';
      context.lineWidth = 1;
      for (let index = 0; index < 9; index += 1) {
        const x = ((index * 117 - game.distance * 0.5) % (width + 160) + width + 160) % (width + 160) - 80;
        const y = 120 + index % 4 * 27;
        context.beginPath();context.moveTo(x, y);context.lineTo(x - 25, y + 9);context.stroke();
      }
    }
    const buildingStep = 85;
    const buildingOffset = game.distance * 0.19;
    const firstBuilding = Math.floor(buildingOffset / buildingStep);
    for (let index = -1; index < Math.ceil(width / buildingStep) + 2; index += 1) {
      const serial = index + firstBuilding;
      const x = index * buildingStep - buildingOffset % buildingStep;
      const buildingHeight = 46 + Math.abs(Math.sin(serial * 2.83 + 1)) * 76;
      rectangle(context, game.weather === 'rain' ? '#7e8d9a55' : '#8ba4a04b', x, ground - buildingHeight, 63, buildingHeight);
      for (let column = 0; column < 3; column += 1) {
        for (let row = 0; row < Math.floor((buildingHeight - 14) / 20); row += 1) {
          rectangle(context, '#f5efe18f', x + 10 + column * 16, ground - buildingHeight + 12 + row * 20, 6, 8);
        }
      }
    }
    rectangle(context, game.weather === 'snow' ? '#d9dedc' : '#dadcc3', 0, ground, width, height - ground);
    rectangle(context, '#303e3c', 0, ground, width, 3);
    rectangle(context, '#a9b69c', 0, ground + 3, width, 6);
    for (let index = 0; index < Math.ceil(width / 57) + 3; index += 1) {
      const x = index * 57 - (game.elapsed * 43) % 57;
      rectangle(context, '#8f9c894d', x, ground + 22 + index % 3 * 22, 20, 3);
      rectangle(context, '#fff9ef88', x + 29, ground + 13 + index % 4 * 20, 5, 5);
      rectangle(context, '#698d7147', x + 8, ground - 6, 10, 3);
    }
    game.obstacles.forEach(function (obstacle) { drawObstacle(context, obstacle); });
    if (game.umbrella) drawUmbrella(context, game.umbrella.x, ground - game.umbrella.elevation - game.umbrella.height);
    drawPlayer(context);
    game.particles.forEach(function (particle) {
      if (particle.type === 'rain') {
        context.strokeStyle = '#49688199';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(particle.x - 5, particle.y + 12);
        context.stroke();
      } else {
        rectangle(context, '#ffffffdd', particle.x, particle.y, particle.size, particle.size);
      }
    });
  }

  startButton.addEventListener('click', startOrJump);
  startButton.addEventListener('keydown', function (event) {
    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      startOrJump();
    }
  });
  gameCanvas.addEventListener('click', startOrJump);
  duckButton.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;
    event.preventDefault();
    duckButton.focus({ preventScroll: true });
    duckSources.add('pointer');
    updateDuckAppearance();
  });
  function releasePointerDuck() { duckSources.delete('pointer'); updateDuckAppearance(); }
  duckButton.addEventListener('pointerleave', releasePointerDuck);
  duckButton.addEventListener('pointercancel', releasePointerDuck);
  window.addEventListener('pointerup', releasePointerDuck);
  window.addEventListener('pointercancel', releasePointerDuck);
  duckButton.addEventListener('keydown', function (event) {
    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      duckSources.add('button');
      updateDuckAppearance();
    }
  });
  duckButton.addEventListener('keyup', function (event) {
    if (event.code === 'Space' || event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      duckSources.delete('button');
      updateDuckAppearance();
    }
  });
  duckButton.addEventListener('blur', function () { duckSources.delete('button'); updateDuckAppearance(); });
  duckButton.addEventListener('click', function (event) { event.preventDefault(); });
  function isEditing(target) {
    return target instanceof Element && (target.matches('input,textarea,select') || target.isContentEditable);
  }
  window.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.isComposing || isEditing(event.target)) return;
    if (event.code === 'Space' || event.key === 'ArrowUp') {
      // Space retains native activation on semantic buttons. Arrow Up is global.
      if (event.code === 'Space' && event.target instanceof Element && event.target.closest('button')) return;
      event.preventDefault();
      startOrJump();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      duckSources.add('arrow');
      updateDuckAppearance();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      // Preserve keyboard access to the horizontal work archive without page scrolling.
      event.preventDefault();
      if (event.target instanceof Element) {
        const track = event.target.closest('.work-track');
        if (track) track.scrollLeft += event.key === 'ArrowRight' ? 100 : -100;
      }
    }
  });
  window.addEventListener('keyup', function (event) {
    if (event.key === 'ArrowDown') {
      duckSources.delete('arrow');
      updateDuckAppearance();
    }
    if (event.code === 'Space' || event.key === 'Enter') {
      duckSources.delete('button');
      updateDuckAppearance();
    }
  });
  window.addEventListener('blur', function () { clearDuck(); pointer.active = false; });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearDuck(); pointer.active = false; }
  });
  toggleButton.addEventListener('click', function () {
    gameHidden = !gameHidden;
    $('game-display').hidden = gameHidden;
    startButton.hidden = gameHidden;
    duckButton.hidden = gameHidden;
    $('game-shell').classList.toggle('is-collapsed', gameHidden);
    toggleButton.textContent = gameHidden ? 'Show game again' : 'Hide game';
    toggleButton.setAttribute('aria-expanded', String(!gameHidden));
    releasePointerDuck();
    if (!gameHidden) {
      resizeGame();
      drawGame();
    }
  });

  resizeFragments();
  resizeGame();
  updateWeatherLabel();
  if ('ResizeObserver' in window) {
    const layoutObserver = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.target === hero) resizeFragments();
        if (entry.target === gameStage && !gameHidden) resizeGame();
      });
    });
    layoutObserver.observe(hero);
    layoutObserver.observe(gameStage);
  }
  window.addEventListener('resize', function () {
    resizeFragments();
    if (!gameHidden) resizeGame();
  }, { passive: true });

  let previousTime = performance.now();
  function frame(time) {
    const delta = clamp((time - previousTime) / 1000, 0, 0.05);
    previousTime = time;
    updateFragments(delta);
    updateGame(delta);
    drawFragments();
    drawGame();
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}());
