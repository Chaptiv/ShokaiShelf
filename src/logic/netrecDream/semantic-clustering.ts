/**
 * NetRecDream V4 - Semantic Clustering
 *
 * ML-based tag cluster discovery from user feedback patterns.
 * Uses co-occurrence analysis and hierarchical clustering to discover
 * semantic groupings that the user tends to like or dislike together.
 */

import { devLog, devWarn, logError } from "@utils/logger";
import {
  DreamProfile,
  TagCluster,
  DiscoveredClusters,
  DEFAULT_DISCOVERED_CLUSTERS,
  FeedbackType
} from './dream-types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface FeedbackData {
  likes: number[];
  dislikes: number[];
}

interface MediaData {
  id: number;
  genres?: string[];
  tags?: { name: string; rank?: number }[];
}

interface CooccurrenceMatrix {
  matrix: Map<string, Map<string, number>>;
  tagCounts: Map<string, number>;
  totalDocuments: number;
}

interface ClusterCandidate {
  tags: string[];
  coherence: number;
  centroid: Map<string, number>;
}

// =============================================================================
// MAIN CLUSTERING FUNCTION
// =============================================================================

/**
 * Discover tag clusters from user's feedback patterns
 */
export async function discoverClusters(
  profile: DreamProfile,
  minClusterSize: number = 3,
  maxClusters: number = 10
): Promise<DiscoveredClusters> {
  devLog(`[SemanticClustering] Starting cluster discovery for ${profile.userId}`);

  // 1. Load feedback data
  const feedbackData = await loadFeedbackData();

  if (feedbackData.likes.length + feedbackData.dislikes.length < 10) {
    devLog(`[SemanticClustering] Not enough feedback data (${feedbackData.likes.length + feedbackData.dislikes.length} entries)`);
    return { ...DEFAULT_DISCOVERED_CLUSTERS };
  }

  // 2. Load media data for feedback items
  const mediaDatabase = await loadMediaDatabase(feedbackData);

  // 3. Build co-occurrence matrix
  const likeMatrix = buildTagCooccurrenceMatrix(feedbackData.likes, mediaDatabase);
  const dislikeMatrix = buildTagCooccurrenceMatrix(feedbackData.dislikes, mediaDatabase);

  // 4. Discover clusters from liked anime
  const likeClusters = hierarchicalClustering(
    likeMatrix,
    minClusterSize,
    Math.floor(maxClusters / 2)
  );

  // 5. Discover clusters from disliked anime
  const dislikeClusters = hierarchicalClustering(
    dislikeMatrix,
    minClusterSize,
    Math.floor(maxClusters / 2)
  );

  // 6. Calculate user affinity for each cluster
  const allClusters = [
    ...likeClusters.map(c => ({ ...c, baseAffinity: 1 })),
    ...dislikeClusters.map(c => ({ ...c, baseAffinity: -1 }))
  ];

  const tagClusters: TagCluster[] = allClusters.map((cluster, index) => {
    const affinity = calculateClusterAffinity(
      cluster.tags,
      feedbackData,
      mediaDatabase,
      cluster.baseAffinity
    );

    return {
      id: `cluster_${Date.now()}_${index}`,
      name: generateClusterName(cluster.tags),
      tags: cluster.tags,
      coherence: cluster.coherence,
      userAffinity: affinity,
      sampleAnime: findSampleAnime(cluster.tags, mediaDatabase),
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };
  });

  // 7. Filter low-quality clusters and sort by coherence
  const validClusters = tagClusters
    .filter(c => c.coherence >= profile.clusters.coherenceThreshold)
    .sort((a, b) => b.coherence - a.coherence)
    .slice(0, maxClusters);

  devLog(`[SemanticClustering] Discovered ${validClusters.length} clusters`);

  return {
    clusters: validClusters,
    lastTraining: Date.now(),
    trainingDataSize: feedbackData.likes.length + feedbackData.dislikes.length,
    coherenceThreshold: profile.clusters.coherenceThreshold || 0.5
  };
}

// =============================================================================
// CO-OCCURRENCE MATRIX
// =============================================================================

/**
 * Build co-occurrence matrix from anime IDs
 */
