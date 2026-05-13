/**
 * Advanced Fallback Content Generator
 * - Multiple templates per type (randomly selected to avoid repetition)
 * - Synonym replacement engine
 * - Shuffled section ordering for blogs
 * - Natural keyword weaving (not forced appending)
 * - Full tone × type × length support
 */

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Pick a random element from an array */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Shuffle array in-place (Fisher-Yates) and return it */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Synonym dictionary ───────────────────────────────────────────────────────

const SYNONYMS = {
  important:   ['essential', 'critical', 'vital', 'significant', 'key'],
  improve:     ['enhance', 'elevate', 'boost', 'strengthen', 'advance'],
  use:         ['leverage', 'utilise', 'apply', 'employ', 'harness'],
  good:        ['excellent', 'outstanding', 'superior', 'remarkable', 'exceptional'],
  help:        ['support', 'assist', 'enable', 'empower', 'facilitate'],
  show:        ['demonstrate', 'reveal', 'highlight', 'illustrate', 'showcase'],
  get:         ['obtain', 'achieve', 'gain', 'acquire', 'secure'],
  make:        ['create', 'build', 'craft', 'develop', 'produce'],
  need:        ['require', 'demand', 'call for', 'necessitate', 'depend on'],
  start:       ['begin', 'initiate', 'launch', 'kick off', 'embark on'],
  change:      ['transform', 'reshape', 'redefine', 'revolutionise', 'shift'],
  people:      ['individuals', 'professionals', 'teams', 'organisations', 'users'],
  results:     ['outcomes', 'achievements', 'impact', 'performance', 'success'],
  approach:    ['strategy', 'method', 'framework', 'technique', 'process'],
  understand:  ['grasp', 'recognise', 'appreciate', 'comprehend', 'realise'],
};

/** Replace common words with synonyms for variation */
function applySynonyms(text) {
  return Object.entries(SYNONYMS).reduce((t, [word, syns]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return t.replace(regex, (match) => {
      if (Math.random() > 0.4) return match;
      const syn = pick(syns);
      return match[0] === match[0].toUpperCase()
        ? syn.charAt(0).toUpperCase() + syn.slice(1)
        : syn;
    });
  }, text);
}

function normalizePrompt(value) {
  return String(value || '').trim();
}

function normalizeKeywords(keywords) {
  return Array.isArray(keywords)
    ? keywords.map((k) => String(k || '').trim()).filter(Boolean)
    : [];
}

function buildKeywordPhrase(keywords) {
  const normalized = normalizeKeywords(keywords);
  if (!normalized.length) return '';
  const unique = [...new Set(normalized)];
  return unique.length === 1
    ? unique[0]
    : unique.slice(0, 3).join(', ');
}

/** Weave keywords naturally into a sentence */
function weaveKeywords(sentence, keywords) {
  const normalized = normalizeKeywords(keywords);
  if (!normalized.length) return sentence;
  const kw = pick(normalized);
  const patterns = [
    `${sentence} This is especially relevant when considering ${kw}.`,
    `${sentence} A key focus here is ${kw}.`,
    `When it comes to ${kw}, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
    `${sentence} — particularly in the context of ${kw}.`,
    `${sentence} ${kw} plays an important role here.`,
  ];
  return pick(patterns);
}

// ─── Tone-aware phrase banks (3+ variants each) ───────────────────────────────

const INTROS = {
  professional: [
    (t) => `In today's competitive landscape, ${t} has emerged as a decisive factor for sustained organisational success.`,
    (t) => `Organisations that prioritise ${t} consistently outperform those that treat it as an afterthought.`,
    (t) => `The strategic importance of ${t} cannot be overstated in an era defined by rapid change and disruption.`,
  ],
  casual: [
    (t) => `Let's talk about ${t} — it's something a lot of people are genuinely curious about right now.`,
    (t) => `So you want to know more about ${t}? You've come to the right place.`,
    (t) => `${t} is one of those topics that keeps coming up, and honestly, it's worth paying attention to.`,
  ],
  marketing: [
    (t) => `Discover how ${t} is transforming the way people achieve their goals — faster and smarter than ever before.`,
    (t) => `What if ${t} could completely change the way you work, create, and grow? It already is.`,
    (t) => `The brands winning right now all have one thing in common: they've mastered ${t}.`,
  ],
  funny: [
    (t) => `So, ${t} walks into a room and everyone immediately pays attention. Sounds familiar? It should.`,
    (t) => `Nobody woke up this morning thinking "today I'll finally understand ${t}" — and yet, here we are.`,
    (t) => `${t}: the thing your boss keeps mentioning in meetings and you keep nodding along to. Let's fix that.`,
  ],
  formal: [
    (t) => `This document presents a structured examination of ${t} and its broader implications for practitioners.`,
    (t) => `The following analysis addresses the principal dimensions of ${t} with reference to established frameworks.`,
    (t) => `A comprehensive understanding of ${t} requires careful consideration of both theoretical and applied perspectives.`,
  ],
};

