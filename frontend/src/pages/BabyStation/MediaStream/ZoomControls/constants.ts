/**
 * Constants for camera zoom feature
 * Based on: /specs/001-camera-zoom/contracts/typescript-interfaces.md
 */

/** Performance targets */
export const PERFORMANCE_TARGETS = {
  MIN_FPS: 15,
  TARGET_FPS: 30,
  MAX_GESTURE_LATENCY_MS: 50,
  RESET_ANIMATION_MS: 300
} as const;
