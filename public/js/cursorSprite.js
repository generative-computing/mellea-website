/**
 * Config-driven cursor sprite module.
 * Renders SVG sprites with damped pointer tracking, fixed offset from the cursor,
 * and event-based sprite switching (hover, scroll scaffold).
 */
import {
  animatePosition,
  CURSOR_ENTER_MS,
  CURSOR_EXIT_MS,
  getNearestEdgeTarget,
  getRandomEdgeOrigin,
} from "./cursorEdgeMotion.js";
import { damp } from "./motionUtils.js";

const DEFAULT_MOTION = {
  positionDamping: 0.14,
  offsetX: 28,
  offsetY: 32,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getScrollProgress() {
  const maxScroll =
    document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return 0;
  return clamp(window.scrollY / maxScroll, 0, 1);
}

/**
 * Maps sprite ids to src URLs and swaps the active image.
 */
function createSpriteRegistry(sprites, imageEl) {
  const byId = new Map(sprites.map((sprite) => [sprite.id, sprite]));
  let activeId = null;

  function preload() {
    return Promise.all(
      [...byId.values()].map(
        (sprite) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(sprite.src);
            img.onerror = () =>
              reject(new Error(`Failed to preload ${sprite.src}`));
            img.src = sprite.src;
          })
      )
    );
  }

  function applySpritePresentation(sprite) {
    const scale = sprite.scale ?? 1;
    imageEl.dataset.sprite = sprite.id;
    imageEl.style.transform = scale === 1 ? "" : `scale(${scale})`;
  }

  function setActive(id) {
    if (!byId.has(id) || id === activeId) return false;

    const sprite = byId.get(id);
    activeId = id;
    imageEl.classList.add("cursor-sprite__image--changing");
    imageEl.src = sprite.src;
    applySpritePresentation(sprite);

    window.requestAnimationFrame(() => {
      imageEl.classList.remove("cursor-sprite__image--changing");
    });

    return true;
  }

  return { preload, setActive, getActiveId: () => activeId };
}

/**
 * Resolves active sprite from trigger priority and active state.
 */
function createTriggerManager(config, registry) {
  const { defaultSprite, triggers = [] } = config;
  const activeTriggers = new Set(["default"]);
  const hoverCleanups = [];
  let initialized = false;

  const triggerById = new Map(triggers.map((trigger) => [trigger.id, trigger]));

  function resolveActiveSprite() {
    let winner = null;

    for (const trigger of triggers) {
      if (trigger.type === "default") continue;
      if (!activeTriggers.has(trigger.id)) continue;

      if (!winner || trigger.priority > winner.priority) {
        winner = trigger;
      }
    }

    const spriteId = winner ? winner.sprite : defaultSprite;
    registry.setActive(spriteId);
  }

  function setTriggerActive(id, isActive) {
    if (isActive) activeTriggers.add(id);
    else activeTriggers.delete(id);
    resolveActiveSprite();
  }

  function evaluateScrollTriggers(progress) {
    for (const trigger of triggers) {
      if (trigger.type !== "scroll") continue;

      const from = trigger.from ?? 0;
      const to = trigger.to ?? 1;
      const inRange = progress >= from && progress < to;

      if (inRange) activeTriggers.add(trigger.id);
      else activeTriggers.delete(trigger.id);
    }

    resolveActiveSprite();
  }

  function bindHoverTriggers() {
    for (const trigger of triggers) {
      if (trigger.type !== "hover") continue;

      const elements = document.querySelectorAll(trigger.selector);
      for (const element of elements) {
        const onEnter = () => setTriggerActive(trigger.id, true);
        const onLeave = () => setTriggerActive(trigger.id, false);

        element.addEventListener("pointerenter", onEnter);
        element.addEventListener("pointerleave", onLeave);

        hoverCleanups.push(() => {
          element.removeEventListener("pointerenter", onEnter);
          element.removeEventListener("pointerleave", onLeave);
        });
      }
    }
  }

  function unbindHoverTriggers() {
    for (const cleanup of hoverCleanups) cleanup();
    hoverCleanups.length = 0;
  }

  function init() {
    if (initialized) {
      resolveActiveSprite();
      return;
    }

    initialized = true;
    if (triggerById.has("default")) {
      activeTriggers.add("default");
    }
    bindHoverTriggers();
    resolveActiveSprite();
  }

  function destroy() {
    unbindHoverTriggers();
    activeTriggers.clear();
    initialized = false;
  }

  return {
    init,
    destroy,
    evaluateScrollTriggers,
    setTriggerActive,
    resolveActiveSprite,
  };
}

/**
 * Pointer follow with lag and a fixed offset so the sprite stays near the cursor
 * without covering the click/scroll point.
 */
