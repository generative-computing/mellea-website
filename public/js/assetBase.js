/**
 * Root-absolute asset URLs with optional basePath from layout data attribute.
 * @param {string} path e.g. "assets/mel-g.svg"
 */
export function assetUrl(path) {
  const base = document.documentElement.dataset.assetBase ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
