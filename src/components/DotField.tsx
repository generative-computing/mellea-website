'use client';

import { useEffect, useRef } from 'react';

interface DotFieldProps {
  className?: string;
}

const DOT_RADIUS = 1.9;
const DOT_SPACING = 17;
const CURSOR_RADIUS = 850;
const BULGE_STRENGTH = 137;
const WAVE_AMPLITUDE = 3;
const GRADIENT_FROM = 'rgba(180, 130, 0, 0.85)';
const GRADIENT_TO = 'rgba(100, 70, 0, 0.35)';

interface Dot {
  ax: number;
  ay: number;
  sx: number;
  sy: number;
}

export default function DotField({ className = '' }: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;
    let frameCount = 0;

    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 };
    let engagement = 0;
    let offsetX = 0;
    let offsetY = 0;

    const buildDots = () => {
      const step = DOT_RADIUS + DOT_SPACING;
      const cols = Math.floor(width / step);
      const rows = Math.floor(height / step);
      const padX = (width % step) / 2;
      const padY = (height % step) / 2;
      dots = new Array(rows * cols);
      let idx = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots[idx++] = { ax, ay, sx: ax, sy: ay };
        }
      }
    };

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      offsetX = rect.left + window.scrollX;
      offsetY = rect.top + window.scrollY;
      buildDots();
    };

    const updateMouseSpeed = () => {
      const dx = mouse.prevX - mouse.x;
      const dy = mouse.prevY - mouse.y;
      const dist = Math.hypot(dx, dy);
      mouse.speed += (dist - mouse.speed) * 0.5;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    };

    const tick = () => {
      frameCount++;
      const t = frameCount * 0.02;
      const len = dots.length;

      const targetEngagement = Math.min(mouse.speed / 5, 1);
      engagement += (targetEngagement - engagement) * 0.06;
      if (engagement < 0.001) engagement = 0;
      const eng = engagement;

      ctx.clearRect(0, 0, width, height);

      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, GRADIENT_FROM);
      grad.addColorStop(1, GRADIENT_TO);
      ctx.fillStyle = grad;

      const crSq = CURSOR_RADIUS * CURSOR_RADIUS;

      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const d = dots[i];
        const dx = mouse.x - d.ax;
        const dy = mouse.y - d.ay;
        const distSq = dx * dx + dy * dy;

        if (distSq < crSq && eng > 0.01) {
          const dist = Math.sqrt(distSq);
          const factor = 1 - dist / CURSOR_RADIUS;
          const push = factor * factor * BULGE_STRENGTH * eng;
          const angle = Math.atan2(dy, dx);
          d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
          d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
        } else {
          d.sx += (d.ax - d.sx) * 0.1;
          d.sy += (d.ay - d.sy) * 0.1;
        }

        let drawX = d.sx;
        let drawY = d.sy;
        if (WAVE_AMPLITUDE > 0) {
          drawY += Math.sin(d.ax * 0.03 + t) * WAVE_AMPLITUDE;
          drawX += Math.cos(d.ay * 0.03 + t * 0.7) * WAVE_AMPLITUDE * 0.5;
        }

        const half = DOT_RADIUS / 2;
        ctx.rect(drawX - half, drawY - half, DOT_RADIUS, DOT_RADIUS);
      }

      ctx.fill();
      animRef.current = requestAnimationFrame(tick);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.pageX - offsetX;
      mouse.y = e.pageY - offsetY;
    };

    resize();
    animRef.current = requestAnimationFrame(tick);
    const speedInterval = setInterval(updateMouseSpeed, 20);

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(speedInterval);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className={`dot-field ${className}`}>
      <canvas className="dot-field__canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