const CONCLUSIONS = {
  professional: [
    'By applying these principles consistently, organisations can achieve measurable, compounding improvements over time.',
    'The path forward is clear: invest in the right foundations, measure outcomes rigorously, and iterate with purpose.',
    'Success in this area is not accidental — it is the result of deliberate strategy and disciplined execution.',
  ],
  casual: [
    "And that's really the bottom line — give it a shot and see what works for you. You might be surprised.",
    "The best part? You don't need to be an expert to get started. Just take the first step.",
    "So there you have it. Not as complicated as it sounds, right? Now go make it happen.",
  ],
  marketing: [
    'Take action today and experience the difference for yourself. The results speak for themselves.',
    "Don't wait for the perfect moment — the perfect moment is now. Your competition isn't waiting.",
    'Every day you delay is a day your competitors get ahead. Start your journey today.',
  ],
  funny: [
    "In conclusion: don't overthink it. Just do the thing. Your future self will thank you (probably).",
    "And if all else fails, at least you'll have a great story to tell at the next team meeting.",
    "The moral of the story? Everything is figure-out-able. Especially this. You've got this.",
  ],
  formal: [
    'In conclusion, the evidence supports a deliberate and methodical approach to this subject matter.',
    'The foregoing analysis demonstrates the necessity of a structured, evidence-based approach.',
    'It is recommended that practitioners adopt the frameworks outlined herein as a basis for further inquiry.',
  ],
};

const HOOKS = {
  professional: [
    (t) => `Unlock the full potential of ${t} with a proven, results-driven approach that delivers measurable ROI.`,
    (t) => `Leading organisations are using ${t} to gain a decisive competitive edge. Here's how.`,
    (t) => `The difference between good and great often comes down to how well you leverage ${t}.`,
  ],
  casual: [
    (t) => `${t} just got a whole lot easier — and we're here to show you exactly how.`,
    (t) => `Tired of making ${t} harder than it needs to be? Same. That's why we built this.`,
    (t) => `Real talk: ${t} doesn't have to be complicated. Let us prove it.`,
  ],
  marketing: [
    (t) => `⚡ Stop struggling with ${t}. There's a smarter, faster, better way.`,
    (t) => `🔥 ${t} is the growth lever you've been overlooking. Not anymore.`,
    (t) => `The #1 reason businesses fail at ${t}? They don't have the right tools. We fixed that.`,
  ],
  funny: [
    (t) => `Warning: ${t} may cause excessive productivity, uncontrollable success, and mild smugness.`,
    (t) => `${t}: because doing things the hard way is so last decade.`,
    (t) => `Scientists confirm: people who use ${t} correctly are 73% more likely to look like they know what they're doing.*\n*Statistic entirely made up. Results may vary.`,
  ],
  formal: [
    (t) => `${t} represents a significant advancement in its respective domain, warranting careful scholarly attention.`,
    (t) => `The emergence of ${t} as a primary consideration reflects broader shifts in professional practice.`,
    (t) => `A rigorous examination of ${t} reveals both its theoretical foundations and practical applications.`,
  ],
};

