/**
 * User Preferences Storage System
 *
 * Stores explicit user preferences for recommendation fine-tuning:
 * - Favorite genres
 * - Favorite studios
 * - Preferred tags
 * - Anime selections
 */

export interface UserPreferences {
  favoriteGenres: string[];
  dislikedGenres: string[];
  favoriteStudios: string[];
  preferredTags: string[];
  selectedAnimeIds: number[]; // Anime user marked as interesting
  coldStartCompleted: boolean;
  lastUpdated: number;
}

const STORAGE_KEY = "shokai.preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteGenres: [],
  dislikedGenres: [],
  favoriteStudios: [],
  preferredTags: [],
  selectedAnimeIds: [],
  coldStartCompleted: false,
  lastUpdated: Date.now(),
};

/**
 * Get all user preferences
 */
export async function getPreferences(): Promise<UserPreferences> {
  try {
    // Try window.shokai.store first
    if (window.shokai?.store?.get) {
      const data = await window.shokai.store.get(STORAGE_KEY);
      if (data) {
        return { ...DEFAULT_PREFERENCES, ...data };
      }
    }

    // Fallback to localStorage
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const parsed = JSON.parse(localData);
      return { ...DEFAULT_PREFERENCES, ...parsed };
    }

    return DEFAULT_PREFERENCES;
  } catch (error) {
    console.error("[Preferences] Failed to load preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save user preferences
 */
export async function savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
  try {
    const current = await getPreferences();
    const updated = {
      ...current,
      ...preferences,
      lastUpdated: Date.now(),
    };

    // Save to both stores
    if (window.shokai?.store?.set) {
      await window.shokai.store.set(STORAGE_KEY, updated);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    console.log("[Preferences] Saved preferences");
  } catch (error) {
    console.error("[Preferences] Failed to save preferences:", error);
  }
}

/**
 * Add favorite genre
 */
export async function addFavoriteGenre(genre: string): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.favoriteGenres.includes(genre)) {
    prefs.favoriteGenres.push(genre);
    await savePreferences(prefs);
  }
}

/**
 * Remove favorite genre
 */
export async function removeFavoriteGenre(genre: string): Promise<void> {
  const prefs = await getPreferences();
  prefs.favoriteGenres = prefs.favoriteGenres.filter((g) => g !== genre);
  await savePreferences(prefs);
}

/**
 * Add disliked genre
 */
export async function addDislikedGenre(genre: string): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.dislikedGenres.includes(genre)) {
    prefs.dislikedGenres.push(genre);
    await savePreferences(prefs);
  }
}

/**
 * Remove disliked genre
 */
export async function removeDislikedGenre(genre: string): Promise<void> {
  const prefs = await getPreferences();
  prefs.dislikedGenres = prefs.dislikedGenres.filter((g) => g !== genre);
  await savePreferences(prefs);
}

/**
 * Add favorite studio
 */
export async function addFavoriteStudio(studio: string): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.favoriteStudios.includes(studio)) {
    prefs.favoriteStudios.push(studio);
    await savePreferences(prefs);
  }
}

/**
 * Remove favorite studio
 */
export async function removeFavoriteStudio(studio: string): Promise<void> {
  const prefs = await getPreferences();
  prefs.favoriteStudios = prefs.favoriteStudios.filter((s) => s !== studio);
  await savePreferences(prefs);
}

/**
 * Add preferred tag
 */
export async function addPreferredTag(tag: string): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.preferredTags.includes(tag)) {
    prefs.preferredTags.push(tag);
    await savePreferences(prefs);
  }
}

/**
 * Remove preferred tag
 */
export async function removePreferredTag(tag: string): Promise<void> {
  const prefs = await getPreferences();
  prefs.preferredTags = prefs.preferredTags.filter((t) => t !== tag);
  await savePreferences(prefs);
}

/**
 * Add anime selection
 */
export async function addAnimeSelection(animeId: number): Promise<void> {
  const prefs = await getPreferences();
  if (!prefs.selectedAnimeIds.includes(animeId)) {
    prefs.selectedAnimeIds.push(animeId);
    await savePreferences(prefs);
  }
}

/**
 * Remove anime selection
 */
export async function removeAnimeSelection(animeId: number): Promise<void> {
  const prefs = await getPreferences();
  prefs.selectedAnimeIds = prefs.selectedAnimeIds.filter((id) => id !== animeId);
  await savePreferences(prefs);
}

/**
 * Mark cold start as completed
 */
export async function completeColdStart(): Promise<void> {
  await savePreferences({ coldStartCompleted: true });
}

/**
 * Check if user needs cold start wizard
 */
export async function needsColdStart(userListCount: number): Promise<boolean> {
  const prefs = await getPreferences();

  // Show cold start if:
  // 1. Not completed yet AND
  // 2. User has less than 5 entries in their list
  return !prefs.coldStartCompleted && userListCount < 5;
}

/**
 * Reset all preferences
 */
export async function resetPreferences(): Promise<void> {
  try {
    if (window.shokai?.store?.set) {
      await window.shokai.store.set(STORAGE_KEY, DEFAULT_PREFERENCES);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    console.log("[Preferences] Reset preferences");
  } catch (error) {
    console.error("[Preferences] Failed to reset preferences:", error);
  }
}

/**
 * Export preferences for engine
 */
export async function exportPreferencesForEngine(): Promise<{
  favoriteGenres: string[];
  dislikedGenres: string[];
  favoriteStudios: string[];
  preferredTags: string[];
  selectedAnimeIds: number[];
}> {
  const prefs = await getPreferences();
  return {
    favoriteGenres: prefs.favoriteGenres,
    dislikedGenres: prefs.dislikedGenres,
    favoriteStudios: prefs.favoriteStudios,
    preferredTags: prefs.preferredTags,
    selectedAnimeIds: prefs.selectedAnimeIds,
  };
}
