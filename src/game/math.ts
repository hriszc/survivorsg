import { Vector2 } from './types';

export const distance = (p1: Vector2, p2: Vector2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
export const normalize = (v: Vector2) => {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