const CTA = {
  professional: [
    'Contact our team to learn how we can help you achieve your strategic objectives.',
    'Schedule a consultation today and take the first step toward measurable results.',
    'Reach out to discuss how this approach can be tailored to your specific context.',
  ],
  casual: [
    'Give it a try — you might be surprised by the results!',
    "Seriously, just start. You'll figure it out as you go.",
    "What are you waiting for? Jump in — the water's fine.",
  ],
  marketing: [
    '🚀 Get started FREE today — limited spots available!',
    '👉 Claim your free trial now. No credit card required.',
    '⏰ Special offer ends soon — act now before it\'s gone!',
  ],
  funny: [
    "Click the button. You know you want to. We won't judge.",
    "Go on. Do it. Your future self is already thanking you.",
    "The button isn't going to click itself. (We checked.)",
  ],
  formal: [
    'We invite you to review the accompanying documentation for further details.',
    'Interested parties are encouraged to submit a formal enquiry at their earliest convenience.',
    'Please refer to the supplementary materials for a comprehensive overview of available options.',
  ],
};

const TESTIMONIALS = [
  (t) => `"This completely changed how we approach ${t}." — Verified Customer`,
  (t) => `"I wish I'd discovered ${t} sooner. The impact has been remarkable." — Happy User`,
  (t) => `"We saw results within the first week of implementing ${t}." — Business Owner`,
  (t) => `"${t} is now a core part of our workflow. Can't imagine going back." — Team Lead`,
];

// ─── Blog section templates ───────────────────────────────────────────────────

function getBlogSections(topic, tone, keywords, length, wordCount) {
  const allSections = [
    {
      heading: 'Why It Matters',
      body: applySynonyms(weaveKeywords(
        `Understanding ${topic} can fundamentally change how you approach challenges in your field. The organisations and individuals who get this right consistently outperform those who don't.`,
        keywords
      )),
    },
    {
      heading: 'Key Benefits',
      body: applySynonyms(weaveKeywords(
        `Exploring ${topic} reveals numerous advantages that can be applied immediately. From improved efficiency to stronger outcomes, the benefits compound over time.`,
        keywords
      )),
    },
    {
      heading: 'Common Challenges',
      body: applySynonyms(
        `Like any worthwhile pursuit, ${topic} comes with its own set of obstacles. The most common pitfalls include lack of consistency, unclear goals, and insufficient measurement. Knowing these in advance puts you ahead of the curve.`
      ),
    },
    {
      heading: 'Best Practices',
      body: applySynonyms(weaveKeywords(
        `Experts consistently recommend a structured, iterative approach. Start with clear objectives, measure your progress at regular intervals, and adapt based on what the data tells you.`,
        keywords
      )),
    },
    {
      heading: 'Getting Started',
      body: applySynonyms(
        `The barrier to entry is lower than most people think. Begin with a focused pilot, gather feedback early, and scale what works. The first step is always the hardest — but also the most important.`
      ),
    },
    {
      heading: 'Advanced Strategies',
      body: applySynonyms(weaveKeywords(
        `Once you've mastered the fundamentals, there's a whole layer of advanced techniques available. These strategies separate practitioners from true experts and unlock compounding returns.`,
        keywords
      )),
    },
  ];

  const count = wordCount
    ? (wordCount < 150 ? 1 : wordCount < 400 ? 2 : wordCount < 700 ? 3 : 5)
    : (length === 'short' ? 2 : length === 'long' ? 5 : 3);
  // Shuffle middle sections for variation, always keep first two as anchors
  const anchors = allSections.slice(0, 2);
  const rest = shuffle(allSections.slice(2));
  return [...anchors, ...rest].slice(0, count);
}

// ─── Per-type generators ──────────────────────────────────────────────────────

function generateBlog(prompt, tone, keywords, length, wordCount) {
  const topic      = normalizePrompt(prompt);
  const intro      = pick(INTROS[tone] ?? INTROS.professional)(topic);
  const conclusion = pick(CONCLUSIONS[tone] ?? CONCLUSIONS.professional);
  const sections   = getBlogSections(topic, tone, keywords, length, wordCount);
  const keywordLine = buildKeywordPhrase(keywords);

  const parts = [
    `# ${topic}`,
    '',
    applySynonyms(intro),
    keywordLine ? `
**Focus keywords:** ${keywordLine}
` : '',
    '',
    ...sections.flatMap((s) => [`## ${s.heading}`, '', s.body, '']),
    '## Conclusion',
    '',
    conclusion,
  ].filter(Boolean);

  return parts.join('\n');
}

/** Extract a short topic label from a potentially long prompt */
function extractTopic(prompt) {
  const p = normalizePrompt(prompt);
  // Use first 5 words max as the topic label
  return p.split(/\s+/).slice(0, 5).join(' ').replace(/[.!?]$/, '');
}

