import { Player } from './Player';
import { Snake, Segment } from './Enemy';
import { Weapon, MagicWand } from './Weapons';
import { Gem } from './Gems';
import { Particle, DamageNumber } from './Particles';
import { Vector2 } from './types';

const ATTACK_PENALTY_PER_KIND = 0.12;
const MIN_ATTACK_SPEED = 0.15;
const MIN_COOLDOWN_FRAMES = 3;
const BOSS_SPAWN_INTERVAL_SECONDS = 60;

export type SegmentDamagedPayload = {
  snake: Snake;
  segment: Segment;
  amount: number;
  sourceId?: string;
};

export type SegmentDestroyedPayload = {
  snake: Snake;
  segment: Segment;
  sourceId?: string;
};

export type PlayerDamagedPayload = {
  amount: number;
};

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  player: Player;
  snakes: Snake[] = [];
  weapons: Weapon[] = [];
  gems: Gem[] = [];
  particles: Particle[] = [];
  damageNumbers: DamageNumber[] = [];

  camera: Vector2 = { x: 0, y: 0 };

  lastTime: number = 0;
  spawnTimer: number = 0;
  gameTime: number = 0; // in seconds
  nextBossSpawnTime: number = BOSS_SPAWN_INTERVAL_SECONDS;
  bossSpawnCount: number = 0;

  isGameOver: boolean = false;
  isPaused: boolean = false;

  timeDilationUntil: number = 0;
  timeDilationEnemySpeedMul: number = 1;
  timeDilationAttackMul: number = 1;

  onLevelUp: () => void;
  onGameOver: () => void;

  animationFrameId: number = 0;

  constructor(canvas: HTMLCanvasElement, onLevelUp: () => void, onGameOver: () => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.player = new Player();
    this.weapons.push(new MagicWand());
    this.onLevelUp = onLevelUp;
    this.onGameOver = onGameOver;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    cancelAnimationFrame(this.animationFrameId);
  }

  hasWeapon(id: string): boolean {
    return this.weapons.some((weapon) => weapon.id === id);
  }

  getWeaponLevel(id: string): number {
    const weapon = this.weapons.find((w) => w.id === id);
    return weapon ? weapon.level : 0;
  }

  getAttackPenaltyMultiplierForKinds(kinds: number): number {
    return 1 + Math.max(0, kinds - 1) * ATTACK_PENALTY_PER_KIND;
  }

  getAttackPenaltyMultiplier(): number {
    return this.getAttackPenaltyMultiplierForKinds(this.weapons.length);
  }

  getEffectiveAttackSpeed(): number {
    return Math.max(MIN_ATTACK_SPEED, 1 / this.getAttackPenaltyMultiplier());
  }

  toEffectiveCooldown(baseFrames: number): number {
    const bySpeed = baseFrames / this.getEffectiveAttackSpeed();
    const withTimeDilation = bySpeed * this.timeDilationAttackMul;
    return Math.max(MIN_COOLDOWN_FRAMES, Math.round(withTimeDilation));
  }

  getExpMultiplier(): number {
    const greedLevel = this.getWeaponLevel('greed-pact');
    return 1 + greedLevel * 0.12;
  }

  getEnemyStrengthMultiplier(): number {
    const greedLevel = this.getWeaponLevel('greed-pact');
    return 1 + greedLevel * 0.08;
  }

  activateTimeDilation(durationMs: number, enemySpeedMul: number, attackCooldownMul: number) {
    const now = Date.now();
    this.timeDilationUntil = Math.max(this.timeDilationUntil, now + durationMs);
    this.timeDilationEnemySpeedMul = enemySpeedMul;
    this.timeDilationAttackMul = attackCooldownMul;
  }

  notifyPlayerDamaged(amount: number) {
    const payload: PlayerDamagedPayload = { amount };
    for (const weapon of [...this.weapons]) {
      weapon.onPlayerDamaged?.(this, payload);
    }
  }

  loop(time: number) {
    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));

    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    if (this.isPaused || this.isGameOver) {
      this.draw(); // Keep drawing while paused
      return;
    }

    this.gameTime += dt;
    this.update();
    this.draw();
  }

  update() {
    const now = Date.now();
    if (now > this.timeDilationUntil) {
      this.timeDilationEnemySpeedMul = 1;
      this.timeDilationAttackMul = 1;
    }

    this.player.update();

    if (this.player.hp <= 0) {
      this.isGameOver = true;
      this.onGameOver();
      return;
    }

    if (this.player.checkLevelUp()) {
      this.isPaused = true;
      this.onLevelUp();
    }

    // Camera follow
    this.camera.x = this.player.x - this.canvas.width / 2;
    this.camera.y = this.player.y - this.canvas.height / 2;

    // Spawn enemies
    this.spawnTimer++;
    // Spawn rate increases over time
    const spawnInterval = Math.max(30, 120 - this.gameTime * 0.5);
    if (this.spawnTimer > spawnInterval) {
      this.spawnTimer = 0;
      this.spawnSnake();
    }

    while (this.gameTime >= this.nextBossSpawnTime) {
      this.spawnBossSnakeKing();
      this.nextBossSpawnTime += BOSS_SPAWN_INTERVAL_SECONDS;
    }

    // Update weapons
    for (const weapon of this.weapons) {
      weapon.update(this);
    }

    // Update snakes
    for (let i = this.snakes.length - 1; i >= 0; i--) {
      const snake = this.snakes[i];
      const damageDealt = snake.update(this.player, this.timeDilationEnemySpeedMul);
      if (damageDealt > 0) {
        this.notifyPlayerDamaged(damageDealt);
      }
      if (snake.segments.length === 0) {
        this.snakes.splice(i, 1);
      }
    }

    if (this.player.hp <= 0) {
      this.isGameOver = true;
      this.onGameOver();
      return;
    }

    // Update gems
    const expMultiplier = this.getExpMultiplier();
    for (let i = this.gems.length - 1; i >= 0; i--) {
      if (this.gems[i].update(this.player, expMultiplier)) {
        this.gems.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i].update();
      if (this.damageNumbers[i].life <= 0) this.damageNumbers.splice(i, 1);
    }
  }

  spawnSnake() {
    const { x, y } = this.getSpawnPoint(100);

    // Difficulty scaling
    const length = 3 + Math.floor(this.gameTime / 30);
    const enemyMultiplier = this.getEnemyStrengthMultiplier();
    const hp = (10 + this.gameTime * 0.5) * enemyMultiplier;
    const speed = 1.5 + Math.random() * 1;
    const damage = (5 + Math.floor(this.gameTime / 60) * 2) * enemyMultiplier;

    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.snakes.push(new Snake(x, y, length, hp, speed, damage, color));
  }

  getSpawnPoint(padding: number = 100): { x: number; y: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.canvas.width, this.canvas.height) / 2 + padding;
    return {
      x: this.player.x + Math.cos(angle) * dist,
      y: this.player.y + Math.sin(angle) * dist,
    };
  }

  spawnBossSnakeKing() {
    const { x, y } = this.getSpawnPoint(240);
    const enemyMultiplier = this.getEnemyStrengthMultiplier();
    const bossIndex = this.bossSpawnCount;

    const length = 12 + Math.min(16, bossIndex * 2);
    const hp = (280 + this.gameTime * 9 + bossIndex * 180) * enemyMultiplier;
    const speed = 1.9 + Math.random() * 0.5;
    const damage = (24 + Math.floor(this.gameTime / 60) * 4 + bossIndex * 5) * enemyMultiplier;

    const bossSnake = new Snake(x, y, length, hp, speed, damage, '#b91c1c', 18, true);
    this.snakes.push(bossSnake);
    this.bossSpawnCount++;
  }

  damageSegment(snake: Snake, segment: Segment, amount: number, sourceId?: string) {
    if (amount <= 0 || segment.hp <= 0) {
      return;
    }

    const isCrit = Math.random() < 0.1;
    const dmg = isCrit ? amount * 2 : amount;
    segment.hp -= dmg;

    this.damageNumbers.push(new DamageNumber(segment.x, segment.y, dmg, isCrit));

    for (let i = 0; i < 3; i++) {
      this.particles.push(new Particle(segment.x, segment.y, segment.color, 3));
    }

    const damagedPayload: SegmentDamagedPayload = {
      snake,
      segment,
      amount: dmg,
      sourceId,
    };
    for (const weapon of [...this.weapons]) {
      weapon.onSegmentDamaged?.(this, damagedPayload);
    }

    if (segment.hp <= 0) {
      const destroyedPayload: SegmentDestroyedPayload = {
        snake,
        segment,
        sourceId,
      };
      for (const weapon of [...this.weapons]) {
        weapon.onSegmentDestroyed?.(this, destroyedPayload);
      }

      const index = snake.segments.indexOf(segment);
      if (index !== -1) {
        this.gems.push(new Gem(segment.x, segment.y, segment.isHead ? 5 : 1));

        const tailSegments = snake.segments.slice(index + 1);
        snake.segments = snake.segments.slice(0, index);

        if (snake.segments.length > 0) {
          snake.segments[0].isHead = true;
        }

        if (tailSegments.length > 0) {
          tailSegments[0].isHead = true;
          const newSnake = new Snake(0, 0, 0, 0, 0, 0, '');
          newSnake.segments = tailSegments;
          newSnake.speed = snake.speed;
          newSnake.damage = snake.damage;
          newSnake.isBoss = snake.isBoss;
          this.snakes.push(newSnake);
        }
      }
    }
  }

  draw() {
    this.ctx.fillStyle = '#111827';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = '#1f2937';
    this.ctx.lineWidth = 1;
    const gridSize = 100;
    const offsetX = (-this.camera.x % gridSize);
    const offsetY = (-this.camera.y % gridSize);

    this.ctx.beginPath();
    for (let x = offsetX; x < this.canvas.width; x += gridSize) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
    }
    for (let y = offsetY; y < this.canvas.height; y += gridSize) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
    }
    this.ctx.stroke();

    for (const gem of this.gems) gem.draw(this.ctx, this.camera);
    for (const snake of this.snakes) snake.draw(this.ctx, this.camera);
    for (const weapon of this.weapons) weapon.draw(this.ctx, this.camera, this);
    this.player.draw(this.ctx, this.camera);

    for (const particle of this.particles) particle.draw(this.ctx, this.camera);
    for (const d of this.damageNumbers) d.draw(this.ctx, this.camera);
  }
}
