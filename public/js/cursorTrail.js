/**
 * Delayed trail cursor (g.svg) shown while a target section is in the viewport.
 */
import {
  animatePosition,
  CURSOR_ENTER_MS,
  CURSOR_EXIT_MS,
  getNearestEdgeTarget,
  getRandomEdgeOrigin,
} from "./cursorEdgeMotion.js";
import { damp } from "./motionUtils.js";

const DEFAULT_TRAIL_MOTION = {
  positionDamping: 0.028,
  offsetX: 32,
  offsetY: 40,
};

/**
 * @param {object} options
 * @param {string} options.src
 * @param {string} options.sectionSelector
 * @param {() => { x: number, y: number }} options.getFollowTarget
 * @param {object} [options.motion]
 * @param {() => void} [options.onSectionChange]
 * @returns {{ start: Function, stop: Function, destroy: Function, setEnabled: Function, syncVisibility: Function }}
 */
export function createCursorTrail(options) {
  const {
    src,
    sectionSelector,
    getFollowTarget,
    motion: motionConfig = {},
    onSectionChange,
  } = options;

  const motion = { ...DEFAULT_TRAIL_MOTION, ...motionConfig };

  const container = document.createElement("div");
  container.id = "cursor-sprite-trail";
  container.className = "cursor-sprite cursor-sprite--trail";
  container.setAttribute("aria-hidden", "true");

  const imageEl = document.createElement("img");
  imageEl.className = "cursor-sprite__image cursor-sprite__image--trail";
  imageEl.src = src;
  imageEl.alt = "";
  imageEl.draggable = false;
  container.appendChild(imageEl);
  document.body.prepend(container);

  let currentX = window.innerWidth / 2;
  let currentY = window.innerHeight / 2;
  let rafId = null;
  let started = false;
  let sectionActive = false;
  let enabled = true;
  let visible = false;
  /** @type {"hidden" | "active" | "exiting" | "entering"} */
  let lifecycle = "hidden";
  let animToken = 0;
  let following = false;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function getOffsetTarget() {
    const anchor = getFollowTarget();
    return {
      x: anchor.x + (motion.offsetX ?? 0),
      y: anchor.y + (motion.offsetY ?? 0),
    };
  }

  function setPosition(x, y) {
    currentX = x;
    currentY = y;
    container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
  }

  function getPosition() {
    return { x: currentX, y: currentY };
  }

  function tick() {
    if (!following) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const target = getOffsetTarget();
    currentX = damp(currentX, target.x, motion.positionDamping);
    currentY = damp(currentY, target.y, motion.positionDamping);
    container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    rafId = requestAnimationFrame(tick);
  }

  function startFollowing() {
    following = true;
    if (rafId === null) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function stopFollowing() {
    following = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setVisibleInstant(shouldShow) {
    lifecycle = shouldShow ? "active" : "hidden";
    visible = shouldShow;
    container.classList.toggle("cursor-sprite--visible", shouldShow);

    if (shouldShow) {
      const anchor = getOffsetTarget();
      setPosition(anchor.x, anchor.y);
      startFollowing();
    } else {
      stopFollowing();
    }
  }

  async function runExit(token) {
    lifecycle = "exiting";
    stopFollowing();

    const pos = getPosition();
    const target = getNearestEdgeTarget(pos.x, pos.y);

    await animatePosition(getPosition, setPosition, target, CURSOR_EXIT_MS, () => token !== animToken);

    if (token !== animToken) return;

    lifecycle = "hidden";
    visible = false;
    container.classList.remove("cursor-sprite--visible");
    setPosition(target.x, target.y);
  }

  async function runEnter(token) {
    lifecycle = "entering";
    stopFollowing();

    const origin = getRandomEdgeOrigin(getPosition);
    setPosition(origin.x, origin.y);
    container.classList.add("cursor-sprite--visible");

    await animatePosition(getPosition, setPosition, () => getOffsetTarget(), CURSOR_ENTER_MS, () => token !== animToken);

    if (token !== animToken) return;

    lifecycle = "active";
    visible = true;
    startFollowing();
  }

  function syncVisibility(primaryVisible) {
    const shouldShow =
      enabled && !reducedMotion.matches && sectionActive && primaryVisible;

    if (reducedMotion.matches) {
      if (shouldShow === visible && lifecycle === (shouldShow ? "active" : "hidden")) {
        return;
      }
      setVisibleInstant(shouldShow);
      return;
    }

    if (shouldShow) {
      if (lifecycle === "active" || lifecycle === "entering") return;
      const token = ++animToken;
      runEnter(token);
      return;
    }

    if (lifecycle === "hidden" || lifecycle === "exiting") return;

    const token = ++animToken;
    runExit(token);
  }

  function setSectionActive(isActive) {
    sectionActive = isActive;
    onSectionChange?.();
  }

  function setEnabled(isEnabled) {
    enabled = isEnabled;
  }

  let observer = null;

  function bindSectionObserver() {
    const section = document.querySelector(sectionSelector);
    if (!section) return;

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setSectionActive(entry.isIntersecting);
        });
      },
      { threshold: 0.15, rootMargin: "-15% 0px -10% 0px" }
    );

    observer.observe(section);
  }

  function start() {
    if (started) return;
    started = true;
    bindSectionObserver();
  }

  function stop() {
    if (!started) return;
    started = false;
    animToken += 1;
    lifecycle = "hidden";
    stopFollowing();
    observer?.disconnect();
    observer = null;
    visible = false;
    container.classList.remove("cursor-sprite--visible");
  }

  function destroy() {
    stop();
    container.remove();
  }

  return {
    start,
    stop,
    destroy,
    setEnabled,
    setSectionActive,
    syncVisibility,
  };
}
