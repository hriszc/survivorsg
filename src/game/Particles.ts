import { Vector2 } from './types';

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;

  constructor(x: number, y: number, color: string, speed: number = 2) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    this.vx = Math.cos(angle) * s;
    this.vy = Math.sin(angle) * s;
    this.maxLife = 20 + Math.random() * 20;
    this.life = this.maxLife;
    this.color = color;
    this.size = 2 + Math.random() * 3;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Vector2) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x - camera.x, this.y - camera.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export class DamageNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  maxLife: number = 30;
  isCrit: boolean;

  constructor(x: number, y: number, value: number, isCrit: boolean = false) {
    this.x = x + (Math.random() - 0.5) * 20;
    this.y = y + (Math.random() - 0.5) * 20;
    this.value = Math.floor(value);
    this.life = this.maxLife;
    this.isCrit = isCrit;
  }

  update() {
    this.y -= 1;
    this.life--;
  }

  draw(ctx: CanvasRenderingContext2D, camera: Vector2) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.isCrit ? '#ffcc00' : '#ffffff';
    ctx.font = `bold ${this.isCrit ? 20 : 14}px sans-serif`;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    const text = this.value.toString();
    const drawX = this.x - camera.x;
    const drawY = this.y - camera.y;
    ctx.strokeText(text, drawX, drawY);
    ctx.fillText(text, drawX, drawY);
    ctx.globalAlpha = 1;
  }
}
