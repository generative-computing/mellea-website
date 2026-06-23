'use client';

import { useEffect, useRef } from 'react';

interface DotFieldProps {
  className?: string;
}

const DOT_RADIUS = 1.5;
const DOT_SPACING = 17;
const CURSOR_RADIUS = 850;
const BULGE_STRENGTH = 137;
const WAVE_AMPLITUDE = 3;
const GRADIENT_FROM = [243, 198, 11];
const GRADIENT_TO = [22, 22, 22];

export default function DotField({ className = '' }: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: { baseX: number; baseY: number }[] = [];
    let width = 0;
    let height = 0;
    let time = 0;

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
      buildGrid();
    };

    const buildGrid = () => {
      dots = [];
      const cols = Math.ceil(width / DOT_SPACING) + 1;
      const rows = Math.ceil(height / DOT_SPACING) + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({ baseX: c * DOT_SPACING, baseY: r * DOT_SPACING });
        }
      }
    };

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const draw = () => {
      time += 0.01;
      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const dot of dots) {
        const dx = dot.baseX - mx;
        const dy = dot.baseY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let x = dot.baseX;
        let y = dot.baseY;

        // Wave
        x += Math.sin(time + dot.baseY * 0.01) * WAVE_AMPLITUDE;
        y += Math.cos(time + dot.baseX * 0.01) * WAVE_AMPLITUDE;

        // Bulge
        if (dist < CURSOR_RADIUS && dist > 0) {
          const factor = 1 - dist / CURSOR_RADIUS;
          const push = factor * factor * BULGE_STRENGTH;
          x += (dx / dist) * push;
          y += (dy / dist) * push;
        }

        // Gradient color
        const t = Math.min(dist / CURSOR_RADIUS, 1);
        const r = Math.round(lerp(GRADIENT_FROM[0], GRADIENT_TO[0], t));
        const g = Math.round(lerp(GRADIENT_FROM[1], GRADIENT_TO[1], t));
        const b = Math.round(lerp(GRADIENT_FROM[2], GRADIENT_TO[2], t));
        const alpha = lerp(0.55, 0.12, t);

        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    resize();
    animRef.current = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className={`dot-field ${className}`}>
      <canvas className="dot-field__canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