export function buildTagCooccurrenceMatrix(
  animeIds: number[],
  mediaDatabase: Map<number, MediaData>
): CooccurrenceMatrix {
  const matrix = new Map<string, Map<string, number>>();
  const tagCounts = new Map<string, number>();
  let totalDocuments = 0;

  for (const animeId of animeIds) {
    const media = mediaDatabase.get(animeId);
    if (!media) continue;

    // Extract tags (top 10 by rank)
    const tags = (media.tags || [])
      .sort((a, b) => (b.rank || 0) - (a.rank || 0))
      .slice(0, 10)
      .map(t => t.name);

    // Also include genres
    const allTags = [...tags, ...(media.genres || [])];

    if (allTags.length === 0) continue;

    totalDocuments++;

    // Count individual tags
    for (const tag of allTags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }

    // Count co-occurrences
    for (let i = 0; i < allTags.length; i++) {
      for (let j = i + 1; j < allTags.length; j++) {
        const tag1 = allTags[i];
        const tag2 = allTags[j];

        // Ensure consistent ordering
        const [first, second] = tag1 < tag2 ? [tag1, tag2] : [tag2, tag1];

        if (!matrix.has(first)) {
          matrix.set(first, new Map());
        }

        const row = matrix.get(first)!;
        row.set(second, (row.get(second) || 0) + 1);
      }
    }
  }

  return { matrix, tagCounts, totalDocuments };
}

/**
 * Get co-occurrence score between two tags (0-1)
 */
function getCooccurrence(
  matrix: CooccurrenceMatrix,
  tag1: string,
  tag2: string
): number {
  const [first, second] = tag1 < tag2 ? [tag1, tag2] : [tag2, tag1];

  const count1 = matrix.tagCounts.get(tag1) || 0;
  const count2 = matrix.tagCounts.get(tag2) || 0;

  if (count1 === 0 || count2 === 0) return 0;

  const cooccurrence = matrix.matrix.get(first)?.get(second) || 0;

  // Use Jaccard similarity
  const union = count1 + count2 - cooccurrence;
  return union > 0 ? cooccurrence / union : 0;
}

// =============================================================================
// HIERARCHICAL CLUSTERING
// =============================================================================

/**
 * Perform hierarchical agglomerative clustering on tags
 */
function hierarchicalClustering(
  cooccurrenceMatrix: CooccurrenceMatrix,
  minClusterSize: number,
  maxClusters: number
): ClusterCandidate[] {
  // Start with each tag as its own cluster
  const tags = Array.from(cooccurrenceMatrix.tagCounts.keys());

  if (tags.length < minClusterSize) {
    return [];
  }

  // Filter to tags that appear frequently enough
  const frequentTags = tags.filter(tag => {
    const count = cooccurrenceMatrix.tagCounts.get(tag) || 0;
    return count >= 2; // Minimum 2 occurrences
  });

  if (frequentTags.length < minClusterSize) {
    return [];
  }

  // Initialize clusters
  let clusters: Set<string>[] = frequentTags.map(tag => new Set([tag]));

  // Build distance matrix
  const distanceMatrix = buildDistanceMatrix(frequentTags, cooccurrenceMatrix);

  // Merge clusters until we reach target or can't merge anymore
  while (clusters.length > maxClusters) {
    // Find most similar pair of clusters
    let bestScore = -1;
    let bestI = -1;
    let bestJ = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const similarity = calculateClusterSimilarity(
          clusters[i],
          clusters[j],
          distanceMatrix,
          frequentTags
        );

        if (similarity > bestScore) {
          bestScore = similarity;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // Stop if similarity is too low
    if (bestScore < 0.2) break;

    // Merge clusters
    const merged = new Set([...clusters[bestI], ...clusters[bestJ]]);
    clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
    clusters.push(merged);
  }

  // Convert to ClusterCandidate format
  return clusters
    .filter(cluster => cluster.size >= minClusterSize)
    .map(cluster => {
      const tags = Array.from(cluster);
      return {
        tags,
        coherence: calculateClusterCoherence(tags, cooccurrenceMatrix),
        centroid: calculateCentroid(tags, cooccurrenceMatrix)
      };
    });
}

/**
 * Build distance matrix between tags (1 - similarity)
 */
function buildDistanceMatrix(
  tags: string[],
  cooccurrenceMatrix: CooccurrenceMatrix
): number[][] {
  const n = tags.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const similarity = getCooccurrence(cooccurrenceMatrix, tags[i], tags[j]);
      const distance = 1 - similarity;
      matrix[i][j] = distance;
      matrix[j][i] = distance;
    }
  }

  return matrix;
}

/**
 * Calculate similarity between two clusters (average linkage)
 */
function calculateClusterSimilarity(
  cluster1: Set<string>,
  cluster2: Set<string>,
  distanceMatrix: number[][],
  tagIndex: string[]
): number {
  let totalSimilarity = 0;
  let count = 0;

  for (const tag1 of cluster1) {
    for (const tag2 of cluster2) {
      const i = tagIndex.indexOf(tag1);
      const j = tagIndex.indexOf(tag2);

      if (i !== -1 && j !== -1) {
        totalSimilarity += 1 - distanceMatrix[i][j];
        count++;
      }
    }
  }

  return count > 0 ? totalSimilarity / count : 0;
}

