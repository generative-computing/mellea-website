'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const DEFAULT_SPLIT = 0.44;

export default function MelleaCompare() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const stage = root.querySelector<HTMLElement>('.how-mellea__compare-stage');
    const frame = root.querySelector<HTMLElement>('[data-compare-frame]');
    const handle = root.querySelector<HTMLElement>('[data-compare-handle]');
    if (!stage || !frame || !handle) return;

    let isDragging = false;
    let activePointerId: number | null = null;

    function setSplit(ratio: number) {
      const clamped = Math.max(0, Math.min(1, ratio));
      root!.style.setProperty('--compare-split', String(clamped));
      handle!.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    }

    function ratioFromPointer(clientX: number) {
      const frameRect = frame!.getBoundingClientRect();
      if (clientX <= frameRect.left) return 0;
      if (clientX >= frameRect.right) return 1;
      return (clientX - frameRect.left) / frameRect.width;
    }

    function endDrag() {
      isDragging = false;
      activePointerId = null;
      stage!.classList.remove('is-dragging');
    }

    function moveTo(clientX: number) {
      setSplit(ratioFromPointer(clientX));
    }

    // Handle drag
    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      activePointerId = e.pointerId;
      stage!.classList.add('is-dragging');
      handle!.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      moveTo(e.clientX);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      handle!.releasePointerCapture(e.pointerId);
      endDrag();
    };

    const handlePointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      endDrag();
    };

    // Stage click-to-jump
    const stagePointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-compare-handle]')) return;
      isDragging = true;
      activePointerId = e.pointerId;
      stage!.classList.add('is-dragging');
      stage!.setPointerCapture(e.pointerId);
      moveTo(e.clientX);
      e.preventDefault();
    };

    const stagePointerMove = (e: PointerEvent) => {
      if (!isDragging || e.pointerId !== activePointerId) return;
      moveTo(e.clientX);
    };

    const stagePointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      stage!.releasePointerCapture(e.pointerId);
      endDrag();
    };

    const stagePointerCancel = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      endDrag();
    };

    // Keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      const current = parseFloat(root!.style.getPropertyValue('--compare-split') || String(DEFAULT_SPLIT));

      if (e.key === 'ArrowLeft') { e.preventDefault(); setSplit(current - step); }
      if (e.key === 'ArrowRight') { e.preventDefault(); setSplit(current + step); }
      if (e.key === 'Home') { e.preventDefault(); setSplit(0); }
      if (e.key === 'End') { e.preventDefault(); setSplit(1); }
    };

    handle.addEventListener('pointerdown', handlePointerDown);
    handle.addEventListener('pointermove', handlePointerMove);
    handle.addEventListener('pointerup', handlePointerUp);
    handle.addEventListener('pointercancel', handlePointerCancel);
    stage.addEventListener('pointerdown', stagePointerDown);
    stage.addEventListener('pointermove', stagePointerMove);
    stage.addEventListener('pointerup', stagePointerUp);
    stage.addEventListener('pointercancel', stagePointerCancel);
    handle.addEventListener('keydown', handleKeyDown);

    setSplit(DEFAULT_SPLIT);

    return () => {
      handle.removeEventListener('pointerdown', handlePointerDown);
      handle.removeEventListener('pointermove', handlePointerMove);
      handle.removeEventListener('pointerup', handlePointerUp);
      handle.removeEventListener('pointercancel', handlePointerCancel);
      stage.removeEventListener('pointerdown', stagePointerDown);
      stage.removeEventListener('pointermove', stagePointerMove);
      stage.removeEventListener('pointerup', stagePointerUp);
      stage.removeEventListener('pointercancel', stagePointerCancel);
      handle.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="how-mellea__compare" data-mellea-compare ref={rootRef}>
      <div className="how-mellea__compare-inner">
        <span className="how-mellea__compare-label how-mellea__compare-label--without">
          without mellea
        </span>
        <span className="how-mellea__compare-label how-mellea__compare-label--with">
          with mellea
        </span>

        <div className="how-mellea__compare-stage">
          <div className="how-mellea__compare-frame" data-compare-frame>
            <Image
              className="how-mellea__compare-image how-mellea__compare-image--with"
              src={`${basePath}/images/how-mellea-with.svg`}
              alt=""
              width={866}
              height={645}
              unoptimized
              priority
            />
            <div className="how-mellea__compare-clip">
              <Image
                className="how-mellea__compare-image how-mellea__compare-image--without"
                src={`${basePath}/images/how-mellea-without.svg`}
                alt=""
                width={866}
                height={645}
                unoptimized
              />
            </div>

            <div className="how-mellea__compare-divider" data-compare-divider>
              <button
                className="how-mellea__compare-handle"
                type="button"
                data-compare-handle
                role="slider"
                aria-label="Compare code without and with Mellea"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={44}
              >
                <Image
                  className="how-mellea__compare-handle-icon"
                  src={`${basePath}/images/how-mellea-slider-icon.svg`}
                  alt=""
                  width={24}
                  height={24}
                  unoptimized
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
