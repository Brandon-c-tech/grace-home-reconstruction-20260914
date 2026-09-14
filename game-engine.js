/* Independent reconstruction: deterministic rules derived only from the frozen prose specification. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReconstructionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const colors = { ink: '#121217', cream: '#fff7dc', lime: '#d7ff39', pink: '#ff3d7f', cyan: '#18f0ff', orange: '#ff8a00', purple: '#7a5cff' };
  const projects = [
    { title: 'Research', description: 'Project management for responsible technology infrastructure at Brown.', url: 'https://www.cntr-aisle.org/' },
    { title: 'Future News 2036', description: 'A future media simulator where sliders drive world state, market signals, and social discourse.', url: 'https://www.gracezrx.com/future-news-2036/' },
    { title: 'Gatherwise', description: 'An agentic planner for ranked outings, real places, and booking handoff.', url: 'https://gatherwise.gracezrx.com/' },
    { title: 'Lyrebird Art', description: 'A nonprofit arts platform connecting concerts, fundraising, and community impact.', url: 'https://lyrebirdart.com/' },
    { title: 'MyMusicID', description: 'A social platform concept for music enthusiasts to share, discuss, and collaborate.', url: 'https://gracezhong.me/my-music-id/' },
    { title: 'Awarded Writing', description: 'Scholastic-recognized fiction and poetry as the narrative layer of the work.', url: 'https://www.gracezrx.com/writing.html' }
  ];
  function sanitizeName(value) {
    return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_ .'\-]/g, '').trim().slice(0, 14) || 'Grace';
  }
  function cleanScores(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(row => row && typeof row === 'object').map(row => ({
      name: sanitizeName(row.name), score: clamp(parseInt(row.score, 10) || 0, 0, 999999)
    })).sort((a, b) => b.score - a.score).slice(0, 8);
  }
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  class Archive {
    constructor(width, height, random = Math.random) {
      this.random = random;
      this.sparks = [];
      this.pointer = { x: 0, y: 0, active: false };
      this.fragments = [
        { id: 'research', label: 'RESEARCH', radius: 78, sides: 3, color: colors.lime },
        { id: 'venture', label: 'VENTURE', radius: 38, sides: 4, color: colors.pink },
        { id: 'music', label: 'MUSIC', radius: 42, sides: 5, color: colors.cyan },
        { id: 'writing', label: 'WRITING', radius: 46, sides: 6, color: colors.orange }
      ].map((item, index) => ({ ...item, index, collected: false }));
      this.resize(width, height);
    }
    get count() { return this.fragments.filter(f => f.collected).length; }
    resize(width, height) {
      this.width = width; this.height = height;
      this.fragments.forEach((f, i) => {
        if (f.collected) return;
        f.x = width * (.18 + i * .16); f.y = height * (i % 2 ? .48 : .24);
        f.vx = this.random() * 1.7 - .85; f.vy = this.random() * 1.7 - .85; f.angle = this.random() * Math.PI;
      });
    }
    collect(id) {
      const f = this.fragments.find(fragment => fragment.id === id);
      if (!f || f.collected) return false;
      f.collected = true;
      for (let i = 0; i < 28; i++) {
        const angle = i / 28 * Math.PI * 2;
        this.sparks.push({ x: f.x, y: f.y, vx: Math.cos(angle) * (2 + this.random() * 4), vy: Math.sin(angle) * (2 + this.random() * 4), life: 34, color: f.color });
      }
      return true;
    }
    hit(x, y) {
      const f = this.fragments.find(fragment => !fragment.collected && Math.hypot(x - fragment.x, y - fragment.y) < fragment.radius + 18);
      return f && this.collect(f.id) ? f.id : null;
    }
    step() {
      this.fragments.forEach(f => {
        if (f.collected) return;
        if (this.pointer.active) {
          const dx = f.x - this.pointer.x, dy = f.y - this.pointer.y;
          const rawDistance = Math.hypot(dx, dy), distance = Math.max(1, rawDistance);
          if (rawDistance < 180) {
            const force = (1 - rawDistance / 180) * .45;
            f.vx += dx / distance * force; f.vy += dy / distance * force;
          }
        }
        f.x += f.vx; f.y += f.vy; f.angle += .015 + f.index * .001;
        f.vx *= .99; f.vy *= .99;
        if (f.x < f.radius || f.x > this.width - f.radius) {
          f.vx *= -1; f.x = clamp(f.x, f.radius, Math.max(f.radius, this.width - f.radius));
        }
        if (f.y < f.radius || f.y > this.height - f.radius) {
          f.vy *= -1; f.y = clamp(f.y, f.radius, Math.max(f.radius, this.height - f.radius));
        }
      });
      this.sparks.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .04; p.life--; });
      this.sparks = this.sparks.filter(p => p.life > 0);
    }
  }
  class Runner {
    constructor(width = 760, height = 420, random = Math.random) {
      this.random = random; this.width = width; this.height = height; this.ground = height - 78;
      this.widthScale = clamp(width / 760, .95, 1.35);
      this.running = false; this.started = false; this.score = 0; this.speed = 13.4;
      this.weather = 'sunny'; this.weatherTimer = 420; this.obstacleTimer = 36;
      this.obstacles = []; this.particles = []; this.umbrella = null; this.equipped = false;
      this.player = { x: 62, y: this.ground - 58, w: 50, h: 58, vy: 0, duck: false };
      this.projectIndex = 0; this.recorded = false;
    }
    get displayScore() { return Math.floor(this.score / 6); }
    get weatherMultiplier() { return this.weather === 'sunny' ? 1.11 : this.weather === 'rain' ? 1 : .87; }
    get label() { return !this.started ? 'Run score' : this.weather === 'rain' && this.equipped ? 'rain + umbrella' : this.weather + ' run'; }
    resize(width, height) {
      this.width = width; this.height = height; this.ground = height - 78;
      this.widthScale = clamp(width / 760, .95, 1.35);
      this.player.y = Math.min(this.player.y, this.ground - 58);
    }
    start() {
      this.running = true; this.started = true; this.score = 0; this.speed = 13.4;
      this.weather = 'sunny'; this.weatherTimer = 320; this.obstacleTimer = 36;
      this.obstacles = []; this.particles = []; this.umbrella = null; this.equipped = false;
      this.player.y = this.ground - 58; this.player.vy = 0; this.player.duck = false; this.recorded = false;
    }
    action() {
      if (!this.running) { this.start(); return 'start'; }
      if (this.player.y >= this.ground - 58 - 1) { this.player.vy = -16.8; return 'jump'; }
      return null;
    }
    bounds() {
      const height = this.player.duck ? 34 : 58;
      const y = this.player.duck ? this.ground - height : this.player.y;
      return { x: this.player.x + 8, y: y + 8, w: this.player.w - 16, h: height - 14 };
    }
    changeWeather() {
      const choices = ['sunny', 'rain', 'snow'].filter(w => w !== this.weather);
      this.weather = choices[Math.floor(this.random() * choices.length)];
      this.weatherTimer = this.weather === 'rain' ? 330 : 390;
      this.umbrella = null; this.equipped = false;
    }
    spawnObstacles() {
      const flying = this.random() < .48;
      if (flying) {
        this.obstacles.push({ type: 'fly', x: this.width + 30, y: this.ground - (70 + this.random() * 10), w: 54, h: 30, color: colors.cyan });
        if (this.random() < .44) this.obstacles.push({ type: 'fly', x: this.width + 96 + this.random() * 42, y: this.ground - (72 + this.random() * 18), w: 46, h: 24, color: colors.cyan });
      } else {
        const tall = this.random() < .45, h = tall ? 58 : 38;
        this.obstacles.push({ type: 'block', x: this.width + 30, y: this.ground - h, w: tall ? 30 : 42, h, color: tall ? colors.pink : colors.purple });
        if (this.random() < .52) {
          const secondTall = this.random() < .32, secondHeight = secondTall ? 54 : 34;
          this.obstacles.push({ type: 'block', x: this.width + 92 + this.random() * 58, y: this.ground - secondHeight, w: secondTall ? 28 : 38, h: secondHeight, color: secondTall ? colors.pink : colors.purple });
        }
      }
      const [low, high] = this.weather === 'sunny' ? [28, 64] : this.weather === 'rain' ? [34, 76] : [40, 88];
      this.obstacleTimer = low + this.random() * (high - low);
    }
    step(milliseconds) {
      if (!this.running) return null;
      const factor = clamp(milliseconds, 0, 50) / (1000 / 60);
      if (factor === 0) return null;
      this.score += factor; this.speed += .0032 * factor;
      this.weatherTimer -= factor;
      if (this.weatherTimer <= 0) this.changeWeather();
      if (this.weather !== 'sunny' && this.random() < .5 * factor) {
        const snow = this.weather === 'snow';
        this.particles.push({ x: this.random() * this.width, y: snow ? -8 : -16, size: snow ? 2 + this.random() * 4 : 10 + this.random() * 12, drift: snow ? this.random() * .8 - .4 : -1.2 });
      }
      for (const p of this.particles) {
        p.x += (p.drift - this.speed * .04) * factor;
        p.y += (this.weather === 'snow' ? 1.4 : 8) * factor;
      }
      this.particles = this.particles.filter(p => p.y <= this.height + 12);
      this.player.vy += .92 * factor; this.player.y += this.player.vy * factor;
      if (this.player.y >= this.ground - 58) { this.player.y = this.ground - 58; this.player.vy = 0; }
      this.obstacleTimer -= factor;
      if (this.obstacleTimer <= 0) this.spawnObstacles();
      const movement = this.speed * this.widthScale * this.weatherMultiplier * factor;
      this.obstacles.forEach(o => { o.x -= movement; });
      this.obstacles = this.obstacles.filter(o => o.x > -80);
      if (this.weather === 'rain' && !this.umbrella && !this.equipped && this.score > 80) {
        this.umbrella = { x: this.width + 60, y: this.ground - 120, w: 34, h: 34 };
      }
      const playerBounds = this.bounds();
      if (this.umbrella) {
        this.umbrella.x -= this.speed * this.widthScale * factor;
        if (overlap(playerBounds, this.umbrella)) { this.equipped = true; this.umbrella = null; }
        else if (this.umbrella.x < -60) this.umbrella = null;
      }
      const collision = this.obstacles.findIndex(o => overlap(playerBounds, o));
      if (collision >= 0) {
        if (this.weather === 'rain' && this.equipped) {
          this.obstacles.splice(collision, 1); this.equipped = false;
          return { type: 'shield' };
        }
        this.running = false;
        if (!this.recorded) {
          this.recorded = true;
          const project = projects[this.projectIndex % projects.length];
          this.projectIndex++;
          return { type: 'death', score: this.displayScore, project };
        }
      }
      return null;
    }
  }
  return { Archive, Runner, colors, projects, cleanScores, sanitizeName, overlap, clamp };
});
