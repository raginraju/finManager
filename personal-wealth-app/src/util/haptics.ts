/**
 * Core Haptic Feedback Engine using the Native Web Vibrations API
 */
export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
  // Ensure window and navigator are present (SSR safety) and vibration is supported
  if (typeof window === 'undefined' || !navigator.vibrate) return;

  switch (type) {
    case 'light':
      // Short, subtle tap (e.g., switching months, clicking tab anchors)
      navigator.vibrate(10);
      break;
    case 'medium':
      // Standard click affirmation (e.g., opening a dropdown, staging a value)
      navigator.vibrate(20);
      break;
    case 'heavy':
      // Intense feedback nudge (e.g., opening the Destructive Purge Modal)
      navigator.vibrate(40);
      break;
    case 'success':
      // Quick double pulse (e.g., "Cloud synced successfully" toast trigger)
      navigator.vibrate([15, 30, 15]);
      break;
    case 'error':
      // Long dramatic pulse sequence (e.g., structural validation failures)
      navigator.vibrate([50, 50, 50]);
      break;
    default:
      break;
  }
};