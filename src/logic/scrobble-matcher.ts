// Smart Scrobble Matcher
// Vergleicht Titel und bevorzugt die eigene Library

import type { Media } from '../api/anilist';

interface MatchResult {
  media: Media | null;
  confidence: number;
  source: 'library' | 'search';
}

// Einfache Levenshtein-Distanz für Textähnlichkeit
function similarity(s1: string, s2: string): number {
  let longer = s1.toLowerCase();
  let shorter = s2.toLowerCase();
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength.toString());
}

function editDistance(s1: string, s2: string): number {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1))
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function cleanTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/\b(TV|Movie|OVA|ONA|Special)\b/gi, '')
    .replace(/\s+-\s+.*$/, '') // Entfernt " - Episode..."
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function findBestMatch(
  query: string,
  userLibrary: any[],
  searchResults: any[] = []
): MatchResult {
  const cleanedQuery = cleanTitle(query);
  let bestMatch: any = null;
  let bestScore = 0;
  let source: 'library' | 'search' = 'search';

  // 1. Suche in der User Library (Priorität: CURRENT, PLANNING, PAUSED)
  // Wir flachen die AniList-Listen Struktur ab
  const allEntries = userLibrary.flatMap(list => list.entries || []);

  for (const entry of allEntries) {
    const media = entry.media;
    if (!media) continue;

    const titles = [media.title.english, media.title.romaji, media.title.native].filter(Boolean);
    
    for (const t of titles) {
      const score = similarity(cleanedQuery, cleanTitle(t));
      // Bonus für Anime, die man gerade schaut
      const boost = entry.status === 'CURRENT' ? 0.15 : 0;
      const finalScore = score + boost;
      
      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMatch = media;
        source = 'library';
      }
    }
  }

  // Wenn ein Library-Treffer sehr sicher ist (> 85%), nehmen wir ihn sofort
  if (bestScore > 0.85) {
    return { media: bestMatch, confidence: Math.min(bestScore, 1), source: 'library' };
  }

  // 2. Globaler Fallback (Suchergebnisse von AniList)
  for (const media of searchResults) {
    const titles = [media.title.english, media.title.romaji, media.title.native].filter(Boolean);
    for (const t of titles) {
      const score = similarity(cleanedQuery, cleanTitle(t));
      if (score > bestScore) {
        bestScore = score;
        bestMatch = media;
        source = 'search';
      }
    }
  }

  return { media: bestMatch, confidence: bestScore, source };
}