const AD_BENEFITS = {
  marketing: [
    ['🌟 Instantly boosts confidence', '💧 Deep hydration that lasts all day', '✨ Visibly glowing skin in days'],
    ['🔥 Fast-acting formula', '🎯 Targets problem areas directly', '💎 Dermatologist-tested & approved'],
    ['⚡ Results you can see & feel', '🌿 100% natural ingredients', '🏆 #1 rated by real customers'],
  ],
  professional: [
    ['✅ Clinically proven formula', '✅ Suitable for all skin types', '✅ Dermatologist recommended'],
    ['✅ Visible results in 7 days', '✅ Free from harmful chemicals', '✅ Backed by 10,000+ reviews'],
  ],
  casual: [
    ['💛 Actually works (no cap)', '🙌 Super easy to use daily', '😍 Your skin will thank you'],
    ['✨ Feels amazing on skin', '💧 Lightweight & non-greasy', '🌸 Smells incredible too'],
  ],
  funny: [
    ['😂 So good it should be illegal', '💅 Your skin, but make it extra', '🏆 Dermatologists hate this one trick'],
  ],
  formal: [
    ['✅ Formulated with precision', '✅ Independently verified efficacy', '✅ Compliant with industry standards'],
  ],
};

function generateAd(prompt, tone, keywords) {
  const topic      = extractTopic(prompt);
  const headline   = applySynonyms(pick(HOOKS[tone] ?? HOOKS.marketing)(topic));
  const ctaText    = pick(CTA[tone] ?? CTA.marketing);
  const testimonial = pick(TESTIMONIALS)(topic);
  const benefitPool = AD_BENEFITS[tone] ?? AD_BENEFITS.marketing;
  const benefits   = pick(benefitPool);
  const keywordLine = buildKeywordPhrase(keywords);

  return [
    `**${headline}**`,
    '',
    benefits.join('\n'),
    keywordLine ? `\n🔑 Key focus: ${keywordLine}` : '',
    '',
    testimonial,
    '',
    `👉 ${ctaText}`,
  ].filter(Boolean).join('\n');
}

function generateCaption(prompt, tone, keywords) {
  const phraseSets = {
    professional: [
      `Elevating the conversation around ${prompt}. Excellence isn't accidental — it's intentional. 💼`,
      `${prompt}: where strategy meets execution. The results follow naturally. 📈`,
      `Committed to raising the standard in ${prompt}. Every detail matters. ✨`,
    ],
    casual: [
      `Obsessed with ${prompt} right now ✨ Who else? Drop a comment below 👇`,
      `${prompt} hits different when you actually understand it 😌 Sharing this for the people in the back.`,
      `Can we talk about ${prompt} for a second? Because it's genuinely underrated 🙌`,
    ],
    marketing: [
      `🔥 ${prompt} is changing the game. Are you ready to level up?`,
      `The secret weapon behind every successful brand? ${prompt}. 🚀 Don't sleep on this.`,
      `${prompt} isn't just a trend — it's the future. Get ahead of it now. ⚡`,
    ],
    funny: [
      `Me: I'll just look into ${prompt} for 5 minutes.\nAlso me, 3 hours later: 👀`,
      `${prompt} said "hold my coffee" and proceeded to change everything 😂`,
      `Nobody:\nAbsolutely nobody:\nMe at 2am: *deep diving into ${prompt}* 🌙`,
    ],
    formal: [
      `A thoughtful exploration of ${prompt} and its broader significance in contemporary practice.`,
      `The implications of ${prompt} extend well beyond surface-level analysis. A considered perspective follows.`,
      `Presenting a structured overview of ${prompt} for the benefit of informed practitioners.`,
    ],
  };

  const phrase = pick(phraseSets[tone] ?? phraseSets.professional);
  const baseTags = keywords?.length
    ? keywords.map((k) => `#${k.replace(/\s+/g, '')}`).join(' ')
    : `#${prompt.replace(/\s+/g, '')} #Content #Trending #Growth`;

  return `${phrase}\n\n${baseTags}`;
}

