/**
 * Interactive before/after slider for the How Mellea section.
 */

const DEFAULT_SPLIT = 0.44;
const MIN_SPLIT = 0;
const MAX_SPLIT = 1;

/**
 * @param {HTMLElement} root
 * @param {number} ratio
 */
function setSplit(root, ratio) {
  const clamped = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, ratio));
  root.style.setProperty("--compare-split", String(clamped));

  const handle = root.querySelector("[data-compare-handle]");
  if (handle) {
    handle.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
  }
}

/**
 * @param {HTMLElement} stage
 * @param {HTMLElement} frame
 * @param {number} clientX
 */
function ratioFromPointer(stage, frame, clientX) {
  const frameRect = frame.getBoundingClientRect();

  if (clientX <= frameRect.left) return 0;
  if (clientX >= frameRect.right) return 1;

  return (clientX - frameRect.left) / frameRect.width;
}

export function initMelleaCompare() {
  const root = document.querySelector("[data-mellea-compare]");
  if (!root) return;

  const stage = root.querySelector(".how-mellea__compare-stage");
  const frame = root.querySelector("[data-compare-frame]");
  const handle = root.querySelector("[data-compare-handle]");
  if (!stage || !frame || !handle) return;

  let isDragging = false;
  let activePointerId = null;

  const endDrag = () => {
    isDragging = false;
    activePointerId = null;
    stage.classList.remove("is-dragging");
  };

  const moveTo = (clientX) => {
    setSplit(root, ratioFromPointer(stage, frame, clientX));
  };

  handle.addEventListener("pointerdown", (event) => {
    isDragging = true;
    activePointerId = event.pointerId;
    stage.classList.add("is-dragging");
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!isDragging || event.pointerId !== activePointerId) return;
    moveTo(event.clientX);
  });

  handle.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId) return;
    handle.releasePointerCapture(event.pointerId);
    endDrag();
  });

  handle.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;
    endDrag();
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("[data-compare-handle]")) return;

    isDragging = true;
    activePointerId = event.pointerId;
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
    event.preventDefault();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!isDragging || event.pointerId !== activePointerId) return;
    moveTo(event.clientX);
  });

  stage.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId) return;
    stage.releasePointerCapture(event.pointerId);
    endDrag();
  });

  stage.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;
    endDrag();
  });

  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const current = Number.parseFloat(
      root.style.getPropertyValue("--compare-split") || String(DEFAULT_SPLIT)
    );

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSplit(root, current - step);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setSplit(root, current + step);
    }

    if (event.key === "Home") {
      event.preventDefault();
      setSplit(root, MIN_SPLIT);
    }

    if (event.key === "End") {
      event.preventDefault();
      setSplit(root, MAX_SPLIT);
    }
  });

  setSplit(root, DEFAULT_SPLIT);
}
