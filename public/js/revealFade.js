/**
 * Shared slide-up fade-in used by the hero subtitle (Web Animations API).
 */

const DEFAULT_DURATION_MS = 850;
const DEFAULT_OFFSET_Y = 28;

/**
 * @param {HTMLElement} el
 */
export function setFadePending(el) {
  el.classList.add("reveal-fade--pending");
}

/**
 * @param {HTMLElement} el
 * @param {{ duration?: number, y?: number, onComplete?: () => void }} [vars]
 * @returns {Animation}
 */
export function revealFadeIn(el, vars = {}) {
  el.classList.remove("reveal-fade--pending");

  const durationMs = (vars.duration ?? DEFAULT_DURATION_MS / 1000) * 1000;
  const offsetY = vars.y ?? DEFAULT_OFFSET_Y;

  const animation = el.animate(
    [
      { opacity: 0, transform: `translateY(${offsetY}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ],
    {
      duration: durationMs,
      easing: "cubic-bezier(0.33, 1, 0.68, 1)",
      fill: "forwards",
    }
  );

  animation.addEventListener(
    "finish",
    () => {
      el.style.opacity = "";
      el.style.transform = "";
      vars.onComplete?.();
    },
    { once: true }
  );

  return animation;
}

/**
 * @param {HTMLElement} el
 */
export function clearFadePending(el) {
  el.classList.remove("reveal-fade--pending");
  el.style.opacity = "";
  el.style.transform = "";
}
