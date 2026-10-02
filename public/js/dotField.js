/**
 * Interactive dot grid with cursor bulge — optimized for low idle CPU use.
 */
const DEFAULT_OPTIONS = {
  dotRadius: 1.5,
  dotSpacing: 17,
  cursorRadius: 850,
  cursorForce: 0.66, // push strength for velocity-repulsion mode (bulgeOnly:false)
  bulgeOnly: true, // physics mode: spring bulge (default, lighter on CPU) or velocity repulsion
  bulgeStrength: 137,
  glowRadius: 60,
  showGlow: true,
  sparkle: false,
  waveAmplitude: 1,
  gradientFrom: "rgba(243, 246, 11, 0.55)",
  gradientTo: "rgba(22, 22, 22, 0.12)",
  glowColor: "#FAF8F5",
};

/** Cap draw rate — decorative background does not need 60fps. */
const TARGET_FRAME_MS = 1000 / 30;
/** Stop the loop after this long with no pointer engagement near the field. */
const IDLE_PAUSE_MS = 1200;

/**
 * @param {HTMLElement} mount
 * @param {Partial<typeof DEFAULT_OPTIONS>} options
 */
export function createDotField(mount, options = {}) {
  const props = { ...DEFAULT_OPTIONS, ...options };
  const propsRef = { current: { ...props } };

  const container = document.createElement("div");
  container.className = "dot-field";

  const canvas = document.createElement("canvas");
  canvas.className = "dot-field__canvas";
  canvas.setAttribute("aria-hidden", "true");

  let glowCircle = null;
  let glowStop0 = null;

  if (props.showGlow) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("dot-field__glow-svg");
    svg.setAttribute("aria-hidden", "true");

    const glowId = `dot-field-glow-${Math.random().toString(36).slice(2, 9)}`;
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const radialGradient = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "radialGradient"
    );
    radialGradient.setAttribute("id", glowId);

    glowStop0 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    glowStop0.setAttribute("offset", "0%");
    glowStop0.setAttribute("stop-color", props.glowColor);

    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "100%");
    stop1.setAttribute("stop-color", "transparent");

    radialGradient.append(glowStop0, stop1);
    defs.appendChild(radialGradient);

    glowCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    glowCircle.setAttribute("cx", "-9999");
    glowCircle.setAttribute("cy", "-9999");
    glowCircle.setAttribute("r", String(props.glowRadius));
    glowCircle.setAttribute("fill", `url(#${glowId})`);
    glowCircle.style.opacity = "0";

    svg.append(defs, glowCircle);
    container.append(svg, canvas);
  } else {
    container.appendChild(canvas);
  }

  mount.appendChild(container);

  const dotsRef = { current: [] };
  const mouseRef = {
    current: {
      x: -9999,
      y: -9999,
      clientX: -9999,
      clientY: -9999,
      prevX: -9999,
      prevY: -9999,
      speed: 0,
    },
  };
  const sizeRef = { current: { w: 0, h: 0 } };
  const glowOpacity = { current: 0 };
  const engagement = { current: 0 };

  let rafId = null;
  let resizeTimer = null;
  let speedInterval = null;
  let idleTimer = null;
  let frameCount = 0;
  let lastFrameTime = 0;
  let running = false;
  let isIdle = false;
  let isVisible = true;
  let isInView = true;
  let cachedGradient = null;

  const ctx = canvas.getContext("2d", { alpha: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function buildDots(w, h) {
    const p = propsRef.current;
    const step = p.dotRadius + p.dotSpacing;
    const cols = Math.floor(w / step);
    const rows = Math.floor(h / step);
    const padX = (w % step) / 2;
    const padY = (h % step) / 2;
    const dots = new Array(rows * cols);
    let idx = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const ax = padX + col * step + step / 2;
        const ay = padY + row * step + step / 2;
        dots[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
      }
    }
    dotsRef.current = dots;
  }

  function rebuildGradient(w, h) {
    const p = propsRef.current;
    cachedGradient = ctx.createLinearGradient(0, 0, w, h);
    cachedGradient.addColorStop(0, p.gradientFrom);
    cachedGradient.addColorStop(1, p.gradientTo);
  }

  function doResize() {
    const rect = mount.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    sizeRef.current = { w, h };
    buildDots(w, h);
    rebuildGradient(w, h);
    drawStaticFrame();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(doResize, 150);
  }

  function isPointerNearField(clientX, clientY) {
    const rect = mount.getBoundingClientRect();
    const margin = Math.min(propsRef.current.cursorRadius * 0.35, 240);
    return (
      clientX >= rect.left - margin &&
      clientX <= rect.right + margin &&
      clientY >= rect.top - margin &&
      clientY <= rect.bottom + margin
    );
  }

  function scheduleIdlePause() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (engagement.current > 0.01) return;
      const m = mouseRef.current;
      if (isPointerNearField(m.clientX, m.clientY)) return;
      enterIdle();
    }, IDLE_PAUSE_MS);
  }

  function enterIdle() {
    if (isIdle) return;
    isIdle = true;
    cancelAnimationFrame(rafId);
    rafId = null;
    drawStaticFrame();
  }

  function wake() {
    if (!running || !isVisible || !isInView || reducedMotion.matches) return;
    const wasIdle = isIdle;
    isIdle = false;
    clearTimeout(idleTimer);
    idleTimer = null;
    if (wasIdle && rafId === null) {
      lastFrameTime = 0;
      rafId = requestAnimationFrame(tick);
    }
  }

  function onMouseMove(event) {
    const rect = mount.getBoundingClientRect();
    const m = mouseRef.current;
    m.x = event.clientX - rect.left;
    m.y = event.clientY - rect.top;
    m.clientX = event.clientX;
    m.clientY = event.clientY;

    if (isIdle && isPointerNearField(event.clientX, event.clientY)) {
      wake();
    }
  }

  function updateMouseSpeed() {
    const m = mouseRef.current;
    const dx = m.prevX - m.x;
    const dy = m.prevY - m.y;
    const dist = Math.hypot(dx, dy);
    m.speed += (dist - m.speed) * 0.5;
    if (m.speed < 0.001) m.speed = 0;
    m.prevX = m.x;
    m.prevY = m.y;
  }

  function resetDotsToAnchor() {
    const dots = dotsRef.current;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      d.sx = d.ax;
      d.sy = d.ay;
      d.x = d.ax;
      d.y = d.ay;
      d.vx = 0;
      d.vy = 0;
    }
  }

  function drawStaticFrame() {
    const dots = dotsRef.current;
    const { w, h } = sizeRef.current;
    if (!w || !h || !dots.length) return;

    const p = propsRef.current;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = cachedGradient ?? p.gradientFrom;
    ctx.beginPath();

    const half = p.dotRadius / 2;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      ctx.rect(d.ax - half, d.ay - half, p.dotRadius, p.dotRadius);
    }

    ctx.fill();
  }

  function tick(timestamp) {
    if (!isVisible || !isInView) {
      enterIdle();
      return;
    }

    if (timestamp - lastFrameTime < TARGET_FRAME_MS) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastFrameTime = timestamp;

    frameCount += 1;
    const dots = dotsRef.current;
    const m = mouseRef.current;
    const { w, h } = sizeRef.current;
    const p = propsRef.current;
    const len = dots.length;

    const targetEngagement = Math.min(m.speed / 5, 1);
    // Ease toward target by a fraction each frame (smaller = slower/smoother).
    engagement.current += (targetEngagement - engagement.current) * 0.06;
    if (engagement.current < 0.001) engagement.current = 0;
    const eng = engagement.current;
    const isActive = eng > 0.01 && isPointerNearField(m.clientX, m.clientY);
    const t = frameCount * 0.02;
    const wave = isActive ? p.waveAmplitude : 0;

    if (!isActive) {
      scheduleIdlePause();
    } else {
      clearTimeout(idleTimer);
      idleTimer = null;
    }

    if (glowCircle) {
      glowOpacity.current += (eng - glowOpacity.current) * 0.08; // glow follows engagement
      glowCircle.setAttribute("cx", String(m.x));
      glowCircle.setAttribute("cy", String(m.y));
      glowCircle.style.opacity = String(glowOpacity.current);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = cachedGradient ?? p.gradientFrom;

    const cr = p.cursorRadius;
    const crSq = cr * cr;
    const isBulge = p.bulgeOnly;
    const half = p.dotRadius / 2;

    ctx.beginPath();

    for (let i = 0; i < len; i++) {
      const d = dots[i];

      if (isActive) {
        const dx = m.x - d.ax;
        const dy = m.y - d.ay;
        const distSq = dx * dx + dy * dy;

        if (distSq < crSq) {
          const dist = Math.sqrt(distSq);
          if (isBulge) {
            const factor = 1 - dist / cr;
            const push = factor * factor * p.bulgeStrength * eng;
            const angle = Math.atan2(dy, dx);
            d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15; // ease into the bulge
            d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
          } else {
            const angle = Math.atan2(dy, dx);
            const move = (500 / dist) * (m.speed * p.cursorForce);
            d.vx += Math.cos(angle) * -move;
            d.vy += Math.sin(angle) * -move;
          }
        } else if (isBulge) {
          d.sx += (d.ax - d.sx) * 0.1; // ease back to rest
          d.sy += (d.ay - d.sy) * 0.1;
        }

        if (!isBulge) {
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x = d.ax + d.vx;
          d.y = d.ay + d.vy;
          d.sx += (d.x - d.sx) * 0.1; // ease toward velocity-integrated position
          d.sy += (d.y - d.sy) * 0.1;
        }
      } else {
        d.sx = d.ax;
        d.sy = d.ay;
      }

      let drawX = d.sx;
      let drawY = d.sy;
      if (wave > 0) {
        drawY += Math.sin(d.ax * 0.03 + t) * wave;
        drawX += Math.cos(d.ay * 0.03 + t * 0.7) * wave * 0.5;
      }

      ctx.rect(drawX - half, drawY - half, p.dotRadius, p.dotRadius);
    }

    ctx.fill();
    rafId = requestAnimationFrame(tick);
  }

  const resizeObserver =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          if (running) doResize();
        })
      : null;

  const intersectionObserver =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            isInView = entries.some((entry) => entry.isIntersecting);
            if (!isInView) {
              enterIdle();
              return;
            }
            const m = mouseRef.current;
            if (isPointerNearField(m.clientX, m.clientY)) wake();
          },
          { root: null, threshold: 0.05 }
        )
      : null;

  function onVisibilityChange() {
    isVisible = document.visibilityState === "visible";
    if (!isVisible) {
      enterIdle();
      return;
    }
    const m = mouseRef.current;
    if (isPointerNearField(m.clientX, m.clientY)) wake();
  }

  function start() {
    if (running || reducedMotion.matches) return;
    running = true;
    isIdle = false;
    isVisible = document.visibilityState === "visible";
    doResize();
    resizeObserver?.observe(mount);
    intersectionObserver?.observe(mount);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    speedInterval = setInterval(updateMouseSpeed, 50);
    drawStaticFrame();
    enterIdle();
  }

  function stop() {
    if (!running) return;
    running = false;
    isIdle = false;
    cancelAnimationFrame(rafId);
    rafId = null;
    clearInterval(speedInterval);
    speedInterval = null;
    clearTimeout(resizeTimer);
    resizeTimer = null;
    clearTimeout(idleTimer);
    idleTimer = null;
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("mousemove", onMouseMove);
    resetDotsToAnchor();
    drawStaticFrame();
  }

  function destroy() {
    stop();
    reducedMotion.removeEventListener("change", handleMotionPreferenceChange);
    container.remove();
  }

  function handleMotionPreferenceChange() {
    if (reducedMotion.matches) stop();
    else start();
  }

  reducedMotion.addEventListener("change", handleMotionPreferenceChange);

  return {
    start,
    stop,
    destroy,
    updateOptions(next) {
      Object.assign(propsRef.current, next);
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) {
        buildDots(w, h);
        rebuildGradient(w, h);
        drawStaticFrame();
      }
      if (glowCircle) {
        glowCircle.setAttribute("r", String(propsRef.current.glowRadius));
      }
      if (glowStop0) {
        glowStop0.setAttribute("stop-color", propsRef.current.glowColor);
      }
    },
  };
}

/**
 * Mounts DotField in the hero section.
 */
export function initHeroDotField() {
  const mount = document.getElementById("hero-dot-field");
  if (!mount) return null;

  const field = createDotField(mount, {
    showGlow: false,
    dotSpacing: 22,
    gradientFrom: "#FDB602",
    gradientTo: "#A47600",
    waveAmplitude: 3,
    cursorRadius: 640,
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => field.start());
  });
  return field;
}
