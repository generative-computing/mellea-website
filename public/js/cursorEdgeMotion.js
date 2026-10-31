/**
 * Off-screen edge targets for cursor follower enter / exit animations.
 */

const EDGES = ["top", "right", "bottom", "left"];
const OFFSCREEN_PAD = 72;

/**
 * @param {number} t
 */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * @param {number} x
 * @param {number} y
 */
export function getNearestEdgeTarget(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const distances = [
    { edge: "top", value: y },
    { edge: "right", value: w - x },
    { edge: "bottom", value: h - y },
    { edge: "left", value: x },
  ];

  distances.sort((a, b) => a.value - b.value);
  const edge = distances[0].edge;

  switch (edge) {
    case "top":
      return { x, y: -OFFSCREEN_PAD };
    case "right":
      return { x: w + OFFSCREEN_PAD, y };
    case "bottom":
      return { x, y: h + OFFSCREEN_PAD };
    default:
      return { x: -OFFSCREEN_PAD, y };
  }
}

/**
 * @param {() => { x: number, y: number }} [excludeNear]
 */
export function getRandomEdgeOrigin(excludeNear) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let edge = EDGES[Math.floor(Math.random() * EDGES.length)];

  if (excludeNear) {
    const { x, y } = excludeNear();
    const nearest = getNearestEdgeTarget(x, y);
    const nearTop = nearest.y < 0;
    const nearRight = nearest.x > w;
    const nearBottom = nearest.y > h;
    const nearLeft = nearest.x < 0;

    const avoid = [];
    if (nearTop) avoid.push("top");
    if (nearRight) avoid.push("right");
    if (nearBottom) avoid.push("bottom");
    if (nearLeft) avoid.push("left");

    const options = EDGES.filter((name) => !avoid.includes(name));
    if (options.length) {
      edge = options[Math.floor(Math.random() * options.length)];
    }
  }

  switch (edge) {
    case "top":
      return { x: Math.random() * w, y: -OFFSCREEN_PAD };
    case "right":
      return { x: w + OFFSCREEN_PAD, y: Math.random() * h };
    case "bottom":
      return { x: Math.random() * w, y: h + OFFSCREEN_PAD };
    default:
      return { x: -OFFSCREEN_PAD, y: Math.random() * h };
  }
}

/**
 * @param {() => { x: number, y: number }} getPosition
 * @param {(x: number, y: number) => void} setPosition
 * @param {{ x: number, y: number } | (() => { x: number, y: number })} to
 * @param {number} durationMs
 * @param {() => boolean} [isCancelled] Abort the loop when true (prevents a superseded animation fighting over setPosition).
 * @returns {Promise<void>}
 */
export function animatePosition(getPosition, setPosition, to, durationMs, isCancelled) {
  const from = getPosition();
  const resolveTarget =
    typeof to === "function" ? to : () => /** @type {{ x: number, y: number }} */ (to);
  const start = performance.now();

  return new Promise((resolve) => {
    function frame(now) {
      if (isCancelled?.()) {
        resolve();
        return;
      }

      const t = Math.min((now - start) / durationMs, 1);
      const eased = easeOutCubic(t);
      const target = resolveTarget();

      setPosition(
        from.x + (target.x - from.x) * eased,
        from.y + (target.y - from.y) * eased
      );

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

export const CURSOR_EXIT_MS = 520;
export const CURSOR_ENTER_MS = 620;