/**
 * Calculate how coherent (tight) a cluster is
 */
function calculateClusterCoherence(
  tags: string[],
  cooccurrenceMatrix: CooccurrenceMatrix
): number {
  if (tags.length < 2) return 1;

  let totalSimilarity = 0;
  let pairs = 0;

  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      totalSimilarity += getCooccurrence(cooccurrenceMatrix, tags[i], tags[j]);
      pairs++;
    }
  }

  return pairs > 0 ? totalSimilarity / pairs : 0;
}

/**
 * Calculate centroid (average vector) for a cluster
 */
function calculateCentroid(
  tags: string[],
  cooccurrenceMatrix: CooccurrenceMatrix
): Map<string, number> {
  const centroid = new Map<string, number>();
  const allTags = Array.from(cooccurrenceMatrix.tagCounts.keys());

  for (const targetTag of allTags) {
    let sum = 0;
    for (const clusterTag of tags) {
      sum += getCooccurrence(cooccurrenceMatrix, clusterTag, targetTag);
    }
    centroid.set(targetTag, sum / tags.length);
  }

  return centroid;
}

// =============================================================================
// CLUSTER AFFINITY CALCULATION
// =============================================================================

/**
 * Calculate user's affinity for a cluster based on feedback
 */
export function calculateClusterAffinity(
  clusterTags: string[],
  feedbackData: FeedbackData,
  mediaDatabase: Map<number, MediaData>,
  baseAffinity: number
): number {
  let likeMatches = 0;
  let dislikeMatches = 0;

  // Count matches in liked anime
  for (const animeId of feedbackData.likes) {
    const media = mediaDatabase.get(animeId);
    if (!media) continue;

    const animeTags = [
      ...(media.tags || []).map(t => t.name),
      ...(media.genres || [])
    ];

    const overlap = clusterTags.filter(t => animeTags.includes(t)).length;
    if (overlap >= 2) { // At least 2 tags must match
      likeMatches++;
    }
  }

  // Count matches in disliked anime
  for (const animeId of feedbackData.dislikes) {
    const media = mediaDatabase.get(animeId);
    if (!media) continue;

    const animeTags = [
      ...(media.tags || []).map(t => t.name),
      ...(media.genres || [])
    ];

    const overlap = clusterTags.filter(t => animeTags.includes(t)).length;
    if (overlap >= 2) {
      dislikeMatches++;
    }
  }

  const total = likeMatches + dislikeMatches;
  if (total === 0) return baseAffinity * 0.5; // Default based on source

  // Calculate affinity: -1 (hate) to +1 (love)
  const affinity = (likeMatches - dislikeMatches) / Math.sqrt(total + 1);

  // Clamp to [-1, 1]
  return Math.max(-1, Math.min(1, affinity));
}

// =============================================================================
// CLUSTER NAMING
// =============================================================================

/**
 * Generate a human-readable name for a cluster
 */
export function generateClusterName(tags: string[]): string {
  // Priority tags for naming
  const priorityTags = [
    // Mood/Tone
    'Psychological', 'Dark', 'Comedy', 'Drama', 'Romance', 'Horror',
    // Setting
    'School', 'Military', 'Fantasy', 'Sci-Fi', 'Isekai', 'Historical',
    // Theme
    'Action', 'Adventure', 'Mystery', 'Thriller', 'Sports'
  ];

  // Find priority tags in cluster
  const priorityMatches = tags.filter(t => priorityTags.includes(t));

  if (priorityMatches.length >= 2) {
    // Combine top 2 priority tags
    return priorityMatches.slice(0, 2).join('');
  } else if (priorityMatches.length === 1) {
    // Use priority tag + another tag
    const other = tags.find(t => !priorityTags.includes(t));
    return other ? `${priorityMatches[0]}${other}` : priorityMatches[0];
  }

  // No priority tags, just combine first two
  if (tags.length >= 2) {
    return `${tags[0]}${tags[1]}`;
  }

  return tags[0] || 'Unknown';
}

// =============================================================================
// SAMPLE ANIME FINDER
// =============================================================================

/**
 * Find example anime IDs that belong to a cluster
 */
