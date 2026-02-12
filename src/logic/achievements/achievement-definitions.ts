// Achievement Definitions
import type { AchievementDefinition } from './achievement-types';

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ============================================================================
  // WATCHING ACHIEVEMENTS
  // ============================================================================
  {
    id: 'first_complete',
    name: 'First Blood',
    description: 'Complete your first anime',
    icon: '🎯',
    category: 'watching',
    requirement: { type: 'count', target: 1 },
  },
  {
    id: 'ten_complete',
    name: 'Seasoned Watcher',
    description: 'Complete 10 anime',
    icon: '🏅',
    category: 'watching',
    requirement: { type: 'count', target: 10 },
  },
  {
    id: 'fifty_complete',
    name: 'Dedicated Fan',
    description: 'Complete 50 anime',
    icon: '🌟',
    category: 'watching',
    requirement: { type: 'count', target: 50 },
  },
  {
    id: 'hundred_complete',
    name: 'Veteran',
    description: 'Complete 100 anime',
    icon: '🏆',
    category: 'watching',
    requirement: { type: 'count', target: 100 },
  },
  {
    id: 'two_hundred_complete',
    name: 'Anime Connoisseur',
    description: 'Complete 200 anime',
    icon: '👑',
    category: 'watching',
    requirement: { type: 'count', target: 200 },
  },
  {
    id: 'binge_12',
    name: 'Binge Starter',
    description: 'Watch 12+ episodes in a single day',
    icon: '⚡',
    category: 'watching',
    requirement: { type: 'count', target: 12 },
  },
  {
    id: 'binge_24',
    name: 'Marathon Runner',
    description: 'Watch 24+ episodes in a single day',
    icon: '🔥',
    category: 'watching',
    requirement: { type: 'count', target: 24 },
  },
  {
    id: 'binge_48',
    name: 'Sleep is Optional',
    description: 'Watch 48+ episodes in a single day',
    icon: '💀',
    category: 'watching',
    requirement: { type: 'count', target: 48 },
    hidden: true,
  },

  // ============================================================================
  // GENRE ACHIEVEMENTS
  // ============================================================================
  {
    id: 'mecha_3',
    name: 'Robot Enthusiast',
    description: 'Complete 3 Mecha anime',
    icon: '🤖',
    category: 'genre',
    requirement: { type: 'genre', target: 3, genreName: 'Mecha' },
  },
  {
    id: 'mecha_10',
    name: 'Mecha Pilot',
    description: 'Complete 10 Mecha anime',
    icon: '🚀',
    category: 'genre',
    requirement: { type: 'genre', target: 10, genreName: 'Mecha' },
  },
  {
    id: 'horror_5',
    name: 'Fearless',
    description: 'Complete 5 Horror anime',
    icon: '👻',
    category: 'genre',
    requirement: { type: 'genre', target: 5, genreName: 'Horror' },
  },
  {
    id: 'romance_10',
    name: 'Hopeless Romantic',
    description: 'Complete 10 Romance anime',
    icon: '💕',
    category: 'genre',
    requirement: { type: 'genre', target: 10, genreName: 'Romance' },
  },
  {
    id: 'action_15',
    name: 'Action Hero',
    description: 'Complete 15 Action anime',
    icon: '💥',
    category: 'genre',
    requirement: { type: 'genre', target: 15, genreName: 'Action' },
  },
  {
    id: 'comedy_10',
    name: 'Comedy King',
    description: 'Complete 10 Comedy anime',
    icon: '😂',
    category: 'genre',
    requirement: { type: 'genre', target: 10, genreName: 'Comedy' },
  },
  {
    id: 'slice_of_life_10',
    name: 'Chill Vibes',
    description: 'Complete 10 Slice of Life anime',
    icon: '🍵',
    category: 'genre',
    requirement: { type: 'genre', target: 10, genreName: 'Slice of Life' },
  },
  {
    id: 'variety_10',
    name: 'Genre Explorer',
    description: 'Complete anime from 10 different genres',
    icon: '🌈',
    category: 'genre',
    requirement: { type: 'custom', target: 10 },
  },
  {
    id: 'psychological_5',
    name: 'Mind Bender',
    description: 'Complete 5 Psychological anime',
    icon: '🧠',
    category: 'genre',
    requirement: { type: 'genre', target: 5, genreName: 'Psychological' },
  },
  {
    id: 'sports_5',
    name: 'Sports Fan',
    description: 'Complete 5 Sports anime',
    icon: '🏀',
    category: 'genre',
    requirement: { type: 'genre', target: 5, genreName: 'Sports' },
  },

  // ============================================================================
  // STREAK ACHIEVEMENTS
  // ============================================================================
  {
    id: 'daily_3',
    name: 'Getting Started',
    description: 'Watch anime 3 days in a row',
    icon: '📆',
    category: 'streak',
    requirement: { type: 'streak', target: 3 },
  },
  {
    id: 'daily_7',
    name: 'Week Warrior',
    description: 'Watch anime 7 days in a row',
    icon: '📅',
    category: 'streak',
    requirement: { type: 'streak', target: 7 },
  },
  {
    id: 'daily_14',
    name: 'Two Week Champion',
    description: 'Watch anime 14 days in a row',
    icon: '🔥',
    category: 'streak',
    requirement: { type: 'streak', target: 14 },
  },
  {
    id: 'daily_30',
    name: 'Monthly Master',
    description: 'Watch anime 30 days in a row',
    icon: '🗓️',
    category: 'streak',
    requirement: { type: 'streak', target: 30 },
  },
  {
    id: 'daily_100',
    name: 'Centurion',
    description: 'Watch anime 100 days in a row',
    icon: '💯',
    category: 'streak',
    requirement: { type: 'streak', target: 100 },
    hidden: true,
  },
  {
    id: 'app_daily_7',
    name: 'Loyal User',
    description: 'Open ShokaiShelf 7 days in a row',
    icon: '💙',
    category: 'streak',
    requirement: { type: 'streak', target: 7 },
  },
  {
    id: 'app_daily_30',
    name: 'Dedicated User',
    description: 'Open ShokaiShelf 30 days in a row',
    icon: '💎',
    category: 'streak',
    requirement: { type: 'streak', target: 30 },
  },

  // ============================================================================
  // SPECIAL ACHIEVEMENTS
  // ============================================================================
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Watch 10 episodes after 23:00',
    icon: '🦉',
    category: 'special',
    requirement: { type: 'time', target: 10, timeRange: { start: 23, end: 5 } },
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Watch 10 episodes before 07:00',
    icon: '🐦',
    category: 'special',
    requirement: { type: 'time', target: 10, timeRange: { start: 4, end: 7 } },
  },
  {
    id: 'perfectionist_5',
    name: 'High Standards',
    description: 'Give 5 anime a perfect 10/10 score',
    icon: '⭐',
    category: 'special',
    requirement: { type: 'count', target: 5 },
  },
  {
    id: 'perfectionist_10',
    name: 'Perfectionist',
    description: 'Give 10 anime a perfect 10/10 score',
    icon: '✨',
    category: 'special',
    requirement: { type: 'count', target: 10 },
  },
  {
    id: 'explorer_5',
    name: 'Hidden Gem Hunter',
    description: 'Complete 5 anime with less than 10k popularity',
    icon: '💎',
    category: 'special',
    requirement: { type: 'count', target: 5 },
  },
  {
    id: 'explorer_10',
    name: 'Indie Connoisseur',
    description: 'Complete 10 anime with less than 10k popularity',
    icon: '🔮',
    category: 'special',
    requirement: { type: 'count', target: 10 },
  },
  {
    id: 'new_year',
    name: 'New Year, New Anime',
    description: 'Complete an anime on New Year\'s Day',
    icon: '🎆',
    category: 'special',
    requirement: { type: 'custom', target: 1 },
    hidden: true,
  },
  {
    id: 'christmas_watch',
    name: 'Holiday Spirit',
    description: 'Watch anime on Christmas Day',
    icon: '🎄',
    category: 'special',
    requirement: { type: 'custom', target: 1 },
    hidden: true,
  },
];

// Helper to get achievement by ID
export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// Helper to get achievements by category
export function getAchievementsByCategory(category: string): AchievementDefinition[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}
