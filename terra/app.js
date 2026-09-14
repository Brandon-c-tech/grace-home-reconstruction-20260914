(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const random = (low, high) => low + Math.random() * (high - low);

  const fragmentCanvas = $('#fragmentCanvas');
  const fragmentContext = fragmentCanvas.getContext('2d');
  const fragmentColors = {
    Research: '#d7ff39',
    Venture: '#ff3d7f',
    Music: '#18f0ff',
    Writing: '#ff8a00'
  };
  const fragmentDefinitions = [
    ['Research', 0.18, 0.24, 78, 3, 0.015],
    ['Venture', 0.34, 0.48, 38, 4, 0.016],
    ['Music', 0.50, 0.24, 42, 5, 0.017],
    ['Writing', 0.66, 0.48, 46, 6, 0.018]
  ];
  let fragments = [];
  let sparks = [];
  let archiveEnergy = 0;
  let fragmentPointer = { active: false, x: 0, y: 0 };

  function createFragment(definition) {
    return {
      name: definition[0],
      x: fragmentCanvas.clientWidth * definition[1],
      y: fragmentCanvas.clientHeight * definition[2],
      radius: definition[3],
      sides: definition[4],
      spin: definition[5],
      velocityX: random(-0.85, 0.85),
      velocityY: random(-0.85, 0.85),
      angle: random(0, Math.PI),
      collected: false
    };
  }

  function sizeFragmentCanvas() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const bounds = fragmentCanvas.getBoundingClientRect();
    fragmentCanvas.width = Math.max(1, Math.floor(bounds.width * ratio));
    fragmentCanvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    fragmentContext.setTransform(ratio, 0, 0, ratio, 0, 0);

    fragments.forEach((fragment, index) => {
      if (!fragment.collected) {
        const replacement = createFragment(fragmentDefinitions[index]);
        Object.assign(fragment, replacement);
      }
    });
  }

  function drawPolygon(fragment) {
    fragmentContext.beginPath();
    for (let index = 0; index < fragment.sides; index += 1) {
      const radius = fragment.radius * (index % 2 ? 0.72 : 1);
      const angle = fragment.angle + index * Math.PI * 2 / fragment.sides;
      const x = fragment.x + Math.cos(angle) * radius;
      const y = fragment.y + Math.sin(angle) * radius;
      if (index === 0) fragmentContext.moveTo(x, y);
      else fragmentContext.lineTo(x, y);
    }
    fragmentContext.closePath();
  }

  function addCollectionSparks(x, y, color) {
    for (let index = 0; index < 28; index += 1) {
      const angle = index * Math.PI * 2 / 28;
      const magnitude = random(2, 6);
      sparks.push({
        x,
        y,
        velocityX: Math.cos(angle) * magnitude,
        velocityY: Math.sin(angle) * magnitude,
        color,
        life: 34
      });
    }
  }

  function collectFragment(name, hitX, hitY) {
    const fragment = fragments.find((item) => item.name === name);
    if (!fragment || fragment.collected) return;

    fragment.collected = true;
    archiveEnergy += 1;
    $('#energyCount').textContent = `${archiveEnergy}/4`;
    $('#collectionStatus').textContent = `Archive energy ${archiveEnergy} of 4. ${name} collected.`;
    const button = document.querySelector(`[data-collect="${name}"]`);
    if (button) button.classList.add('collected');
    const card = document.querySelector(`.work-card[data-key="${name}"]`);
    if (card) card.classList.add('focused');
    addCollectionSparks(hitX === undefined ? fragment.x : hitX, hitY === undefined ? fragment.y : hitY, fragmentColors[name]);
  }

  function drawFragmentField() {
    const width = fragmentCanvas.clientWidth;
    const height = fragmentCanvas.clientHeight;
    fragmentContext.clearRect(0, 0, width, height);

    for (let first = 0; first < fragments.length; first += 1) {
      for (let second = first + 1; second < fragments.length; second += 1) {
        const a = fragments[first];
        const b = fragments[second];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (!a.collected && !b.collected && distance < 280) {
          fragmentContext.strokeStyle = `rgba(255,247,220,${0.28 * (1 - distance / 280)})`;
          fragmentContext.lineWidth = 1;
          fragmentContext.beginPath();
          fragmentContext.moveTo(a.x, a.y);
          fragmentContext.lineTo(b.x, b.y);
          fragmentContext.stroke();
        }
      }
    }

    fragments.forEach((fragment) => {
      if (!fragment.collected) {
        if (fragmentPointer.active) {
          const dx = fragment.x - fragmentPointer.x;
          const dy = fragment.y - fragmentPointer.y;
          const distance = Math.max(1, Math.hypot(dx, dy));
          if (distance < 180) {
            const force = 0.45 * (1 - distance / 180);
            fragment.velocityX += dx / distance * force;
            fragment.velocityY += dy / distance * force;
          }
        }

        fragment.x += fragment.velocityX;
        fragment.y += fragment.velocityY;
        fragment.angle += fragment.spin;
        fragment.velocityX *= 0.99;
        fragment.velocityY *= 0.99;

        if (fragment.x < fragment.radius || fragment.x > width - fragment.radius) {
          fragment.velocityX *= -1;
          fragment.x = clamp(fragment.x, fragment.radius, width - fragment.radius);
        }
        if (fragment.y < fragment.radius || fragment.y > height - fragment.radius) {
          fragment.velocityY *= -1;
          fragment.y = clamp(fragment.y, fragment.radius, height - fragment.radius);
        }
      }

      fragmentContext.save();
      fragmentContext.shadowColor = fragmentColors[fragment.name];
      fragmentContext.shadowBlur = 24;
      fragmentContext.fillStyle = fragmentColors[fragment.name];
      drawPolygon(fragment);
      fragmentContext.fill();
      fragmentContext.shadowBlur = 0;
      fragmentContext.strokeStyle = 'rgba(255,247,220,.82)';
      fragmentContext.lineWidth = 2;
      drawPolygon(fragment);
      fragmentContext.stroke();
      fragmentContext.fillStyle = '#121217';
      fragmentContext.font = `700 ${fragment.name === 'Research' ? 9 : 11}px Space`;
      fragmentContext.textAlign = 'center';
      fragmentContext.textBaseline = 'middle';
      fragmentContext.fillText(fragment.name.toUpperCase(), fragment.x, fragment.y);
      fragmentContext.restore();
    });

    sparks = sparks.filter((spark) => {
      spark.life -= 1;
      return spark.life > 0;
    });
    sparks.forEach((spark) => {
      spark.x += spark.velocityX;
      spark.y += spark.velocityY;
      spark.velocityY += 0.04;
      fragmentContext.globalAlpha = spark.life / 34;
      fragmentContext.fillStyle = spark.color;
      fragmentContext.fillRect(spark.x, spark.y, 4, 4);
      fragmentContext.globalAlpha = 1;
    });

    window.requestAnimationFrame(drawFragmentField);
  }

  fragments = fragmentDefinitions.map(createFragment);
  sizeFragmentCanvas();
  drawFragmentField();

  fragmentCanvas.addEventListener('pointermove', (event) => {
    const bounds = fragmentCanvas.getBoundingClientRect();
    fragmentPointer = { active: true, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  });
  fragmentCanvas.addEventListener('pointerleave', () => { fragmentPointer.active = false; });
  fragmentCanvas.addEventListener('pointerdown', (event) => {
    const bounds = fragmentCanvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const fragment = fragments.find((item) => !item.collected && Math.hypot(x - item.x, y - item.y) < item.radius + 18);
    if (fragment) collectFragment(fragment.name, x, y);
  });
  $$('[data-collect]').forEach((button) => {
    button.addEventListener('click', () => collectFragment(button.dataset.collect));
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });
  $$('.reveal').forEach((element) => observer.observe(element));

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* Local storage is optional for offline use. */
    }
  }

  const playerName = $('#playerName');
  const leaderTitle = $('#leaderTitle');
  const leaderList = $('#leaderList');

  function saveName() {
    const value = playerName.value.trim() || 'Grace';
    playerName.value = value;
    writeStorage('grace-runner-name', value);
    return value;
  }

  function cleanLeaderboardName(value) {
    const cleaned = String(value || '').replace(/[^A-Za-z0-9_ .'-]/g, '').trim().slice(0, 14);
    return cleaned || 'Grace';
  }

  function getScores() {
    const saved = readStorage('grace-runner-scores', []);
    if (!Array.isArray(saved)) return [];
    return saved.map((entry) => ({
      name: cleanLeaderboardName(entry.name),
      score: clamp(parseInt(entry.score, 10) || 0, 0, 999999)
    })).sort((a, b) => b.score - a.score).slice(0, 8);
  }

  function renderScores() {
    leaderTitle.textContent = 'Local leaderboard';
    let rows = getScores();
    if (!rows.length) rows = [{ name: 'Grace', score: 0 }];
    leaderList.innerHTML = rows.map((row) => `<li>${row.name} ${row.score}</li>`).join('');
  }

  function recordScore(score) {
    saveName();
    const rows = getScores();
    rows.push({ name: cleanLeaderboardName(playerName.value), score: Math.floor(score) });
    rows.sort((a, b) => b.score - a.score);
    writeStorage('grace-runner-scores', rows.slice(0, 8));
    renderScores();
  }

  playerName.value = readStorage('grace-runner-name', 'Grace') || 'Grace';
  playerName.addEventListener('change', saveName);
  playerName.addEventListener('blur', saveName);
  renderScores();

  const gameCanvas = $('#gameCanvas');
  const gameContext = gameCanvas.getContext('2d');
  const gameShell = $('#gameShell');
  const startButton = $('#startGame');
  const duckButton = $('#duckGame');
  const hideButton = $('#hideGame');
  const projectPopup = $('#projectPopup');
  const weatherLabel = $('#weatherLabel');
  const scoreValue = $('#scoreValue');
  let gameWidth = 0;
  let gameHeight = 0;
  let ground = 0;
  let gameState;
  let lastFrame = 0;
  let projectIndex = 0;

  const deathProjects = [
    ['CNTR AISLE', 'Responsible technology platform work at Brown.', 'https://www.cntr-aisle.org/'],
    ['Future News 2036', 'A future media simulator where sliders drive world state, market signals, and social discourse.', 'https://www.gracezrx.com/future-news-2036/'],
    ['Gatherwise', 'An agentic planner for ranked outings, real places, and booking handoff.', 'https://gatherwise.gracezrx.com/'],
    ['Lyrebird Art', 'A nonprofit arts platform connecting concerts, fundraising, and community impact.', 'https://lyrebirdart.com/'],
    ['MyMusicID', 'A social platform concept for music enthusiasts to share, discuss, and collaborate.', 'https://gracezhong.me/my-music-id/'],
    ['Awarded Writing', 'Scholastic-recognized fiction and poetry as the narrative layer of the work.', 'https://www.gracezrx.com/writing.html']
  ];

  function resizeGameCanvas() {
    const bounds = gameCanvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
    gameWidth = Math.max(1, bounds.width);
    gameHeight = Math.max(1, bounds.height);
    gameCanvas.width = Math.floor(gameWidth * ratio);
    gameCanvas.height = Math.floor(gameHeight * ratio);
    gameContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    ground = gameHeight - 78;
    if (gameState) gameState.y = Math.min(gameState.y, ground - 58);
  }

  function resetGame() {
    gameState = {
      running: false,
      dead: false,
      ducking: false,
      y: ground - 58,
      velocityY: 0,
      score: 0,
      speed: 13.4,
      weather: 'sunny',
      weatherTimer: 320,
      obstacleTimer: 36,
      obstacles: [],
      particles: [],
      umbrella: null,
      equippedUmbrella: false
    };
    projectPopup.classList.remove('show');
    weatherLabel.textContent = 'Run score';
    scoreValue.textContent = '0';
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function obstacleInterval() {
    if (gameState.weather === 'rain') return [34, 76];
    if (gameState.weather === 'snow') return [40, 88];
    return [28, 64];
  }

  function spawnObstacles() {
    if (Math.random() < 0.48) {
      gameState.obstacles.push({ type: 'fly', x: gameWidth + 30, y: ground - random(80, 70), w: 54, h: 30 });
      if (Math.random() < 0.44) {
        gameState.obstacles.push({ type: 'fly', x: gameWidth + random(96, 138), y: ground - random(90, 72), w: 46, h: 24 });
      }
    } else {
      let tall = Math.random() < 0.45;
      gameState.obstacles.push({ type: tall ? 'tall' : 'short', x: gameWidth + 30, y: ground - (tall ? 58 : 38), w: tall ? 30 : 42, h: tall ? 58 : 38 });
      if (Math.random() < 0.52) {
        tall = Math.random() < 0.32;
        gameState.obstacles.push({ type: tall ? 'tall' : 'short', x: gameWidth + random(92, 150), y: ground - (tall ? 54 : 34), w: tall ? 28 : 38, h: tall ? 54 : 34 });
      }
    }
    const interval = obstacleInterval();
    gameState.obstacleTimer = random(interval[0], interval[1]);
  }

  function showDeathProject() {
    const project = deathProjects[projectIndex % deathProjects.length];
    projectIndex += 1;
    $('#popupTitle').textContent = project[0];
    $('#popupCopy').textContent = project[1];
    $('#popupLink').href = project[2];
    projectPopup.classList.add('show');
  }

  function die() {
    if (gameState.dead) return;
    gameState.dead = true;
    gameState.running = false;
    recordScore(Math.floor(gameState.score / 6));
    showDeathProject();
  }

  function updateGame(frameUnits) {
    if (!gameState.running) return;

    gameState.score += frameUnits;
    gameState.speed += 0.0032 * frameUnits;
    scoreValue.textContent = String(Math.floor(gameState.score / 6));

    gameState.weatherTimer -= frameUnits;
    if (gameState.weatherTimer <= 0) {
      const choices = ['sunny', 'rain', 'snow'].filter((weather) => weather !== gameState.weather);
      gameState.weather = choices[Math.random() < 0.5 ? 0 : 1];
      gameState.weatherTimer = gameState.weather === 'rain' ? 330 : 390;
      gameState.umbrella = null;
      gameState.equippedUmbrella = false;
    }
    weatherLabel.textContent = gameState.equippedUmbrella ? 'rain + umbrella' : `${gameState.weather} run`;

    gameState.velocityY += 0.92 * frameUnits;
    gameState.y += gameState.velocityY * frameUnits;
    if (gameState.y >= ground - 58) {
      gameState.y = ground - 58;
      gameState.velocityY = 0;
    }

    gameState.obstacleTimer -= frameUnits;
    if (gameState.obstacleTimer <= 0) spawnObstacles();

    const weatherMultiplier = gameState.weather === 'sunny' ? 1.11 : gameState.weather === 'snow' ? 0.87 : 1;
    const widthMultiplier = clamp(gameWidth / 760, 0.95, 1.35);
    const obstacleMove = gameState.speed * widthMultiplier * weatherMultiplier * frameUnits;
    gameState.obstacles.forEach((obstacle) => { obstacle.x -= obstacleMove; });
    gameState.obstacles = gameState.obstacles.filter((obstacle) => obstacle.x > -80);

    if (gameState.weather === 'rain' && !gameState.umbrella && !gameState.equippedUmbrella && gameState.score > 80) {
      gameState.umbrella = { x: gameWidth + 60, y: ground - 120, w: 34, h: 34 };
    }
    if (gameState.umbrella) {
      gameState.umbrella.x -= gameState.speed * widthMultiplier * frameUnits;
      if (gameState.umbrella.x < -60) gameState.umbrella = null;
    }

    const displayY = gameState.ducking ? ground - 34 : gameState.y;
    const displayHeight = gameState.ducking ? 34 : 58;
    const playerHitbox = { x: 70, y: displayY + 8, w: 34, h: displayHeight - 14 };

    if (gameState.umbrella && overlap(playerHitbox, gameState.umbrella)) {
      gameState.equippedUmbrella = true;
      gameState.umbrella = null;
    }

    const hit = gameState.obstacles.find((obstacle) => overlap(playerHitbox, obstacle));
    if (hit) {
      if (gameState.weather === 'rain' && gameState.equippedUmbrella) {
        gameState.equippedUmbrella = false;
        gameState.obstacles.splice(gameState.obstacles.indexOf(hit), 1);
      } else {
        die();
      }
    }

    if ((gameState.weather === 'rain' || gameState.weather === 'snow') && Math.random() < 0.5 * frameUnits) {
      gameState.particles.push({
        x: random(0, gameWidth),
        y: gameState.weather === 'rain' ? 16 : 8,
        size: random(2, 6),
        drift: gameState.weather === 'rain' ? -1.2 : random(-0.4, 0.4)
      });
    }
    gameState.particles.forEach((particle) => {
      particle.x += (particle.drift + gameState.speed * 0.04) * frameUnits;
      particle.y += (gameState.weather === 'snow' ? 1.4 : 8) * frameUnits;
    });
    gameState.particles = gameState.particles.filter((particle) => particle.y < gameHeight + 12);
  }

  function fillRect(x, y, width, height, color) {
    gameContext.fillStyle = color;
    gameContext.fillRect(x, y, width, height);
  }

  function drawUmbrella(x, y) {
    gameContext.strokeStyle = '#121217';
    gameContext.lineWidth = 3;
    gameContext.beginPath();
    gameContext.moveTo(x + 17, y + 10);
    gameContext.lineTo(x + 17, y + 34);
    gameContext.stroke();
    gameContext.strokeStyle = '#d7ff39';
    gameContext.lineWidth = 6;
    gameContext.beginPath();
    gameContext.arc(x + 17, y + 10, 16, Math.PI, 0);
    gameContext.stroke();
  }

  function drawGirl() {
    const y = gameState.ducking ? ground - 34 : gameState.y;
    const bob = gameState.ducking ? 0 : Math.floor((gameState.score % 16) / 8) * 2;
    if (gameState.ducking) {
      fillRect(62, y + 12, 50, 22, '#ff3d7f');
      fillRect(70, y, 24, 16, '#121217');
      fillRect(72, y + 18, 30, 14, '#18f0ff');
      return;
    }
    fillRect(70, y + 8 + bob, 34, 18, '#fff7dc');
    fillRect(66, y + bob, 42, 13, '#121217');
    fillRect(70, y + 26 + bob, 34, 18, '#ff3d7f');
    fillRect(76, y + 44, 10, 14, '#18f0ff');
    fillRect(91, y + 44, 10, 14, '#18f0ff');
    fillRect(74, y + 55, 14, 3, '#121217');
    fillRect(89, y + 55, 14, 3, '#121217');
    fillRect(84, y + 26 + bob, 7, 5, '#d7ff39');
    if (gameState.equippedUmbrella) drawUmbrella(71, y - 15);
  }

  function drawGame() {
    const background = gameState.weather === 'rain' ? '#c7f2f4' : gameState.weather === 'snow' ? '#dce6ef' : '#fff2ad';
    gameContext.clearRect(0, 0, gameWidth, gameHeight);
    fillRect(0, 0, gameWidth, gameHeight, background);

    const weatherMultiplier = gameState.weather === 'sunny' ? 1.11 : gameState.weather === 'snow' ? 0.87 : 1;
    for (let index = -1; index < gameWidth / 86 + 2; index += 1) {
      const x = index * 86 - ((gameState.score * 0.22 * weatherMultiplier) % 86);
      const heights = [18, 28, 38, 48];
      const buildingHeight = heights[((index % 4) + 4) % 4];
      fillRect(x, ground - buildingHeight, 38, buildingHeight, 'rgba(18,18,23,.12)');
      fillRect(x + 12, ground - buildingHeight - 6, 14, 6, 'rgba(18,18,23,.12)');
    }

    if (gameState.weather === 'sunny') {
      gameContext.strokeStyle = 'rgba(24,240,255,.42)';
      gameContext.lineWidth = 2;
      for (let index = 0; index < gameWidth / 120 + 2; index += 1) {
        const x = index * 120 - ((gameState.score * 2.8) % 120);
        gameContext.beginPath();
        gameContext.moveTo(x, 70);
        gameContext.lineTo(x + 70, 52);
        gameContext.stroke();
      }
    }

    gameState.particles.forEach((particle) => {
      if (gameState.weather === 'snow') {
        fillRect(particle.x, particle.y, particle.size, particle.size, 'rgba(255,255,255,.8)');
      } else {
        gameContext.strokeStyle = 'rgba(18,18,23,.35)';
        gameContext.lineWidth = 1;
        gameContext.beginPath();
        gameContext.moveTo(particle.x, particle.y);
        gameContext.lineTo(particle.x - 5, particle.y + particle.size * 3);
        gameContext.stroke();
      }
    });

    for (let index = 0; index < gameWidth / 72 + 2; index += 1) {
      const x = index * 72 - ((gameState.score * 1.45 * weatherMultiplier) % 72);
      fillRect(x, ground - 22, 22, 22, index % 2 ? '#7a5cff' : '#d7ff39');
    }

    gameContext.strokeStyle = '#121217';
    gameContext.lineWidth = 4;
    gameContext.beginPath();
    gameContext.moveTo(0, ground + 2);
    gameContext.lineTo(gameWidth, ground + 2);
    gameContext.stroke();

    for (let index = 0; index < gameWidth / 22 + 2; index += 1) {
      const x = index * 22 - ((gameState.score * 0.9 * weatherMultiplier) % 22);
      fillRect(x, ground + 10, 12, 5, index % 2 ? '#18f0ff' : '#ff3d7f');
    }

    gameState.obstacles.forEach((obstacle) => {
      if (obstacle.type === 'fly') {
        gameContext.fillStyle = '#18f0ff';
        gameContext.beginPath();
        gameContext.moveTo(obstacle.x, obstacle.y + 12);
        gameContext.lineTo(obstacle.x + 15, obstacle.y);
        gameContext.lineTo(obstacle.x + 28, obstacle.y + 9);
        gameContext.lineTo(obstacle.x + 42, obstacle.y);
        gameContext.lineTo(obstacle.x + 54, obstacle.y + 12);
        gameContext.lineTo(obstacle.x + 34, obstacle.y + 24);
        gameContext.lineTo(obstacle.x + 15, obstacle.y + 22);
        gameContext.closePath();
        gameContext.fill();
      } else {
        fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h, obstacle.type === 'tall' ? '#ff3d7f' : '#7a5cff');
      }
    });

    if (gameState.umbrella) drawUmbrella(gameState.umbrella.x, gameState.umbrella.y);
    drawGirl();
  }

  function startOrJump() {
    if (!gameState.running || gameState.dead) {
      resetGame();
      gameState.running = true;
      return;
    }
    if (Math.abs(gameState.y - (ground - 58)) <= 1) gameState.velocityY = -16.8;
  }

  function setDuck(active) {
    gameState.ducking = active;
  }

  function gameLoop(timestamp) {
    const elapsed = lastFrame ? Math.min(50, timestamp - lastFrame) : 16.67;
    lastFrame = timestamp;
    updateGame(elapsed / 16.67);
    drawGame();
    window.requestAnimationFrame(gameLoop);
  }

  startButton.addEventListener('click', startOrJump);
  gameCanvas.addEventListener('pointerdown', startOrJump);
  duckButton.addEventListener('pointerdown', () => setDuck(true));
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((eventName) => {
    duckButton.addEventListener(eventName, () => setDuck(false));
  });

  hideButton.addEventListener('click', () => {
    gameShell.classList.toggle('is-hidden');
    const hidden = gameShell.classList.contains('is-hidden');
    hideButton.textContent = hidden ? 'Show game' : 'Hide game';
    if (!hidden) resizeGameCanvas();
  });

  window.addEventListener('keydown', (event) => {
    if (event.target === playerName) return;
    if (event.key === ' ' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (event.key === 'ArrowDown') setDuck(true);
      else startOrJump();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setDuck(false);
    }
  });
  window.addEventListener('blur', () => setDuck(false));
  window.addEventListener('resize', () => {
    sizeFragmentCanvas();
    if (!gameShell.classList.contains('is-hidden')) resizeGameCanvas();
  });

  resizeGameCanvas();
  resetGame();
  window.requestAnimationFrame(gameLoop);
})();
