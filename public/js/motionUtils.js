/**
 * Shared motion helpers for cursor modules.
 */

export function damp(current, target, factor) {
  return current + (target - current) * factor;
}
