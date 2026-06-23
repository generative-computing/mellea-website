'use client';

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import Image from 'next/image';

const emptySubscribe = () => () => {};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const SCROLL_THRESHOLD = 12;
const STORAGE_KEY = 'mellea-cursor-follower';

const POSITION_DAMPING = 0.11;
const REPULSE_STRENGTH = 2.1;
const MAX_REPULSE = 260;
const STILL_SPEED = 40;
const VELOCITY_SMOOTH = 0.22;
const REPULSE_RETURN_STILL = 0.07;
const REPULSE_RETURN_MOVING = 0.018;
const SPRITE_OFFSET_X = 28;
const SPRITE_OFFSET_Y = 24;

const TRAIL_DAMPING = 0.028;
const TRAIL_OFFSET_X = 32;
const TRAIL_OFFSET_Y = 40;

const EDGE_ENTER_MS = 620;
const EDGE_EXIT_MS = 520;
const OFFSCREEN_PAD = 72;

const HOVER_TRIGGERS = [
  { selector: '.github-btn', sprite: 'f', scale: 1.4 },
  { selector: '.btn-pip-install', sprite: 'c', scale: 1 },
  { selector: '.btn-primary, .btn-nav-get-started', sprite: 'h', scale: 1 },
];

function damp(current: number, target: number, factor: number) {
  return current + (target - current) * factor;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function getNearestEdgeTarget(x: number, y: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const distances = [
    { edge: 'top', value: y },
    { edge: 'right', value: w - x },
    { edge: 'bottom', value: h - y },
    { edge: 'left', value: x },
  ];
  distances.sort((a, b) => a.value - b.value);
  const edge = distances[0].edge;
  switch (edge) {
    case 'top': return { x, y: -OFFSCREEN_PAD };
    case 'right': return { x: w + OFFSCREEN_PAD, y };
    case 'bottom': return { x, y: h + OFFSCREEN_PAD };
    default: return { x: -OFFSCREEN_PAD, y };
  }
}

function getRandomEdgeOrigin() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const edges = ['top', 'right', 'bottom', 'left'] as const;
  const edge = edges[Math.floor(Math.random() * edges.length)];
  switch (edge) {
    case 'top': return { x: Math.random() * w, y: -OFFSCREEN_PAD };
    case 'right': return { x: w + OFFSCREEN_PAD, y: Math.random() * h };
    case 'bottom': return { x: Math.random() * w, y: h + OFFSCREEN_PAD };
    default: return { x: -OFFSCREEN_PAD, y: Math.random() * h };
  }
}

function readPreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === 'true';
  } catch {
    return true;
  }
}

function writePreference(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch { /* ignore */ }
}

