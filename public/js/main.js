import { createCursorSprite } from "./cursorSprite.js";
import { createCursorTrail } from "./cursorTrail.js";
import { cursorConfig } from "./cursorConfig.js";
import { assetUrl } from "./assetBase.js";
import { initHeroIntro } from "./heroIntro.js";
import { initSectionReveal } from "./sectionReveal.js";
import { initHeroActions } from "./heroActions.js";
import { initHeroDotField } from "./dotField.js";
import { initCursorToggle } from "./cursorToggle.js";
import { initFutureSoftwarePanel } from "./futureSoftwarePanel.js";
import { initMelleaCompare } from "./melleaCompare.js";

const resolvedConfig = {
  ...cursorConfig,
  sprites: cursorConfig.sprites.map((sprite) => ({
    ...sprite,
    src: assetUrl(sprite.src),
  })),
};

// The follower tracks a hovering cursor, so it's skipped on touchscreens.
// Same query as the styles.css @media block that hides its elements.
const isTouchDevice = window.matchMedia("(hover: none), (pointer: coarse)");

// Loaded once; LandingScripts fires mellea:landing-mount/-unmount so we can
// rebuild effects and tear down global listeners across client-side navigation.
let active = null;

function setup() {
  if (active) return;

  const cursor = createCursorSprite(resolvedConfig);
  const trail = createCursorTrail({
    src: assetUrl("assets/mel-g.svg"),
    sectionSelector: "#granite-section",
    getFollowTarget: () => cursor.getAnchorPosition(),
    onSectionChange: () => syncCursorFollowerVisibility(),
  });
  const brandIcon = document.querySelector(".brand__icon");

  let cursorFollowerEnabled = false;

  function syncBrandIconForFollower(isActive) {
    document.body.classList.toggle("is-follower-active", isActive);

    if (brandIcon) {
      brandIcon.setAttribute("aria-hidden", isActive ? "true" : "false");
    }
  }

  function syncCursorFollowerVisibility() {
    const showFollower = cursorFollowerEnabled;
    cursor.setVisible(showFollower);
    trail.syncVisibility(showFollower);
    syncBrandIconForFollower(showFollower);
  }

  function applyCursorFollowerEnabled(enabled) {
    cursorFollowerEnabled = enabled;
    trail.setEnabled(enabled);

    if (!enabled) {
      cursor.setVisible(false);
      trail.syncVisibility(false);
      syncBrandIconForFollower(false);
      return;
    }

    syncCursorFollowerVisibility();
  }

  initHeroIntro();
  initSectionReveal();
  initHeroActions();
  const dotField = initHeroDotField();
  initFutureSoftwarePanel();
  initMelleaCompare();

  // On touch devices the toggle isn't wired up and the loops never start.
  if (!isTouchDevice.matches) {
    initCursorToggle({ onChange: applyCursorFollowerEnabled });
    cursor.start();
    trail.start();
    cursor.setVisible(false);
    trail.syncVisibility(false);
  }

  active = { cursor, trail, dotField };
}

function teardown() {
  if (!active) return;

  active.cursor.destroy();
  active.trail.destroy();
  active.dotField?.destroy();
  active = null;
}

window.addEventListener("mellea:landing-mount", setup);
window.addEventListener("mellea:landing-unmount", teardown);

// The first mount event fires before this module loads, so run setup directly.
setup();