function createMotionEngine(container, motionConfig) {
  const motion = { ...DEFAULT_MOTION, ...motionConfig };

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let currentX = pointerX + motion.offsetX;
  let currentY = pointerY + motion.offsetY;

  let rafId = null;
  let onFrame = null;
  let following = true;

  function getFollowTarget() {
    return {
      x: pointerX + motion.offsetX,
      y: pointerY + motion.offsetY,
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

  function setFollowing(isFollowing) {
    following = isFollowing;
  }

  function onPointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
  }

  function tick() {
    if (following) {
      const target = getFollowTarget();
      currentX = damp(currentX, target.x, motion.positionDamping);
      currentY = damp(currentY, target.y, motion.positionDamping);
      container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }

    if (onFrame) onFrame();

    rafId = requestAnimationFrame(tick);
  }

  /**
   * @param {((dt: number) => void) | null} [frameCallback]
   * @param {{ preservePosition?: boolean }} [options]
   */
  function start(frameCallback, options = {}) {
    onFrame = frameCallback ?? null;

    if (!options.preservePosition) {
      const target = getFollowTarget();
      currentX = target.x;
      currentY = target.y;
      container.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener("pointermove", onPointerMove);
    onFrame = null;
  }

  return {
    start,
    stop,
    setPosition,
    getPosition,
    getFollowTarget,
    setFollowing,
    getAnchorPosition: getPosition,
  };
}

/**
 * Creates and mounts a cursor sprite instance.
 * @param {object} config
 * @returns {{ start: Function, stop: Function, destroy: Function }}
 */
export function createCursorSprite(config) {
  const mount =
    config.mount ?? document.getElementById("cursor-sprite") ?? document.body;

  let container = mount;
  let imageEl = mount.querySelector(".cursor-sprite__image");
  let createdContainer = false;

  if (!imageEl) {
    if (mount === document.body || !mount.classList.contains("cursor-sprite")) {
      container = document.createElement("div");
      container.id = "cursor-sprite";
      container.className = "cursor-sprite";
      container.setAttribute("aria-hidden", "true");
      document.body.prepend(container);
      createdContainer = true;
    }

    imageEl = document.createElement("img");
    imageEl.className = "cursor-sprite__image";
    imageEl.alt = "";
    imageEl.draggable = false;
    container.appendChild(imageEl);
  }

  const registry = createSpriteRegistry(config.sprites, imageEl);
  const triggers = createTriggerManager(config, registry);
  const motion = createMotionEngine(container, config.motion);

  // Only wire up scroll/resize listeners if the config actually defines a
  // scroll trigger — otherwise onScroll would run on every scroll for nothing.
  const hasScrollTriggers = (config.triggers ?? []).some(
    (trigger) => trigger.type === "scroll"
  );

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let started = false;
  let listenersBound = false;
  let motionRunning = false;
  /** @type {"hidden" | "active" | "exiting" | "entering"} */
  let lifecycle = "hidden";
  let animToken = 0;

  function syncMotion() {
    if (!started || reducedMotion.matches) return;

    if (lifecycle === "active" && !motionRunning) {
      motion.start(null, { preservePosition: true });
      motionRunning = true;
    } else if (lifecycle !== "active" && motionRunning) {
      motion.stop();
      motionRunning = false;
    }
  }

  function setVisibleInstant(isVisible) {
    lifecycle = isVisible ? "active" : "hidden";
    container.classList.toggle("cursor-sprite--visible", isVisible);

    if (isVisible) {
      const target = motion.getFollowTarget();
      motion.setPosition(target.x, target.y);
      motion.setFollowing(true);
    } else {
      motion.setFollowing(false);
    }

    syncMotion();
  }

  async function runExit(token) {
    lifecycle = "exiting";
    motion.setFollowing(false);
    motion.stop();
    motionRunning = false;

    const pos = motion.getPosition();
    const target = getNearestEdgeTarget(pos.x, pos.y);

    await animatePosition(
      () => motion.getPosition(),
      (x, y) => motion.setPosition(x, y),
      target,
      CURSOR_EXIT_MS,
      () => token !== animToken
    );

    if (token !== animToken) return;

    lifecycle = "hidden";
    container.classList.remove("cursor-sprite--visible");
    motion.setPosition(target.x, target.y);
  }

  async function runEnter(token) {
    lifecycle = "entering";
    motion.setFollowing(false);
    motion.stop();
    motionRunning = false;

    const origin = getRandomEdgeOrigin(() => motion.getPosition());
    motion.setPosition(origin.x, origin.y);
    container.classList.add("cursor-sprite--visible");

    await animatePosition(
      () => motion.getPosition(),
      (x, y) => motion.setPosition(x, y),
      () => motion.getFollowTarget(),
      CURSOR_ENTER_MS,
      () => token !== animToken
    );

    if (token !== animToken) return;

    lifecycle = "active";
    motion.setFollowing(true);
    syncMotion();
  }

  function setVisible(isVisible) {
    const wantVisible = Boolean(isVisible);

    if (reducedMotion.matches) {
      setVisibleInstant(wantVisible);
      return;
    }

    if (wantVisible) {
      if (lifecycle === "active" || lifecycle === "entering") return;

      // Bumping animToken cancels any in-flight exit before we enter.
      const token = ++animToken;
      runEnter(token);
      return;
    }

    if (lifecycle === "hidden" || lifecycle === "exiting") return;

    const token = ++animToken;
    runExit(token);
  }

  function onScroll() {
    triggers.evaluateScrollTriggers(getScrollProgress());
  }

  function onMotionPreferenceChange() {
    if (reducedMotion.matches) stop();
    else start();
  }

  function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;
    reducedMotion.addEventListener("change", onMotionPreferenceChange);
  }

  function start() {
    bindGlobalListeners();
    if (started || reducedMotion.matches) return;

    registry
      .preload()
      .then(() => {
        if (!started || reducedMotion.matches) return;
        triggers.init();
        if (hasScrollTriggers) onScroll();
        syncMotion();
      })
      .catch(() => {
        if (!started || reducedMotion.matches) return;
        triggers.init();
        if (hasScrollTriggers) onScroll();
        syncMotion();
      });

    if (hasScrollTriggers) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
    }

    started = true;
  }

  function stop() {
    if (!started) return;

    motion.stop();
    motionRunning = false;
    if (hasScrollTriggers) {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    }
    started = false;
  }

  function destroy() {
    stop();
    triggers.destroy();

    if (listenersBound) {
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      listenersBound = false;
    }

    if (createdContainer) {
      container.remove();
    } else if (imageEl.parentElement === container) {
      imageEl.remove();
    }
  }

  return {
    start,
    stop,
    destroy,
    setVisible,
    getAnchorPosition: () => motion.getAnchorPosition(),
  };
}
