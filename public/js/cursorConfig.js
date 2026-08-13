/**
 * Demo page cursor sprite configuration.
 * Sprites c–e are registered for future scroll triggers.
 */
export const cursorConfig = {
  defaultSprite: "a",
  sprites: [
    { id: "a", src: "assets/mel-a.svg" },
    { id: "b", src: "assets/mel-b.svg" },
    { id: "c", src: "assets/mel-c.svg" },
    { id: "d", src: "assets/mel-d.svg" },
    { id: "e", src: "assets/mel-e.svg" },
    { id: "f", src: "assets/mel-f.svg", scale: 1.4 },
    /* 57×55 art — enlarged for Get started hover */
    { id: "h", src: "assets/mel-h.svg", scale: 1 },
  ],
  triggers: [
    { id: "default", type: "default", sprite: "a", priority: 0 },
    {
      id: "github-hover",
      type: "hover",
      selector: ".github-btn",
      sprite: "f",
      priority: 10,
    },
    {
      id: "pip-install-hover",
      type: "hover",
      selector: ".btn-pip-install",
      sprite: "c",
      priority: 10,
    },
    {
      id: "get-started-hover",
      type: "hover",
      selector: ".get-started-btn, .btn-nav-get-started",
      sprite: "h",
      priority: 10,
    },
    // Future scroll triggers (scaffold only — not active yet):
    // { id: "scroll-green", type: "scroll", sprite: "c", from: 0.2, to: 0.45, priority: 5 },
    // { id: "scroll-purple", type: "scroll", sprite: "d", from: 0.45, to: 0.7, priority: 5 },
    // { id: "scroll-red", type: "scroll", sprite: "e", from: 0.7, to: 1, priority: 5 },
  ],
  motion: {
    positionDamping: 0.14,
    offsetX: 28,
    offsetY: 32,
  },
};
