/**
 * Custom cursor-follower toggle: persists the on/off preference to
 * localStorage and wires up the toggle button (state, ARIA, label).
 */
const STORAGE_KEY = "mellea-cursor-follower";

/**
 * @returns {boolean}
 */
export function readCursorFollowerPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return false;
    return stored === "true";
  } catch {
    return false;
  }
}

/**
 * @param {boolean} enabled
 */
export function writeCursorFollowerPreference(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * @param {object} options
 * @param {(enabled: boolean) => void} options.onChange
 * @returns {{ getEnabled: () => boolean, setEnabled: (enabled: boolean) => void }}
 */
export function initCursorToggle(options) {
  const { onChange } = options;
  const root = document.getElementById("cursor-toggle");
  const button = root?.querySelector(".cursor-toggle__button");

  if (!root || !button) {
    return {
      getEnabled: () => false,
      setEnabled: () => {},
    };
  }

  let enabled = readCursorFollowerPreference();

  function syncUi() {
    root.classList.toggle("cursor-toggle--on", enabled);
    root.classList.toggle("cursor-toggle--off", !enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute(
      "aria-label",
      enabled ? "Turn custom cursor off" : "Turn custom cursor on"
    );

    const label = button.querySelector(".cursor-toggle__label");
    if (label) {
      label.textContent = enabled ? "ON" : "OFF";
    }
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    writeCursorFollowerPreference(enabled);
    syncUi();
    onChange(enabled);
  }

  button.addEventListener("click", () => {
    setEnabled(!enabled);
  });

  syncUi();
  onChange(enabled);

  return {
    getEnabled: () => enabled,
    setEnabled,
  };
}
