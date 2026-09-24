/**
 * Types text once with an optional blinking cursor (no external animation libs).
 */

/**
 * Reserve wrapped height for a `.text-type` host so typing does not reflow layout.
 * @param {HTMLElement} textTypeEl
 * @param {string} fullText
 */
export function reserveTextTypeSpace(textTypeEl, fullText) {
  const host = textTypeEl.parentElement;
  if (!host || !fullText) return;

  host.classList.add("text-type-host");

  let sizer = host.querySelector(":scope > .text-type__sizer");
  if (!sizer) {
    sizer = document.createElement("span");
    sizer.className = "text-type__sizer";
    sizer.setAttribute("aria-hidden", "true");
    host.insertBefore(sizer, textTypeEl);
  }

  sizer.textContent = fullText;
}

/**
 * @param {HTMLElement} container Root `.text-type` element
 * @param {object} options
 * @param {string|string[]} options.text
 * @param {number} [options.typingSpeed=50]
 * @param {number} [options.initialDelay=0]
 * @param {number} [options.pauseDuration=2000]
 * @param {number} [options.deletingSpeed=30]
 * @param {boolean} [options.loop=true]
 * @param {boolean} [options.showCursor=true]
 * @param {string} [options.cursorCharacter='|']
 * @param {number} [options.cursorBlinkDuration=0.5]
 * @param {(sentence: string, index: number) => void} [options.onSentenceComplete]
 * @param {() => void} [options.onComplete] Fired when typing finishes and loop is false
 * @returns {{ destroy: () => void, complete: (fullText: string) => void }}
 */
export function createTextType(container, options = {}) {
  const {
    text,
    typingSpeed = 50,
    initialDelay = 0,
    pauseDuration = 2000,
    deletingSpeed = 30,
    loop = true,
    showCursor = true,
    cursorCharacter = "|",
    cursorBlinkDuration = 0.5,
    onSentenceComplete,
    onComplete,
  } = options;

  const textArray = Array.isArray(text) ? text : [text];
  const contentEl = container.querySelector(".text-type__content");
  const cursorEl = container.querySelector(".text-type__cursor");

  if (!contentEl) {
    throw new Error("createTextType: missing .text-type__content element");
  }

  if (showCursor && cursorEl) {
    cursorEl.textContent = cursorCharacter;
    cursorEl.classList.remove("text-type__cursor--hidden");
    cursorEl.style.animationDuration = `${cursorBlinkDuration}s`;
    cursorEl.classList.add("text-type__cursor--blink");
  }

  let displayedText = "";
  let currentCharIndex = 0;
  let currentTextIndex = 0;
  let isDeleting = false;
  let timeoutId = null;
  let destroyed = false;

  const clearTimer = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const hideCursor = () => {
    if (!cursorEl) return;
    cursorEl.classList.remove("text-type__cursor--blink");
    cursorEl.style.animationDuration = "";
    cursorEl.classList.add("text-type__cursor--hidden");
  };

  const finishAll = () => {
    hideCursor();
    onComplete?.();
  };

  const schedule = (fn, delay) => {
    clearTimer();
    timeoutId = setTimeout(fn, delay);
  };

  const tick = () => {
    if (destroyed) return;

    const currentText = textArray[currentTextIndex];

    if (isDeleting) {
      if (displayedText === "") {
        isDeleting = false;

        if (onSentenceComplete) {
          onSentenceComplete(textArray[currentTextIndex], currentTextIndex);
        }

        if (currentTextIndex === textArray.length - 1 && !loop) {
          finishAll();
          return;
        }

        currentTextIndex = (currentTextIndex + 1) % textArray.length;
        currentCharIndex = 0;
        schedule(tick, pauseDuration);
      } else {
        schedule(() => {
          displayedText = displayedText.slice(0, -1);
          contentEl.textContent = displayedText;
          tick();
        }, deletingSpeed);
      }
      return;
    }

    if (currentCharIndex < currentText.length) {
      schedule(() => {
        displayedText += currentText[currentCharIndex];
        contentEl.textContent = displayedText;
        currentCharIndex += 1;
        tick();
      }, typingSpeed);
      return;
    }

    if (!loop && currentTextIndex === textArray.length - 1) {
      finishAll();
      return;
    }

    schedule(() => {
      isDeleting = true;
      tick();
    }, pauseDuration);
  };

  schedule(tick, initialDelay);

  return {
    destroy() {
      destroyed = true;
      clearTimer();
      hideCursor();
    },
    /** Immediately show full text (skip animation). */
    complete(fullText) {
      destroyed = true;
      clearTimer();
      contentEl.textContent = fullText;
      hideCursor();
    },
  };
}