function generateProductDescription(prompt, tone, keywords) {
  const openerSets = {
    professional: [
      `Introducing **${prompt}** — engineered for performance and built to exceed expectations.`,
      `**${prompt}** sets a new benchmark for quality, reliability, and results-driven design.`,
      `Meet **${prompt}**: the professional-grade solution trusted by industry leaders worldwide.`,
    ],
    casual: [
      `Meet **${prompt}** — your new favourite thing. Seriously, where has this been all your life?`,
      `**${prompt}** is here and honestly? It's kind of a big deal. In the best way.`,
      `We made **${prompt}** for people who are tired of settling. You're welcome.`,
    ],
    marketing: [
      `🌟 **${prompt}** — The product you didn't know you needed until right now.`,
      `**${prompt}**: Stop scrolling. This is the one. 🔥`,
      `Introducing **${prompt}** — the upgrade your life has been waiting for. ⚡`,
    ],
    funny: [
      `**${prompt}**: Because mediocre alternatives have had their time in the spotlight. It's over now.`,
      `We asked ourselves: what would happen if we made **${prompt}** actually good? This happened.`,
      `**${prompt}** — Scientifically proven to be better than whatever you're using now.*\n*Not actually scientifically proven. But still.`,
    ],
    formal: [
      `**${prompt}** is a premium offering designed to meet the highest standards of quality and performance.`,
      `The **${prompt}** has been developed in accordance with rigorous quality assurance protocols.`,
      `**${prompt}** represents the culmination of extensive research and development in its category.`,
    ],
  };

  const featureSets = [
    ['• Premium quality construction', '• Intuitive, user-friendly design', '• Built for durability and long-term value', '• Backed by our satisfaction guarantee'],
    ['• Precision-engineered components', '• Seamless out-of-the-box experience', '• Designed to last — not just to impress', '• 30-day money-back guarantee'],
    ['• Crafted from superior materials', '• Thoughtfully designed for real-world use', '• Rigorously tested for reliability', '• Supported by our dedicated customer team'],
  ];

  const opener   = pick(openerSets[tone] ?? openerSets.professional);
  const features = pick(featureSets);
  const kwLine   = keywords?.length
    ? `\nIdeal for: ${keywords.slice(0, 4).join(', ')}.`
    : '';

  return [
    applySynonyms(opener),
    '',
    features.join('\n'),
    kwLine,
    '',
    applySynonyms(`Join thousands of satisfied customers who have made ${prompt} an essential part of their daily routine.`),
  ].join('\n');
}

function generateEmail(prompt, tone, keywords) {
  const topic      = normalizePrompt(prompt);
  const subjectSets = {
    professional: [
      `Re: ${topic} — Proposed Next Steps`,
      `Following Up: ${topic} — Action Required`,
      `${topic} — A Brief but Important Update`,
    ],
    casual: [
      `Hey! Quick note about ${topic} 👋`,
      `Thought you'd want to know about ${topic}`,
      `${topic} — just wanted to loop you in`,
    ],
    marketing: [
      `🚀 You won't want to miss this — ${topic}`,
      `[Important] ${topic} — Act Before It's Gone`,
      `This changes everything about ${topic} ⚡`,
    ],
    funny: [
      `This email is about ${topic} (please don't delete it, I worked hard on it)`,
      `${topic}: An email you'll actually want to read (bold claim, I know)`,
      `Re: ${topic} — I promise this is worth 90 seconds of your time`,
    ],
    formal: [
      `Formal Communication Regarding: ${topic}`,
      `Official Correspondence: ${topic} — For Your Consideration`,
      `Notice of Update: ${topic}`,
    ],
  };

  const greetings = {
    professional: 'Dear [Name],',
    casual:       'Hey [Name],',
    marketing:    'Hi [Name],',
    funny:        'Greetings, fellow human [Name],',
    formal:       'To Whom It May Concern,',
  };

  const bodySets = [
    `I'm reaching out regarding ${topic}. We've been making meaningful progress and I wanted to keep you informed before the next step.`,
    `I hope this message finds you well. I wanted to connect about ${topic} because there are some useful updates worth reviewing.`,
    `Thank you for your continued interest. I’m sharing a concise update on ${topic} that should help clarify the path forward.`,
  ];

  const closingLines = {
    professional: `Please let me know your availability for a brief follow-up discussion.\n\nBest regards,\n[Your Name]`,
    casual:       `Let me know if you'd like to chat more about this.\n\nCheers,\n[Your Name]`,
    marketing:    `If you're interested, let's schedule a quick call to explore how this can work for you.\n\nTo your success,\n[Your Name]`,
    funny:        `If this sounds good, let's make it happen — no smoke and mirrors.\n\nYours in perpetual optimism,\n[Your Name]`,
    formal:       `I look forward to your response and the opportunity to discuss this further.\n\nYours sincerely,\n[Your Name]`,
  };

  const subject  = pick(subjectSets[tone] ?? subjectSets.professional);
  const body     = applySynonyms(weaveKeywords(pick(bodySets), keywords));
  const closing  = closingLines[tone] ?? closingLines.professional;
  const keywordPhrase = buildKeywordPhrase(keywords);

  return [
    `Subject: ${subject}`,
    '',
    greetings[tone] ?? greetings.professional,
    '',
    body,
    '',
    keywordPhrase ? `Key focus areas: ${keywordPhrase}` : '',
    '',
    applySynonyms("I'd love to connect and explore this further. Please let me know your availability for a brief conversation."),
    '',
    closing,
  ].filter(Boolean).join('\n');
}

