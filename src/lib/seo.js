const SITE_NAME = 'Attic';
const DEFAULT_DESCRIPTION =
  'Attic is a private space for couples — encrypted chat, shared scrapbooks, games, and calls. Just the two of you.';

export const SITE_URL =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') || 'https://attic-5gp.pages.dev';

const DEFAULT_OG_IMAGE = `${SITE_URL}/assets/icon-512.png`;

/** Per-route SEO (public routes are indexable; app routes use noindex). */
export const ROUTE_SEO = {
  '/': {
    title: 'Attic — A private space for two',
    description: DEFAULT_DESCRIPTION,
    index: true,
  },
  '/signup': {
    title: 'Create your Attic — Couples app',
    description: 'Sign up and invite your partner with a short pairing code. Your shared attic unlocks when you both join.',
    index: true,
  },
  '/signin': {
    title: 'Sign in to Attic',
    description: 'Return to your private couple space — chat, memories, and games waiting for you.',
    index: true,
  },
  '/legal': {
    title: 'Terms & Privacy — Attic',
    description: 'Terms of service and privacy policy for the Attic couples app.',
    index: true,
  },
  '/password-reset': {
    title: 'Reset password — Attic',
    description: 'Reset your Attic account password.',
    index: false,
  },
  '/handshake': {
    title: 'Pair with your partner — Attic',
    description: 'Enter your partner\'s pairing code to unlock your shared Attic.',
    index: false,
  },
  '/dashboard': {
    title: 'Your Attic',
    description: 'Your couple dashboard — chat, pet, streaks, and shared apps.',
    index: false,
  },
};

const PRIVATE_PREFIXES = [
  '/dashboard',
  '/chat',
  '/handshake',
  '/settings',
  '/doodle',
  '/activities',
  '/scrapbook',
  '/notes',
  '/watch',
  '/capsule',
  '/lists',
  '/calendar',
  '/dreams',
  '/daily-q',
  '/resume',
  '/shared-canvas',
  '/pixelart',
];

export function getSeoForPath(pathname) {
  const exact = ROUTE_SEO[pathname];
  if (exact) return exact;

  if (PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return {
      title: 'Your Attic',
      description: DEFAULT_DESCRIPTION,
      index: false,
    };
  }

  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    index: false,
  };
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function applySeo({ title, description, index = false, path = '/' }) {
  const fullTitle = title?.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  document.title = fullTitle;

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', index ? 'index, follow' : 'noindex, nofollow');

  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', `${SITE_URL}${path}`);
  upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);

  upsertLink('canonical', `${SITE_URL}${path}`);
}
