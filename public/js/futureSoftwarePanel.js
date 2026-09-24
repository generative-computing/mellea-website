/**
 * "Here's the future of software" tabbed code panel (mellea.ai-style).
 */
import { copyText } from "./clipboard.js";

const COPY_RESET_MS = 2000;

const PANELS = [
  { id: "generative", copyTarget: "#future-code-generative" },
  { id: "instruct", copyTarget: "#future-code-instruct" },
  { id: "safety", copyTarget: "#future-code-safety" },
];

/**
 * @param {HTMLElement} root
 */
function setActivePanel(root, panelId) {
  const tabs = root.querySelectorAll(".future-panel__tab");
  const codes = root.querySelectorAll(".future-panel__code");

  tabs.forEach((tab) => {
    const isActive = tab.dataset.panel === panelId;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  codes.forEach((code) => {
    const isActive = code.id === `future-code-${panelId}`;
    code.classList.toggle("is-active", isActive);
  });

  const copyBtn = root.querySelector("[data-future-copy]");
  const panel = PANELS.find((item) => item.id === panelId);
  if (copyBtn && panel) {
    copyBtn.setAttribute("data-future-copy", panel.copyTarget);
  }
}

/**
 * @param {HTMLElement} button
 * @param {string} selector
 */
async function handleCodeCopy(button, selector) {
  const block = document.querySelector(selector);
  if (!block) return;

  const label = button.querySelector(".future-panel__copy-label");
  const icon = button.querySelector(".future-panel__copy-icon");
  const defaultLabel = "Copy code to clipboard";

  try {
    await copyText(block.textContent?.trim() ?? "");

    if (label) {
      label.hidden = false;
      label.textContent = "Copied!";
    }
    if (icon) icon.hidden = true;

    button.classList.add("future-panel__copy--copied");
    button.setAttribute("aria-label", "Copied to clipboard");

    window.setTimeout(() => {
      if (label) label.hidden = true;
      if (icon) icon.hidden = false;
      button.classList.remove("future-panel__copy--copied");
      button.setAttribute("aria-label", defaultLabel);
    }, COPY_RESET_MS);
  } catch {
    if (label) {
      label.hidden = false;
      label.textContent = "Copy failed";
    }
    if (icon) icon.hidden = true;

    window.setTimeout(() => {
      if (label) label.hidden = true;
      if (icon) icon.hidden = false;
      button.classList.remove("future-panel__copy--copied");
      button.setAttribute("aria-label", defaultLabel);
    }, COPY_RESET_MS);
  }
}

export function initFutureSoftwarePanel() {
  const root = document.querySelector("[data-future-panel]");
  if (!root) return;

  const tablist = root.querySelector(".future-panel__nav");
  if (!tablist) return;

  tablist.addEventListener("click", (event) => {
    // Let the "Learn more" link navigate without also switching the tab.
    if (event.target.closest(".future-panel__learn-more")) return;

    const tab = /** @type {HTMLElement | null} */ (
      event.target.closest(".future-panel__tab")
    );
    if (!tab || !tablist.contains(tab)) return;

    const panelId = tab.dataset.panel;
    if (!panelId) return;

    setActivePanel(root, panelId);
  });

  tablist.addEventListener("keydown", (event) => {
    // Let the "Learn more" link handle its own keys (Enter navigates) rather
    // than swallowing them to re-activate the tab.
    if (event.target.closest(".future-panel__learn-more")) return;

    const tabs = [...root.querySelectorAll(".future-panel__tab")];

    // Enter/Space activate the focused tab. A <div role="tab"> — unlike a
    // <button> — does not synthesize a click on these keys, so wire it here.
    if (event.key === "Enter" || event.key === " ") {
      const focusedTab = /** @type {HTMLElement | null} */ (
        event.target.closest(".future-panel__tab")
      );
      if (!focusedTab || !tablist.contains(focusedTab)) return;
      const panelId = focusedTab.dataset.panel;
      if (!panelId) return;
      event.preventDefault();
      setActivePanel(root, panelId);
      return;
    }

    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;

    const currentIndex = tabs.findIndex((tab) =>
      tab.classList.contains("is-active")
    );
    if (currentIndex < 0) return;

    event.preventDefault();

    let nextIndex = currentIndex;
    if (event.key === "ArrowUp") nextIndex = Math.max(0, currentIndex - 1);
    if (event.key === "ArrowDown")
      nextIndex = Math.min(tabs.length - 1, currentIndex + 1);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    const nextTab = tabs[nextIndex];
    const panelId = nextTab.dataset.panel;
    if (!panelId) return;

    setActivePanel(root, panelId);
    nextTab.focus();
  });

  const copyBtn = root.querySelector(".future-panel__copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const target = copyBtn.getAttribute("data-future-copy");
      if (target) handleCodeCopy(copyBtn, target);
    });
  }

  setActivePanel(root, "generative");
}
