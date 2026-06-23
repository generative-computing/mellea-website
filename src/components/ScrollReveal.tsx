'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  duration?: number;
  y?: number;
  threshold?: number;
  delay?: number;
}

export default function ScrollReveal({
  children,
  className = '',
  stagger = 0,
  duration = 0.85,
  y = 28,
  threshold = 0.18,
  delay = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      return;
    }

    gsap.set(el, { opacity: 0, y });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.disconnect();

            if (stagger > 0) {
              gsap.set(el, { opacity: 1, y: 0 });
              const items = el.children;
              gsap.fromTo(
                items,
                { opacity: 0, y: 24 },
                { opacity: 1, y: 0, duration, ease: 'power2.out', stagger, delay }
              );
            } else {
              gsap.to(el, { opacity: 1, y: 0, duration, ease: 'power2.out', delay });
            }
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [stagger, duration, y, threshold, delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
