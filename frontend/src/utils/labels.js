/**
 * UI Labels — single source of truth for all user-facing strings.
 * Swap this file's values for a translation object to add i18n support.
 */

export const LABELS = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    generate:  'Generate',
    history:   'History',
    pricing:   'Pricing',
    account:   'Account',
    signOut:   'Sign out',
  },

  // Auth
  auth: {
    login:           'Sign In',
    register:        'Create Account',
    emailPlaceholder: 'you@example.com',
    passwordPlaceholder: 'Min. 6 characters',
    forgotPassword:  'Forgot password?',
    noAccount:       "Don't have an account?",
    hasAccount:      'Already have an account?',
  },

  // Generator
  generator: {
    title:          'AI Content Generator',
    subtitle:       'Generate high-quality content in seconds with AI',
    contentType:    'Content Type',
    tone:           'Tone',
    length:         'Length',
    language:       'Language',
    keywords:       'Keywords',
    keywordsHint:   '(optional, comma-separated)',
    yourPrompt:     'Your Prompt',
    generateBtn:    '✨ Generate Content',
    generating:     'Generating...',
    noCredits:      '🚫 No credits —',
    upgrade:        'Upgrade',
    redoBtn:        '🔄 Redo',
    copyBtn:        '📋 Copy',
    copiedBtn:      '✅ Copied!',
    txtBtn:         '📄 TXT',
    pdfBtn:         '📑 PDF',
    outputTitle:    'Generated Content',
    readyTitle:     'Ready to generate',
    readySubtitle:  'Choose a type, set your options, write your prompt, and hit Generate.',
    recentTitle:    'Recent Generations',
    cachedBadge:    '⚡ Cached',
    aiBadge:        '🤖 AI Generated',
    fallbackBadge:  '⚙️ Fallback Generated',
    fallbackWarning: 'AI service unavailable — showing a structured basic result. Check your API key or try again later.',
    creditPerGen:   '1 credit per generation',
    creditsLeft:    'left',
    abModeLabel:    'A/B Mode',
    abModeHint:     'Generate 2 variations (costs 2 credits)',
    variantA:       'Variant A',
    variantB:       'Variant B',
    selectVariant:  'Select this version',
    templatePicker: 'Use a Template',
  },

  // Dashboard
  dashboard: {
    greeting:       (name, time) => `Good ${time}, ${name}! 👋`,
    subtitle:       "Here's your content overview for today",
    newContent:     '✨ New Content',
    totalContent:   'Total Content',
    usedToday:      'Used Today',
    totalGens:      'Total Generations',
    currentPlan:    'Current Plan',
    allTime:        'All time',
    lifetime:       'Lifetime',
    upgradeNow:     'Upgrade Now →',
    dailyCredits:   'Daily Credits',
    activity7d:     '7-Day Activity',
    breakdown:      'Content Breakdown',
    credits14d:     'Credits Used — Last 14 Days',
    creditsTrend:   'Daily credit consumption trend',
    recentActivity: 'Recent Activity',
    viewAll:        'View all →',
    quickGenerate:  'Quick Generate',
    noActivity:     'No content yet. Start generating!',
    generateNow:    '✨ Generate Now',
    upgradePrompt:  '🚀 Unlock Premium — 100 generations/day',
  },

  // History
  history: {
    title:          'Content History',
    searchPlaceholder: 'Search prompts or content...',
    allTypes:       'All Types',
    favorites:      '⭐ Favorites',
    noFavorites:    'No favorites yet',
    noContent:      'No content found',
    starHint:       'Star content to save it here',
    filterHint:     'Try adjusting your search or filters',
    showMore:       '▼ Show full content',
    showLess:       '▲ Show less',
    deleteConfirm:  (type) => `Delete this ${type}? This cannot be undone.`,
    deleted:        'Deleted successfully',
    copied:         'Copied to clipboard!',
    words:          'words',
  },

  // Errors
  errors: {
    generationFailed:  'Generation failed. Please try again.',
    creditLimit:       'Daily credit limit reached. Upgrade to Premium!',
    copyFailed:        'Copy failed — please select and copy manually.',
    loadFailed:        'Failed to load. Please refresh.',
    deleteFailed:      'Delete failed. Please try again.',
    networkError:      'Network error. Check your connection.',
    serverError:       'Something went wrong on our end. Please try again.',
  },

  // Toasts
  toasts: {
    generated:      'Content generated! ✨',
    cached:         '⚡ Returned from cache — no credit used!',
    copied:         'Copied to clipboard!',
    downloaded:     'Downloaded as TXT!',
    pdfOpening:     'Opening print dialog for PDF...',
    favoriteAdded:  '⭐ Added to favorites',
    favoriteRemoved: 'Removed from favorites',
    noCredits:      '⚡ No credits remaining today. Upgrade to Premium for more!',
  },
};

export default LABELS;
