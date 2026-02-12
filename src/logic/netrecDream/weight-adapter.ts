/**
 * NetRecDream V4 - Weight Adapter
 *
 * Learning algorithm for adaptive weight adjustment based on user feedback.
 * Uses gradient-based adaptation to optimize recommendation weights over time.
 */

import {
  DynamicWeights,
  FeedbackEvent,
  Prediction,
  GranularReason,
  REASON_IMPACT_MAP,
  DEFAULT_DYNAMIC_WEIGHTS
} from './dream-types';

// =============================================================================
// LEARNING RATE SCHEDULE
// =============================================================================

/**
 * Get learning rate based on total feedback events
 * - Initial (0-10): 0.05 (fast adaptation)
 * - Growing (10-50): 0.02 (moderate)
 * - Mature (50+): 0.01 (conservative)
 */
function getLearningRate(totalEvents: number): number {
  if (totalEvents < 10) return 0.05;
  if (totalEvents < 50) return 0.02;
  return 0.01;
}

// =============================================================================
// MAIN WEIGHT ADAPTATION
// =============================================================================

/**
 * Adapt weights based on feedback and prediction error
 */
export function adaptWeights(
  currentWeights: DynamicWeights,
  event: FeedbackEvent,
  prediction: Prediction
): DynamicWeights {
  const weights = { ...currentWeights };

  // 1. Calculate prediction error
  const target = event.type === 'like' ? 1.0 : 0.0;
  const predicted = prediction.predictedScore;
  const error = target - predicted;

  // Update prediction error in event for logging
  prediction.error = error;

  // 2. Get appropriate learning rate
  const learningRate = weights.learningRate || getLearningRate(0);

  // 3. Gradient-based weight adjustment
  weights.cf = adjustWeight(
    weights.cf,
    prediction.scoreBreakdown.cf,
    error,
    learningRate,
    'cf'
  );

  weights.content = adjustWeight(
    weights.content,
    prediction.scoreBreakdown.content,
    error,
    learningRate,
    'content'
  );

  weights.freshness = adjustWeight(
    weights.freshness,
    prediction.scoreBreakdown.freshness,
    error,
    learningRate,
    'freshness'
  );

  weights.relations = adjustWeight(
    weights.relations,
    prediction.scoreBreakdown.relations,
    error,
    learningRate,
    'relations'
  );

  weights.feedback = adjustWeight(
    weights.feedback,
    prediction.scoreBreakdown.feedback,
    error,
    learningRate,
    'feedback'
  );

  weights.interaction = adjustWeight(
    weights.interaction,
    prediction.scoreBreakdown.interaction,
    error,
    learningRate,
    'interaction'
  );

  // 4. Apply reason-specific adjustments
  if (event.reasons && event.reasons.length > 0) {
    applyReasonAdjustments(weights, event.reasons, learningRate);
  }

  // 5. Normalize weights
  normalizeWeights(weights);

  // 6. Update learning rate for next time
  weights.lastAdjusted = Date.now();

  return weights;
}

// =============================================================================
// GRADIENT-BASED ADJUSTMENT
// =============================================================================

/**
 * Adjust a single weight based on its contribution to prediction
 *
 * Logic:
 * - If prediction was correct (low error) and feature score was high → boost weight
 * - If prediction was wrong (high error) and feature score was high → reduce weight
 * - Small feature scores have less impact on adjustment
 */
function adjustWeight(
  currentWeight: number,
  featureScore: number,
  error: number,
  learningRate: number,
  weightName: string
): number {
  // Error ranges from -1 to 1
  // featureScore ranges from 0 to 1

  // Calculate gradient: how much this feature contributed to the error
  // Positive error (liked but predicted low) + high feature → increase weight
  // Negative error (disliked but predicted high) + high feature → decrease weight
  const gradient = error * featureScore;

  // Apply learning rate with feature magnitude
  let adjustment = gradient * learningRate;

  // Clamp adjustment to prevent wild swings
  adjustment = Math.max(-0.05, Math.min(0.05, adjustment));

  // Apply adjustment
  let newWeight = currentWeight + adjustment;

  // Enforce bounds based on weight type
  const bounds = getWeightBounds(weightName);
  newWeight = Math.max(bounds.min, Math.min(bounds.max, newWeight));

  return newWeight;
}

