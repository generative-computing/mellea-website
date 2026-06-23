'use client';

import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

interface TypewriterTextProps {
  text: string;
  typingSpeed?: number;
  className?: string;
  triggerOnScroll?: boolean;
  threshold?: number;
  onComplete?: () => void;
}

export default function TypewriterText({
  text,
  typingSpeed = 80,
  className = '',
  triggerOnScroll = false,
  threshold = 0.18,
  onComplete,
}: TypewriterTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const hasStarted = useRef(false);

  const startTyping = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const contentEl = contentRef.current;
    const cursorEl = cursorRef.current;
    if (!contentEl) return;

    if (cursorEl) {
      cursorEl.textContent = '|';
      gsap.to(cursorEl, {
        opacity: 0,
        duration: 0.9,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      });
    }

    let charIndex = 0;
    contentEl.textContent = '';

    const tick = () => {
      if (charIndex < text.length) {
        contentEl.textContent += text[charIndex];
        charIndex++;
        setTimeout(tick, 1000 / typingSpeed);
      } else {
        if (cursorEl) {
          gsap.killTweensOf(cursorEl);
          cursorEl.classList.add('text-type__cursor--hidden');
        }
        onComplete?.();
      }
    };

    tick();
  }, [text, typingSpeed, onComplete]);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      if (contentRef.current) contentRef.current.textContent = text;
      if (cursorRef.current) cursorRef.current.classList.add('text-type__cursor--hidden');
      onComplete?.();
      return;
    }

    if (!triggerOnScroll) {
      startTyping();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            startTyping();
          }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [text, triggerOnScroll, threshold, startTyping, onComplete]);

  return (
    <span className={`text-type-host ${className}`} ref={containerRef}>
      <span className="text-type__sizer" aria-hidden="true">
        {text}
      </span>
      <span className="text-type">
        <span className="text-type__content" ref={contentRef}></span>
        <span className="text-type__cursor" ref={cursorRef} aria-hidden="true"></span>
      </span>
    </span>
  );
}
