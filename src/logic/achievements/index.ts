// Achievement System - Main Entry Point
export * from './achievement-types';
export * from './achievement-definitions';
export * from './achievement-store';
export {
  processEvent,
  onAchievementUnlock,
  getAchievementProgress,
} from './achievement-engine';

// Send system notification for achievement
export async function sendAchievementSystemNotification(achievement: {
  name: string;
  icon: string;
  description: string;
}): Promise<boolean> {
  try {
    // @ts-ignore - window.shokai is defined in preload
    if (window.shokai?.achievements?.notify) {
      const result = await window.shokai.achievements.notify(achievement);
      return result?.success ?? false;
    }
    return false;
  } catch (e) {
    logError('[Achievements] Failed to send system notification:', e);
    return false;
  }
}