/**
 * Get min/max bounds for each weight
 */
function getWeightBounds(weightName: string): { min: number; max: number } {
  switch (weightName) {
    case 'cf':
      return { min: 0.20, max: 0.60 }; // Core algorithm, keep significant
    case 'content':
      return { min: 0.15, max: 0.50 }; // Important for variety
    case 'freshness':
      return { min: 0.02, max: 0.15 }; // Preference varies
    case 'relations':
      return { min: 0.02, max: 0.20 }; // Sequel lovers vs one-shots
    case 'feedback':
      return { min: 0.05, max: 0.25 }; // User signal is important
    case 'negativeSignal':
      return { min: 0.01, max: 0.10 }; // Penalty weight
    case 'interaction':
      return { min: 0.01, max: 0.10 }; // Click behavior
    default:
      return { min: 0.01, max: 0.50 };
  }
}

// =============================================================================
// REASON-SPECIFIC ADJUSTMENTS
// =============================================================================

/**
 * Apply adjustments based on granular feedback reasons
 */
function applyReasonAdjustments(
  weights: DynamicWeights,
  reasons: GranularReason[],
  learningRate: number
): void {
  for (const reason of reasons) {
    const impact = REASON_IMPACT_MAP[reason];
    if (!impact) continue;

    const key = impact.affectsWeight as keyof DynamicWeights;
    if (typeof weights[key] !== 'number') continue;

    // Apply adjustment based on reason impact
    const adjustment = impact.direction * impact.magnitude * learningRate;
    (weights[key] as number) += adjustment;
  }
}

// =============================================================================
// WEIGHT NORMALIZATION
// =============================================================================

/**
 * Normalize weights to sum to approximately 1.0
 * (excluding negativeSignal which is a penalty)
 */
function normalizeWeights(weights: DynamicWeights): void {
  // Main weights that should sum to ~1.0
  const mainWeights: (keyof DynamicWeights)[] = [
    'cf', 'content', 'freshness', 'relations', 'feedback', 'interaction'
  ];

  const total = mainWeights.reduce((sum, key) => {
    const value = weights[key];
    return typeof value === 'number' ? sum + value : sum;
  }, 0);

  if (total <= 0) return;

  // Normalize each weight
  for (const key of mainWeights) {
    const value = weights[key];
    if (typeof value === 'number') {
      (weights[key] as number) = value / total;
    }
  }

  // negativeSignal is separate (penalty multiplier)
  // Keep it bounded but don't normalize
  weights.negativeSignal = Math.max(0.01, Math.min(0.10, weights.negativeSignal));
}

// =============================================================================
// WEIGHT ANALYSIS
// =============================================================================

/**
 * Analyze how weights have changed from defaults
 */
export function analyzeWeightChanges(weights: DynamicWeights): WeightAnalysis {
  const changes: WeightChange[] = [];

  const comparisons: { key: keyof DynamicWeights; name: string }[] = [
    { key: 'cf', name: 'Collaborative Filtering' },
    { key: 'content', name: 'Content Matching' },
    { key: 'freshness', name: 'Freshness' },
    { key: 'relations', name: 'Sequel/Prequel' },
    { key: 'feedback', name: 'User Feedback' },
    { key: 'interaction', name: 'Interactions' },
    { key: 'negativeSignal', name: 'Negative Signal' }
  ];

  for (const { key, name } of comparisons) {
    const current = weights[key];
    const defaultVal = DEFAULT_DYNAMIC_WEIGHTS[key];

    if (typeof current !== 'number' || typeof defaultVal !== 'number') continue;

    const diff = current - defaultVal;
    const percentChange = (diff / defaultVal) * 100;

    changes.push({
      name,
      current,
      default: defaultVal,
      diff,
      percentChange,
      direction: diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'unchanged'
    });
  }

  // Calculate overall learning stability
  const totalChange = changes.reduce((sum, c) => sum + Math.abs(c.diff), 0);
  const stability = Math.max(0, 1 - (totalChange / 0.5)); // 0.5 total change = 0 stability

  return {
    changes,
    stability,
    mostIncreased: changes.reduce((max, c) =>
      c.percentChange > (max?.percentChange || -Infinity) ? c : max, changes[0]
    ),
    mostDecreased: changes.reduce((min, c) =>
      c.percentChange < (min?.percentChange || Infinity) ? c : min, changes[0]
    )
  };
}