function findSampleAnime(
  clusterTags: string[],
  mediaDatabase: Map<number, MediaData>
): number[] {
  const matches: { id: number; overlap: number }[] = [];

  for (const [id, media] of mediaDatabase.entries()) {
    const animeTags = [
      ...(media.tags || []).map(t => t.name),
      ...(media.genres || [])
    ];

    const overlap = clusterTags.filter(t => animeTags.includes(t)).length;

    if (overlap >= 2) {
      matches.push({ id, overlap });
    }
  }

  // Return top 5 by overlap
  return matches
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 5)
    .map(m => m.id);
}

// =============================================================================
// DATA LOADING HELPERS
// =============================================================================

/**
 * Load feedback data from storage
 */
async function loadFeedbackData(): Promise<FeedbackData> {
  try {
    const { exportFeedbackForEngine } = await import('../feedback-store');
    return await exportFeedbackForEngine();
  } catch (error) {
    logError('[SemanticClustering] Error loading feedback:', error);
    return { likes: [], dislikes: [] };
  }
}

/**
 * Load media database for feedback items
 */
async function loadMediaDatabase(
  feedbackData: FeedbackData
): Promise<Map<number, MediaData>> {
  const database = new Map<number, MediaData>();
  const allIds = [...feedbackData.likes, ...feedbackData.dislikes];

  // Try to load from cache first
  try {
    const { cacheManager } = await import('../netrecV3/cache');

    for (const id of allIds) {
      const cached = await cacheManager.get('media', String(id));
      if (cached) {
        database.set(id, {
          id,
          genres: (cached as any).genres,
          tags: (cached as any).tags
        });
      }
    }

    // If we got most of the data from cache, use it
    if (database.size >= allIds.length * 0.8) {
      return database;
    }
  } catch (error) {
    devWarn('[SemanticClustering] Could not load from cache:', error);
  }

  // Fallback: fetch missing data
  try {
    const { fetchMediaDetails } = await import('../netrecV3/queries');

    for (const id of allIds) {
      if (database.has(id)) continue;

      try {
        const media = await fetchMediaDetails(id);
        if (media) {
          database.set(id, {
            id,
            genres: media.genres,
            tags: media.tags
          });
        }
      } catch (err) {
        // Skip individual failures
        devWarn(`[SemanticClustering] Could not load media ${id}`);
      }
    }
  } catch (error) {
    logError('[SemanticClustering] Error fetching media details:', error);
  }

  return database;
}

// =============================================================================
// CLUSTER UTILITIES
// =============================================================================

/**
 * Find clusters that match a given anime
 */
export function findMatchingClusters(
  animeTags: string[],
  profile: DreamProfile,
  minOverlap: number = 2
): TagCluster[] {
  return profile.clusters.clusters.filter(cluster => {
    const overlap = cluster.tags.filter(t => animeTags.includes(t)).length;
    return overlap >= minOverlap;
  });
}

/**
 * Get total cluster boost/penalty for an anime
 */
export function getClusterScoreModifier(
  animeTags: string[],
  profile: DreamProfile
): number {
  const matchingClusters = findMatchingClusters(animeTags, profile);

  if (matchingClusters.length === 0) return 1.0;

  // Combine affinities
  let totalModifier = 1.0;

  for (const cluster of matchingClusters) {
    // Affinity ranges from -1 to 1
    // Convert to multiplier: 0.5 (hate) to 1.5 (love)
    const multiplier = 1.0 + (cluster.userAffinity * 0.3);
    totalModifier *= multiplier;
  }

  // Clamp to reasonable range
  return Math.max(0.5, Math.min(1.5, totalModifier));
}

/**
 * Update cluster affinity based on new feedback
 */
export async function updateClusterAffinity(
  profile: DreamProfile,
  animeId: number,
  feedbackType: FeedbackType
): Promise<void> {
  if (!feedbackType) return;

  const mediaDatabase = new Map<number, MediaData>();

  try {
    const { fetchMediaDetails } = await import('../netrecV3/queries');
    const media = await fetchMediaDetails(animeId);

    if (media) {
      mediaDatabase.set(animeId, {
        id: animeId,
        genres: media.genres,
        tags: media.tags
      });
    }
  } catch {
    return; // Can't update without media data
  }

  const media = mediaDatabase.get(animeId);
  if (!media) return;

  const animeTags = [
    ...(media.tags || []).map(t => t.name),
    ...(media.genres || [])
  ];

  // Update matching clusters
  for (const cluster of profile.clusters.clusters) {
    const overlap = cluster.tags.filter(t => animeTags.includes(t)).length;

    if (overlap >= 2) {
      // Adjust affinity
      const adjustment = feedbackType === 'like' ? 0.05 : -0.05;
      cluster.userAffinity = Math.max(-1, Math.min(1, cluster.userAffinity + adjustment));
      cluster.lastUpdated = Date.now();
    }
  }
}
