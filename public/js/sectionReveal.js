/**
 * Section headings and body copy render immediately (no scroll-triggered reveals).
 */
import { reserveTextTypeSpace } from "./textType.js";
import { clearFadePending } from "./revealFade.js";

const SECTION_CONFIG = [
  {
    sectionSelector: "#how-mellea-section",
    headingSelector: "#how-mellea-heading .text-type",
    bodySelector: ".how-mellea__text",
    cardSelector: ".how-mellea__cards .feature-card",
  },
  {
    sectionSelector: "#granite-section",
    headingSelector: "#granite-heading .text-type",
    bodySelector: ".granite__intro > .granite__lead",
  },
  {
    sectionSelector: "#site-footer",
    headingSelector: "#footer-heading .text-type",
    bodySelector: ".site-footer__subtitle",
    cardSelector: ".site-footer__actions",
  },
  {
    sectionSelector: "#blog-section",
    cardSelector: ".blog-card",
  },
];

/**
 * @param {HTMLElement} textTypeEl
 */
function getHeadingText(textTypeEl) {
  return (
    textTypeEl.dataset.text?.trim() ||
    textTypeEl.closest("h1, h2")?.getAttribute("aria-label")?.trim() ||
    ""
  );
}

/**
 * @param {HTMLElement} textTypeEl
 * @param {string} fullText
 */
function showStaticHeading(textTypeEl, fullText) {
  const content = textTypeEl.querySelector(".text-type__content");
  if (content) content.textContent = fullText;
  textTypeEl.querySelector(".text-type__cursor")?.classList.add(
    "text-type__cursor--hidden"
  );
}

/**
 * @param {(typeof SECTION_CONFIG)[number]} config
 */
function showSectionStatic(config) {
  const section = document.querySelector(config.sectionSelector);
  if (!section) return;

  const textTypeEl = config.headingSelector
    ? section.querySelector(config.headingSelector)
    : null;
  const body = config.bodySelector
    ? section.querySelector(config.bodySelector)
    : null;
  const cards = config.cardSelector
    ? [...section.querySelectorAll(config.cardSelector)]
    : [];

  if (textTypeEl) {
    const fullText = getHeadingText(textTypeEl);
    reserveTextTypeSpace(textTypeEl, fullText);
    showStaticHeading(textTypeEl, fullText);
  }

  if (body) clearFadePending(body);
  cards.forEach(clearFadePending);
  section.dataset.revealed = "true";
}

export function initSectionReveal() {
  SECTION_CONFIG.forEach(showSectionStatic);
}
