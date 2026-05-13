import { useState } from 'react';
import { Link } from 'react-router-dom';
import { paymentApi } from '../api/payment';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const FREE_FEATURES = [
  { text: '10 AI generations per day',  included: true },
  { text: 'All 6 content types',        included: true },
  { text: 'All 5 tone options',         included: true },
  { text: 'Export as TXT & PDF',        included: true },
  { text: 'Content history (30 days)',  included: true },
  { text: '100 generations per day',    included: false },
  { text: 'Priority AI processing',     included: false },
  { text: 'Unlimited history',          included: false },
];

const PREMIUM_FEATURES = [
  '100 AI generations per day',
  'All 6 content types',
  'All 5 tone options',
  'Export as TXT & PDF',
  'Unlimited content history',
  'Priority AI processing',
  'Advanced analytics dashboard',
  'Priority email support',
];

const TRUST_BADGES = [
  'No credit card required',
  'Cancel anytime',
  'Secure payments via Stripe',
  'Data encrypted at rest',
  '99.9% uptime SLA',
];

const FAQS = [
  { q: 'Can I cancel anytime?', a: "Yes, absolutely. Cancel from your account settings at any time. You'll keep premium access until the end of your current billing period — no questions asked." },
  { q: 'What happens to my content if I downgrade?', a: "All your generated content is preserved forever. On the free plan you'll be limited to 10 generations per day, but your history remains fully accessible." },
  { q: 'Is there a free trial for Premium?', a: "The free plan is a permanent free tier — no time limit, no credit card. It gives you 10 daily generations to explore all features before deciding to upgrade." },
  { q: 'How does the credit system work?', a: "Each AI generation costs 1 credit. Credits reset every day at midnight UTC. Free users get 10/day, Premium users get 100/day. Unused credits do not roll over." },
  { q: 'Is my data secure?', a: "Yes. All data is encrypted in transit (TLS) and at rest. We never share your content with third parties. Your prompts and outputs belong to you." },
];

export default function Pricing() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [upgrading, setUpgrading] = useState(false);
  const [openFaq, setOpenFaq]     = useState(null);

  async function upgrade() {
    setUpgrading(true);
    try {
      const res = await paymentApi.createCheckout();
      if (res.mock) {
        await refreshUser();
        toast.success(res.message || '🎉 Upgraded to Premium!');
      } else if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      toast.error(err.message || 'Upgrade failed. Please try again.');
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 py-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-semibold mb-5">
            💎 Simple, Transparent Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            Start free.<br /><span className="gradient-text">Scale when ready.</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
            No hidden fees. No credit card required to start. Cancel anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">

          {/* Free */}
          <div className="card p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌱</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Free</h2>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold text-gray-900 dark:text-white">$0</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Perfect for trying out WriteGen AI</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES.map((f) => (
                <li key={f.text} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 shrink-0 w-4 text-center ${f.included ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`}>
                    {f.included ? '✓' : '✕'}
                  </span>
                  <span className={f.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>

            {!user ? (
              <Link to="/signup" className="btn-secondary w-full py-3 text-center font-semibold">Get Started Free</Link>
            ) : user.role === 'free' ? (
              <div className="w-full py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl">
                ✓ Your Current Plan
              </div>
            ) : (
              <div className="w-full py-3 text-center text-sm font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-xl">
                Downgrade
              </div>
            )}
          </div>

          {/* Premium */}
          <div className="relative card p-8 flex flex-col border-2 border-accent-500 shadow-xl shadow-accent-500/10">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-accent-500 to-primary-500 text-white text-xs font-bold rounded-full shadow-lg">
                ⭐ MOST POPULAR
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🚀</span>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Premium</h2>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-bold gradient-text">$19</span>
                <span className="text-gray-400">/month</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">For creators, marketers & professionals</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 shrink-0 w-4 text-center text-green-500">✓</span>
                  <span className="text-gray-700 dark:text-gray-300">{f}</span>
                </li>
              ))}
            </ul>

            {!user ? (
              <Link to="/signup" className="btn-accent w-full py-3 text-center font-semibold">Start Premium</Link>
            ) : user.role === 'premium' ? (
              <div className="w-full py-3 text-center text-sm font-semibold text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/20 rounded-xl border border-accent-200 dark:border-accent-800">
                ✓ Your Current Plan
              </div>
            ) : (
              <button onClick={upgrade} disabled={upgrading} className="btn-accent w-full py-3 font-semibold">
                {upgrading && <span className="spinner" />}
                {upgrading ? 'Processing...' : '⚡ Upgrade to Premium'}
              </button>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-16 text-sm text-gray-500 dark:text-gray-400">
          {TRUST_BADGES.map((b) => (
            <div key={b} className="flex items-center gap-2">
              <span className="text-green-500">✓</span><span>{b}</span>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <div key={faq.q} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFaq((prev) => (prev === faq.q ? null : faq.q))}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-semibold text-gray-900 dark:text-white text-sm">{faq.q}</span>
                  <span className={`text-gray-400 transition-transform duration-200 shrink-0 ml-4 ${openFaq === faq.q ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {openFaq === faq.q && (
                  <div className="px-5 pb-5 animate-fade-in">
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
