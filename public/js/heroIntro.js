/**
 * Hero headline type effect on each page load; subtitle slide-up fade-in after typing.
 */
import { createTextType } from "./textType.js";
import { clearFadePending, revealFadeIn, setFadePending } from "./revealFade.js";

const TITLE_SELECTOR = "#hero-title-type";
const SUBTITLE_SELECTOR = "#hero-subtitle";

/**
 * @param {string} fullText
 */
function showStaticHero(fullText) {
  const container = document.querySelector(TITLE_SELECTOR);
  const subtitle = document.querySelector(SUBTITLE_SELECTOR);
  if (!container) return;

  const content = container.querySelector(".text-type__content");
  if (content) content.textContent = fullText;

  container.querySelector(".text-type__cursor")?.classList.add(
    "text-type__cursor--hidden"
  );

  if (subtitle) {
    subtitle.classList.remove("hero__subtitle--pending");
    clearFadePending(subtitle);
  }
}

/**
 * @param {HTMLElement} subtitle
 */
function revealSubtitle(subtitle) {
  subtitle.classList.remove("hero__subtitle--pending");
  revealFadeIn(subtitle);
}

export function initHeroIntro() {
  const container = document.querySelector(TITLE_SELECTOR);
  const subtitle = document.querySelector(SUBTITLE_SELECTOR);
  if (!container || !subtitle) return;

  const fullText =
    container.dataset.text?.trim() ||
    container.closest(".hero__title")?.getAttribute("aria-label")?.trim() ||
    "";

  if (!fullText) return;

  const content = container.querySelector(".text-type__content");
  const cursor = container.querySelector(".text-type__cursor");

  content.textContent = "";
  cursor?.classList.remove("text-type__cursor--hidden");
  subtitle.classList.add("hero__subtitle--pending");
  setFadePending(subtitle);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showStaticHero(fullText);
    return;
  }

  createTextType(container, {
    text: fullText,
    typingSpeed: 80,
    initialDelay: 0,
    loop: false,
    showCursor: true,
    cursorCharacter: "|",
    cursorBlinkDuration: 0.9,
    onComplete: () => revealSubtitle(subtitle),
  });
}
