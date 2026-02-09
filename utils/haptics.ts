/**
 * Haptic feedback helpers.
 * Wraps expo-haptics for convenient usage.
 */

import * as Haptics from 'expo-haptics';

/** Light tap feedback (e.g., selection changes) */
export function lightTap() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap feedback (e.g., button presses) */
export function mediumTap() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy tap feedback (e.g., destructive actions) */
export function heavyTap() {
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success notification (e.g., import complete) */
export function successNotification() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Error notification (e.g., import failed) */
export function errorNotification() {
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Selection changed (e.g., picker value) */
export function selectionChanged() {
  return Haptics.selectionAsync();
}
