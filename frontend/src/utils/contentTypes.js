export const CONTENT_TYPES = [
  { value: 'blog',                label: 'Blog Post', icon: '📝', placeholder: 'Write a blog post about the benefits of remote work for software engineers...' },
  { value: 'ad',                  label: 'Ad Copy',   icon: '📢', placeholder: 'Create an ad for a new fitness app targeting busy professionals aged 25–40...' },
  { value: 'caption',             label: 'Caption',   icon: '📸', placeholder: 'Instagram caption for a sunset beach photo with a motivational vibe...' },
  { value: 'product_description', label: 'Product',   icon: '🛍️', placeholder: 'Wireless noise-cancelling headphones with 30hr battery and premium sound...' },
  { value: 'email',               label: 'Email',     icon: '📧', placeholder: 'Follow-up email after a job interview at a tech startup, expressing enthusiasm...' },
  { value: 'tagline',             label: 'Tagline',   icon: '💡', placeholder: 'Tagline for an eco-friendly reusable water bottle brand targeting Gen Z...' },
];

export const TONES = [
  { value: 'professional', label: 'Professional', emoji: '💼' },
  { value: 'casual',       label: 'Casual',       emoji: '😊' },
  { value: 'marketing',    label: 'Marketing',    emoji: '🚀' },
  { value: 'funny',        label: 'Funny',        emoji: '😄' },
  { value: 'formal',       label: 'Formal',       emoji: '🎩' },
];

export const LENGTHS = [
  { value: 'short',  label: 'Short',  desc: '~100 words',  icon: '⚡' },
  { value: 'medium', label: 'Medium', desc: '~300 words',  icon: '📄' },
  { value: 'long',   label: 'Long',   desc: '~600 words',  icon: '📖' },
];

export const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese',
  'Italian', 'Dutch', 'Polish', 'Russian', 'Turkish',
  'Arabic', 'Hebrew', 'Hindi', 'Bengali', 'Urdu',
  'Japanese', 'Chinese', 'Korean', 'Thai', 'Vietnamese',
  'Indonesian', 'Malay', 'Swahili', 'Greek', 'Swedish',
];

// Normalised set for client-side validation (lowercase)
export const LANGUAGES_SET = new Set(LANGUAGES.map((l) => l.toLowerCase()));

export const typeIcon        = (type) => CONTENT_TYPES.find((t) => t.value === type)?.icon        ?? '📄';
export const typeLabel       = (type) => CONTENT_TYPES.find((t) => t.value === type)?.label       ?? type;
export const typePlaceholder = (type) => CONTENT_TYPES.find((t) => t.value === type)?.placeholder ?? 'Describe what you want to generate...';
