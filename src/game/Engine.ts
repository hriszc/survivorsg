import { Player } from './Player';
import { Snake, Segment } from './Enemy';
import { Weapon, MagicWand, WEAPON_TYPES } from './Weapons';
import { Gem } from './Gems';
import { Particle, DamageNumber } from './Particles';
import { Vector2 } from './types';

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
  
  isGameOver: boolean = false;
  isPaused: boolean = false;
  
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

    // Update weapons
    for (const w of this.weapons) {
      w.update(this);
    }

    // Update snakes
    for (let i = this.snakes.length - 1; i >= 0; i--) {
      const snake = this.snakes[i];
      snake.update(this.player);
      if (snake.segments.length === 0) {
        this.snakes.splice(i, 1);
      }
    }

    // Update gems
    for (let i = this.gems.length - 1; i >= 0; i--) {
      if (this.gems[i].update(this.player)) {
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
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.canvas.width, this.canvas.height) / 2 + 100;
    const x = this.player.x + Math.cos(angle) * dist;
    const y = this.player.y + Math.sin(angle) * dist;
    
    // Difficulty scaling
    const length = 3 + Math.floor(this.gameTime / 30);
    const hp = 10 + this.gameTime * 0.5;
    const speed = 1.5 + Math.random() * 1;
    const damage = 5 + Math.floor(this.gameTime / 60) * 2;
    
    const colors = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    this.snakes.push(new Snake(x, y, length, hp, speed, damage, color));
  }

  damageSegment(snake: Snake, segment: Segment, amount: number) {
    const isCrit = Math.random() < 0.1;
    const dmg = isCrit ? amount * 2 : amount;
    segment.hp -= dmg;
    
    this.damageNumbers.push(new DamageNumber(segment.x, segment.y, dmg, isCrit));
    
    // Blood particles
    for(let i=0; i<3; i++) {
        this.particles.push(new Particle(segment.x, segment.y, segment.color, 3));
    }

    if (segment.hp <= 0) {
      // Split snake
      const index = snake.segments.indexOf(segment);
      if (index !== -1) {
        // Drop gem
        this.gems.push(new Gem(segment.x, segment.y, segment.isHead ? 5 : 1));

        const tailSegments = snake.segments.slice(index + 1);
        snake.segments = snake.segments.slice(0, index);
        
        if (snake.segments.length > 0) {
            snake.segments[0].isHead = true;
        }

        if (tailSegments.length > 0) {
          tailSegments[0].isHead = true;
          const newSnake = new Snake(0, 0, 0, 0, 0, 0, ''); // Dummy init
          newSnake.segments = tailSegments;
          newSnake.speed = snake.speed;
          newSnake.damage = snake.damage;
          this.snakes.push(newSnake);
        }
      }
    }
  }

  draw() {
    // Draw background grid
    this.ctx.fillStyle = '#111827'; // gray-900
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.strokeStyle = '#1f2937'; // gray-800
    this.ctx.lineWidth = 1;
    const gridSize = 100;
    const offsetX = -this.camera.x % gridSize;
    const offsetY = -this.camera.y % gridSize;
    
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

    // Draw entities
    for (const gem of this.gems) gem.draw(this.ctx, this.camera);
    for (const snake of this.snakes) snake.draw(this.ctx, this.camera);
    for (const w of this.weapons) w.draw(this.ctx, this.camera, this);
    this.player.draw(this.ctx, this.camera);
    
    for (const p of this.particles) p.draw(this.ctx, this.camera);
    for (const d of this.damageNumbers) d.draw(this.ctx, this.camera);
  }
}
