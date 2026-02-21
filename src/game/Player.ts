import { Vector2 } from './types';

export class Player {
  x: number = 0;
  y: number = 0;
  vx: number = 0;
  vy: number = 0;
  speed: number = 4;
  radius: number = 16;
  maxHp: number = 100;
  hp: number = 100;
  exp: number = 0;
  level: number = 1;
  expToNextLevel: number = 10;
  pickupRadius: number = 80;
  lastDamageTime: number = 0;
  invulnDuration: number = 500;

  keys: { [key: string]: boolean } = {};

  constructor() {
    window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
  }

  update() {
    let dx = 0;
    let dy = 0;
    if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
    if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
    if (this.keys['d'] || this.keys['arrowright']) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    this.x += dx * this.speed;
    this.y += dy * this.speed;
  }

  takeDamage(amount: number) {
    const now = Date.now();
    if (now - this.lastDamageTime > this.invulnDuration) {
      this.hp -= amount;
      this.lastDamageTime = now;
    }
  }

  gainExp(amount: number) {
    this.exp += amount;
  }

  checkLevelUp(): boolean {
    if (this.exp >= this.expToNextLevel) {
      this.exp -= this.expToNextLevel;
      this.level++;
      this.expToNextLevel = Math.floor(this.expToNextLevel * 1.5);
      return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Vector2) {
    const drawX = this.x - camera.x;
    const drawY = this.y - camera.y;

    // Draw pickup radius
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(drawX, drawY, this.pickupRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw player
    const isInvuln = Date.now() - this.lastDamageTime < this.invulnDuration;
    ctx.fillStyle = isInvuln && Math.floor(Date.now() / 100) % 2 === 0 ? '#ffaaaa' : '#ffffff';
    ctx.beginPath();
    ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