function generateTagline(prompt, tone) {
  const sets = {
    professional: [
      `${prompt} — Precision. Performance. Results.`,
      `Redefining excellence in ${prompt}.`,
      `Where expertise meets ${prompt}.`,
      `${prompt}: The standard others aspire to.`,
      `Built for those who demand the best in ${prompt}.`,
      `${prompt} — Engineered for impact.`,
      `The trusted name in ${prompt}.`,
    ],
    casual: [
      `${prompt} — just better.`,
      `Making ${prompt} actually enjoyable.`,
      `${prompt} for real people.`,
      `Your everyday ${prompt} companion.`,
      `${prompt}, simplified.`,
      `${prompt} without the headache.`,
      `Finally, ${prompt} that gets you.`,
    ],
    marketing: [
      `${prompt} — Unleash Your Potential!`,
      `Transform your world with ${prompt}.`,
      `${prompt}: The future is NOW.`,
      `Don't just dream it — ${prompt} it.`,
      `${prompt} — Because you deserve the best.`,
      `${prompt}: Your unfair advantage.`,
      `The only ${prompt} you'll ever need.`,
    ],
    funny: [
      `${prompt} — We tried to make it boring. We failed.`,
      `${prompt}: Surprisingly not terrible.`,
      `Finally, a ${prompt} that doesn't make you cry.`,
      `${prompt} — Mom approved (mostly).`,
      `${prompt}: 10/10, would recommend to an enemy.`,
      `${prompt} — It's giving "actually works".`,
      `${prompt}: Less suffering, more winning.`,
    ],
    formal: [
      `${prompt}: A Commitment to Excellence.`,
      `Advancing the discourse on ${prompt}.`,
      `${prompt} — Established on Principles of Quality.`,
      `The authoritative voice in ${prompt}.`,
      `${prompt}: Integrity. Innovation. Impact.`,
      `${prompt} — Grounded in Evidence, Driven by Purpose.`,
      `Excellence in ${prompt}: A Formal Commitment.`,
    ],
  };

  const pool    = sets[tone] ?? sets.professional;
  const shuffled = shuffle([...pool]);
  return shuffled.slice(0, 5).map((o, i) => `${i + 1}. "${o}"`).join('\n');
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Generate content locally without any external API.
 * Uses multi-template variation, synonym replacement, and natural keyword weaving.
 * @param {object} params - { type, tone, prompt, length, keywords }
 * @returns {{ output: string }}
 */
function generateFallbackContent({ type, tone = 'professional', prompt, length = 'medium', keywords = [], wordCount }) {
  const generators = {
    blog:                () => generateBlog(prompt, tone, keywords, length, wordCount),
    ad:                  () => generateAd(prompt, tone, keywords),
    caption:             () => generateCaption(prompt, tone, keywords),
    product_description: () => generateProductDescription(prompt, tone, keywords),
    email:               () => generateEmail(prompt, tone, keywords),
    tagline:             () => generateTagline(prompt, tone),
  };

  const fn = generators[type] ?? generators.blog;
  return { output: fn() };
}

module.exports = { generateFallbackContent };
