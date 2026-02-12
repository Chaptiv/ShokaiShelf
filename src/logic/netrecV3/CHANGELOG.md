# NetRecV3 Changelog

## Version 3.1.0 - Phase 2 (2025-01-11)

### 🚨 Critical Fixes

- **Rate Limiting**: Fixed critical bug where `queries.ts` bypassed rate limiter, causing API spam
  - Added `rateLimiter.checkLimit()` before every GraphQL fetch
  - Added 429 error handling with automatic retry and backoff
  - Prevents API blocks from AniList

### ✨ New Features

#### Dynamic Explanations System
- **Completely Rewritten**: Reasons are now dynamic and personalized instead of static
- **Multi-Seed Reasons**: "Ähnlich wie Attack on Titan und Death Note" instead of single anime
- **User Statistics**: "Action: Du hast 85% mit 8+ bewertet" instead of "Passende Genres"
- **Studio Averages**: "Wit Studio hat bei dir ⌀ 8.5/10" instead of "Studio kennst du bereits"
- **Tag Examples**: "Hat 'Time Travel' wie Steins;Gate" instead of "Ähnliche Themen"
- **Score Context**: "Höher bewertet als 95% aller Anime" instead of "Hohe Bewertung"
- **Popularity Ranks**: "Top 10 der beliebtesten Anime" instead of "Sehr beliebt"
- **Personalized Bingeability**: "schön kurz mit 12 Episoden" based on user's average
- **Format Completion Rates**: "Movie: Du completest 90%" instead of "Format: Movie"
- **Seasonal Context**: "Aktueller Winter 2025 Anime" instead of just "Neu erschienen"

**Example Improvements:**
- Old: "Passende Genres: Action, Adventure"
- New: "Action: Du hast 85% mit 8+ bewertet"

- Old: "Studio: Wit (kennst du bereits)"
- New: "Wit Studio hat bei dir ⌀ 8.5/10"

- Old: "Ähnliche Themen: Time Travel, Drama"
- New: "Hat 'Time Travel' wie Steins;Gate"

#### Feedback System Integration
- **Negative Signal Learning**: Learns from disliked anime to avoid similar recommendations
  - Calculates similarity to disliked anime and applies penalty
  - Hard blocks explicitly disliked anime (0.1x multiplier)
  - New `negativeSimilarity` feature in scoring

- **Positive Feedback Boost**: Learns from liked anime to recommend similar content
  - Calculates similarity to liked anime and applies boost
  - New `positiveSimilarity` feature in scoring
  - Compatible with V2 feedback storage format

- **Click/View Tracking**: Considers user interactions
  - Tracks clicked anime (cover attracted user)
  - Tracks viewed anime (opened detail view)
  - Tracks impression counts
  - Adds interaction boost to scoring

#### New Features
- `isLiked`: Boolean flag for liked anime
- `isDisliked`: Boolean flag for disliked anime
- `wasClicked`: Boolean flag for clicked anime
- `wasViewed`: Boolean flag for viewed anime
- `impressionCount`: Number of times anime was shown
- `negativeSimilarity`: Similarity to disliked anime (0-1)
- `positiveSimilarity`: Similarity to liked anime (0-1)

#### New Configuration
- `weights.feedback`: Weight for positive feedback (default: 0.10)
- `weights.negativeSignal`: Weight for negative signal (default: 0.02)
- `weights.interaction`: Weight for click/view interactions (default: 0.02)
- `feedbackBoost`: Multiplier for liked anime similarity (default: 0.3)
- `negativePenalty`: Multiplier for disliked anime similarity (default: 0.4)
- `clickBoost`: Boost for clicked anime (default: 0.15)
- `viewBoost`: Boost for viewed anime (default: 0.2)

### 🗑️ Removed Features

- **VA Matching**: Removed `enableVAMatching` from UserPreferences (never implemented, avoided complexity)

### 📁 New Files

- `feedback.ts`: Feedback and interaction data loader
  - `loadUserFeedbacks()`: Loads likes/dislikes from storage
  - `loadUserInteractions()`: Loads clicks/views/impressions
  - `saveClick()`, `saveView()`, `saveImpression()`: Save interactions
  - Compatible with V2 storage format: `netrec:feedback:${userId}:${animeId}`

### 📊 Updated Weights

Weights rebalanced to accommodate new features:
```typescript
weights: {
  cf: 0.40,              // Was: 0.45
  content: 0.30,         // Was: 0.35
  freshness: 0.08,       // Was: 0.10
  relations: 0.08,       // Was: 0.10
  feedback: 0.10,        // NEW
  negativeSignal: 0.02,  // NEW
  interaction: 0.02,     // NEW
}
```

### 🎯 Expected Impact

**Phase 1 Results:**
- V3: 4 Sehr Interessant, 6 Interessant, 0 Nicht Interessant, 1 Ausreißer
- V2: 2 Sehr Interessant, 8 Interessant, 1 Nicht Interessant, 1 Unentschlossen

**Phase 2 Goals:**
- 6-7 Sehr Interessant (↑50%)
- 5-4 Interessant (↓20%)
- 0 Nicht Interessant (stable)
- 0 Ausreißer (↓100%)

**How Phase 2 Achieves This:**
1. **Negative Signal Learning** eliminates "Ausreißer" by avoiding anime similar to dislikes
2. **Positive Feedback Boost** pushes "Interessant" → "Sehr Interessant" by favoring user preferences
3. **Click/View Tracking** learns what visually attracts the user

### 🔧 API Compatibility

- Fully backwards compatible with V2 feedback storage
- No breaking changes to public API
- `UserProfile` extends with optional `feedbacks` and `interactions`

### 🚀 Performance

- Rate limiting prevents API spam (90 req/min with backoff)
- Caching reduces redundant requests (24h TTL)
- Request deduplication prevents parallel duplicate queries

---

## Version 3.0.0 - Phase 1 (2024-12-19)

### Initial Release
- Multi-engine architecture (CF + Content-Based + Trending + Relations)
- MMR diversity re-ranking
- Smart explanations (spoiler-free)
- TF-IDF vector similarity
- Comprehensive feature engineering