export interface WeightChange {
  name: string;
  current: number;
  default: number;
  diff: number;
  percentChange: number;
  direction: 'increased' | 'decreased' | 'unchanged';
}

export interface WeightAnalysis {
  changes: WeightChange[];
  stability: number;
  mostIncreased: WeightChange;
  mostDecreased: WeightChange;
}

// =============================================================================
// WEIGHT RECOMMENDATIONS
// =============================================================================

/**
 * Generate user-friendly insights about weight changes
 */
export function generateWeightInsights(analysis: WeightAnalysis): string[] {
  const insights: string[] = [];

  // Stability insight
  if (analysis.stability > 0.8) {
    insights.push('Your preferences are well-established and stable.');
  } else if (analysis.stability < 0.5) {
    insights.push('Your preferences are still being learned and may shift.');
  }

  // Most increased weight
  if (analysis.mostIncreased.percentChange > 10) {
    const name = analysis.mostIncreased.name;
    insights.push(`You seem to value ${name} more than average.`);

    if (name === 'Collaborative Filtering') {
      insights.push('Recommendations from similar users work well for you.');
    } else if (name === 'Content Matching') {
      insights.push('Genre and tag matching is important to you.');
    } else if (name === 'Sequel/Prequel') {
      insights.push('You enjoy continuing series you\'ve started.');
    }
  }

  // Most decreased weight
  if (analysis.mostDecreased.percentChange < -10) {
    const name = analysis.mostDecreased.name;
    insights.push(`${name} seems less important for your preferences.`);
  }

  return insights;
}

// =============================================================================
// WEIGHT RESET
// =============================================================================

/**
 * Reset weights to defaults while preserving learning rate
 */
export function resetWeights(): DynamicWeights {
  return {
    ...DEFAULT_DYNAMIC_WEIGHTS,
    learningRate: 0.05, // Reset to initial learning rate
    lastAdjusted: Date.now()
  };
}

/**
 * Partially reset weights (move 50% towards default)
 */
export function softResetWeights(weights: DynamicWeights): DynamicWeights {
  const reset = { ...weights };

  const keys: (keyof DynamicWeights)[] = [
    'cf', 'content', 'freshness', 'relations', 'feedback', 'negativeSignal', 'interaction'
  ];

  for (const key of keys) {
    const current = weights[key];
    const defaultVal = DEFAULT_DYNAMIC_WEIGHTS[key];

    if (typeof current === 'number' && typeof defaultVal === 'number') {
      // Move 50% towards default
      (reset[key] as number) = current + (defaultVal - current) * 0.5;
    }
  }

  reset.lastAdjusted = Date.now();

  return reset;
}

// =============================================================================
// BATCH LEARNING
// =============================================================================

/**
 * Learn from multiple feedback events at once (for initialization)
 */
export function batchLearnWeights(
  initialWeights: DynamicWeights,
  events: Array<{ event: FeedbackEvent; prediction: Prediction }>
): DynamicWeights {
  let weights = { ...initialWeights };

  // Sort by timestamp (oldest first)
  const sorted = [...events].sort((a, b) => a.event.timestamp - b.event.timestamp);

  // Process each event
  for (let i = 0; i < sorted.length; i++) {
    const { event, prediction } = sorted[i];

    // Use lower learning rate for batch learning
    const batchLearningRate = Math.max(0.005, weights.learningRate * 0.5);
    weights.learningRate = batchLearningRate;

    weights = adaptWeights(weights, event, prediction);
  }

  // Reset learning rate to appropriate level
  weights.learningRate = getLearningRate(events.length);

  return weights;
}
