/**
 * Hero CTA interactions — copy pip install command to clipboard.
 */

import { copyText } from "./clipboard.js";

const COPY_RESET_MS = 2000;

export function initHeroActions() {
  const button = document.querySelector(".btn-pip-install");
  if (!button) return;

  const copyTextValue = button.dataset.copyText?.trim();
  const label = button.querySelector(".btn-pip-install__label-text");
  if (!copyTextValue || !label) return;

  const defaultLabel = label.textContent;

  button.addEventListener("click", async () => {
    try {
      await copyText(copyTextValue);
      label.textContent = "Copied!";
      button.classList.add("btn-pip-install--copied");
      button.setAttribute("aria-label", "Copied to clipboard");

      window.setTimeout(() => {
        label.textContent = defaultLabel;
        button.classList.remove("btn-pip-install--copied");
        button.setAttribute(
          "aria-label",
          "Copy pip install mellea to clipboard"
        );
      }, COPY_RESET_MS);
    } catch {
      label.textContent = "Copy failed";
      window.setTimeout(() => {
        label.textContent = defaultLabel;
      }, COPY_RESET_MS);
    }
  });
}