export default function CursorFollower() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return readPreference();
  });
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const spriteRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number>(0);
  const stateRef = useRef({
    pointerX: -200,
    pointerY: -200,
    lastPointerX: -200,
    lastPointerY: -200,
    lastPointerTime: 0,
    smoothVelX: 0,
    smoothVelY: 0,
    repulseX: 0,
    repulseY: 0,
    currentX: -200,
    currentY: -200,
    lastFrameTime: 0,
    visible: false,
    lifecycle: 'hidden' as 'hidden' | 'entering' | 'active' | 'exiting',
    activeSprite: 'a',
    activeScale: 1,
    // Trail state
    trailX: -200,
    trailY: -200,
    trailVisible: false,
    trailLifecycle: 'hidden' as 'hidden' | 'entering' | 'active' | 'exiting',
    graniteInView: false,
  });

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      writePreference(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const sprite = spriteRef.current;
    const trail = trailRef.current;
    const img = imageRef.current;
    if (!sprite || !trail || !img) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const s = stateRef.current;
    s.lastFrameTime = performance.now();
    s.lastPointerTime = performance.now();

    let animToken = 0;
    let trailAnimToken = 0;

    function animateToPosition(
      getPos: () => { x: number; y: number },
      setPos: (x: number, y: number) => void,
      target: { x: number; y: number } | (() => { x: number; y: number }),
      durationMs: number
    ): Promise<number> {
      const token = ++animToken;
      const from = getPos();
      const resolveTarget = typeof target === 'function' ? target : () => target;
      const start = performance.now();

      return new Promise((resolve) => {
        function frame(now: number) {
          const t = Math.min((now - start) / durationMs, 1);
          const eased = easeOutCubic(t);
          const tgt = resolveTarget();
          setPos(from.x + (tgt.x - from.x) * eased, from.y + (tgt.y - from.y) * eased);
          if (t < 1 && animToken === token) {
            requestAnimationFrame(frame);
          } else {
            resolve(token);
          }
        }
        requestAnimationFrame(frame);
      });
    }

    function animateTrailToPosition(
      getPos: () => { x: number; y: number },
      setPos: (x: number, y: number) => void,
      target: { x: number; y: number } | (() => { x: number; y: number }),
      durationMs: number
    ): Promise<number> {
      const token = ++trailAnimToken;
      const from = getPos();
      const resolveTarget = typeof target === 'function' ? target : () => target;
      const start = performance.now();

      return new Promise((resolve) => {
        function frame(now: number) {
          const t = Math.min((now - start) / durationMs, 1);
          const eased = easeOutCubic(t);
          const tgt = resolveTarget();
          setPos(from.x + (tgt.x - from.x) * eased, from.y + (tgt.y - from.y) * eased);
          if (t < 1 && trailAnimToken === token) {
            requestAnimationFrame(frame);
          } else {
            resolve(token);
          }
        }
        requestAnimationFrame(frame);
      });
    }

    function setSpritePos(x: number, y: number) {
      s.currentX = x;
      s.currentY = y;
      sprite!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    function setTrailPos(x: number, y: number) {
      s.trailX = x;
      s.trailY = y;
      trail!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    async function enterSprite() {
      if (s.lifecycle === 'active' || s.lifecycle === 'entering') return;
      s.lifecycle = 'entering';

      const origin = getRandomEdgeOrigin();
      setSpritePos(origin.x, origin.y);
      sprite!.classList.add('cursor-sprite--visible');

      const anchorTarget = () => ({
        x: s.pointerX + s.repulseX + SPRITE_OFFSET_X,
        y: s.pointerY + s.repulseY + SPRITE_OFFSET_Y,
      });

      await animateToPosition(
        () => ({ x: s.currentX, y: s.currentY }),
        setSpritePos,
        anchorTarget,
        EDGE_ENTER_MS
      );

      s.lifecycle = 'active';
      s.visible = true;
    }

    async function exitSprite() {
      if (s.lifecycle === 'hidden' || s.lifecycle === 'exiting') return;
      s.lifecycle = 'exiting';

      const target = getNearestEdgeTarget(s.currentX, s.currentY);
      await animateToPosition(
        () => ({ x: s.currentX, y: s.currentY }),
        setSpritePos,
        target,
        EDGE_EXIT_MS
      );

      s.lifecycle = 'hidden';
      s.visible = false;
      sprite!.classList.remove('cursor-sprite--visible');
    }

    async function enterTrail() {
      if (s.trailLifecycle === 'active' || s.trailLifecycle === 'entering') return;
      s.trailLifecycle = 'entering';

      const origin = getRandomEdgeOrigin();
      setTrailPos(origin.x, origin.y);
      trail!.classList.add('cursor-sprite--visible');

      const trailTarget = () => ({
        x: s.currentX + TRAIL_OFFSET_X,
        y: s.currentY + TRAIL_OFFSET_Y,
      });

      await animateTrailToPosition(
        () => ({ x: s.trailX, y: s.trailY }),
        setTrailPos,
        trailTarget,
        EDGE_ENTER_MS
      );

      s.trailLifecycle = 'active';
      s.trailVisible = true;
    }

    async function exitTrail() {
      if (s.trailLifecycle === 'hidden' || s.trailLifecycle === 'exiting') return;
      s.trailLifecycle = 'exiting';

      const target = getNearestEdgeTarget(s.trailX, s.trailY);
      await animateTrailToPosition(
        () => ({ x: s.trailX, y: s.trailY }),
        setTrailPos,
        target,
        EDGE_EXIT_MS
      );

      s.trailLifecycle = 'hidden';
      s.trailVisible = false;
      trail!.classList.remove('cursor-sprite--visible');
    }

    function updateVisibility() {
      const shouldShow = enabled && window.scrollY > SCROLL_THRESHOLD;
      if (shouldShow && !s.visible && s.lifecycle === 'hidden') {
        enterSprite();
      } else if (!shouldShow && s.visible) {
        exitSprite();
      }

      // Trail visibility depends on granite section + main sprite visible
      const trailShouldShow = shouldShow && s.graniteInView;
      if (trailShouldShow && !s.trailVisible && s.trailLifecycle === 'hidden') {
        enterTrail();
      } else if (!trailShouldShow && s.trailVisible) {
        exitTrail();
      }
    }

    function setSprite(id: string, scale: number) {
      if (id === s.activeSprite) return;
      s.activeSprite = id;
      s.activeScale = scale;
      img!.src = `${basePath}/images/sprites/${id}.svg`;
      img!.style.transform = scale === 1 ? '' : `scale(${scale})`;
    }

    function onPointerMove(e: PointerEvent) {
      const now = performance.now();
      const dt = Math.max((now - s.lastPointerTime) / 1000, 0.001);

      const vx = (e.clientX - s.lastPointerX) / dt;
      const vy = (e.clientY - s.lastPointerY) / dt;

      s.smoothVelX = damp(s.smoothVelX, vx, VELOCITY_SMOOTH);
      s.smoothVelY = damp(s.smoothVelY, vy, VELOCITY_SMOOTH);

      s.pointerX = e.clientX;
      s.pointerY = e.clientY;
      s.lastPointerX = e.clientX;
      s.lastPointerY = e.clientY;
      s.lastPointerTime = now;
    }

    function tick() {
      const now = performance.now();
      const dt = Math.min((now - s.lastFrameTime) / 1000, 0.05);
      s.lastFrameTime = now;

      if (s.lifecycle === 'active') {
        const speed = Math.hypot(s.smoothVelX, s.smoothVelY);

        if (speed > STILL_SPEED) {
          const dx = s.currentX - s.pointerX;
          const dy = s.currentY - s.pointerY;
          const dist = Math.hypot(dx, dy);

          let nx: number, ny: number;
          if (dist > 6) {
            nx = dx / dist;
            ny = dy / dist;
          } else {
            nx = -s.smoothVelX / speed;
            ny = -s.smoothVelY / speed;
          }

          const push = (speed - STILL_SPEED) * REPULSE_STRENGTH * dt;
          s.repulseX += nx * push;
          s.repulseY += ny * push;
        }

        const returnRate = Math.hypot(s.smoothVelX, s.smoothVelY) < STILL_SPEED ? REPULSE_RETURN_STILL : REPULSE_RETURN_MOVING;
        const returnStep = 1 - Math.pow(1 - returnRate, dt * 80);
        s.repulseX = damp(s.repulseX, 0, returnStep);
        s.repulseY = damp(s.repulseY, 0, returnStep);

        const repulseDist = Math.hypot(s.repulseX, s.repulseY);
        if (repulseDist > MAX_REPULSE) {
          const scale = MAX_REPULSE / repulseDist;
          s.repulseX *= scale;
          s.repulseY *= scale;
        }

        const targetX = s.pointerX + s.repulseX + SPRITE_OFFSET_X;
        const targetY = s.pointerY + s.repulseY + SPRITE_OFFSET_Y;

        s.currentX = damp(s.currentX, targetX, POSITION_DAMPING);
        s.currentY = damp(s.currentY, targetY, POSITION_DAMPING);

        sprite!.style.transform = `translate3d(${s.currentX}px, ${s.currentY}px, 0)`;
      }

      // Trail follows the main sprite with extra lag
      if (s.trailLifecycle === 'active') {
        const trailTargetX = s.currentX + TRAIL_OFFSET_X;
        const trailTargetY = s.currentY + TRAIL_OFFSET_Y;
        s.trailX = damp(s.trailX, trailTargetX, TRAIL_DAMPING);
        s.trailY = damp(s.trailY, trailTargetY, TRAIL_DAMPING);
        trail!.style.transform = `translate3d(${s.trailX}px, ${s.trailY}px, 0)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    // Hover triggers
    const cleanups: (() => void)[] = [];
    for (const trigger of HOVER_TRIGGERS) {
      const els = document.querySelectorAll(trigger.selector);
      for (const el of els) {
        const onEnter = () => setSprite(trigger.sprite, trigger.scale);
        const onLeave = () => setSprite('a', 1);
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          el.removeEventListener('pointerenter', onEnter);
          el.removeEventListener('pointerleave', onLeave);
        });
      }
    }

    // Granite section observer for trail
    const graniteSection = document.getElementById('granite-section');
    let graniteObserver: IntersectionObserver | null = null;
    if (graniteSection) {
      graniteObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            s.graniteInView = entry.isIntersecting;
            updateVisibility();
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
      );
      graniteObserver.observe(graniteSection);
    }

    updateVisibility();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', updateVisibility, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      animToken++;
      trailAnimToken++;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', updateVisibility);
      graniteObserver?.disconnect();
      for (const cleanup of cleanups) cleanup();
    };
  }, [mounted, enabled]);

  if (!mounted) return null;

  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return null;

  return (
    <>
      {/* Main cursor sprite follower */}
      <div ref={spriteRef} className="cursor-sprite" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          className="cursor-sprite__image"
          src={`${basePath}/images/sprites/a.svg`}
          alt=""
          draggable={false}
          width={46}
          height={39}
        />
      </div>

      {/* Trail sprite (Granite section) */}
      <div ref={trailRef} className="cursor-sprite cursor-sprite--trail" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="cursor-sprite__image cursor-sprite__image--trail"
          src={`${basePath}/images/sprites/g.svg`}
          alt=""
          draggable={false}
          width={40}
          height={40}
        />
      </div>

      {/* Toggle widget */}
      <div
        className={`cursor-toggle cursor-toggle--${enabled ? 'on' : 'off'}`}
        role="presentation"
      >
        <button
          type="button"
          className="cursor-toggle__button"
          aria-pressed={enabled}
          aria-label={enabled ? 'Turn custom cursor off' : 'Turn custom cursor on'}
          onClick={toggleEnabled}
        >
          <span className="cursor-toggle__icon-slot" aria-hidden="true">
            <Image
              className="cursor-toggle__icon cursor-toggle__icon--mel-on"
              src={`${basePath}/images/mel-on.svg`}
              alt=""
              width={38}
              height={32}
              unoptimized
            />
            <Image
              className="cursor-toggle__icon cursor-toggle__icon--mel-off"
              src={`${basePath}/images/mel-off.svg`}
              alt=""
              width={38}
              height={35}
              unoptimized
            />
          </span>

          <span className="cursor-toggle__switch" aria-hidden="true">
            <span className="cursor-toggle__track">
              <span className="cursor-toggle__label">{enabled ? 'HI!' : 'BYE'}</span>
              <span className="cursor-toggle__thumb"></span>
            </span>
          </span>
        </button>
      </div>
    </>
  );
}
