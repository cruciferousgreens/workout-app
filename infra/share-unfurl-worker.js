/* Share-link unfurl worker for app.cruciferousgreens.com/s/<slug> (#298).
 *
 * PROBLEM
 *   /s/<slug> short links are served by GitHub Pages' 404.html, so they
 *   return HTTP 404. Chat apps (WhatsApp, Telegram, Signal, iMessage,
 *   Discord, Slack...) will not build a link preview for a URL that 404s,
 *   even though the page contains OG tags. Result: recipients see a bare
 *   URL with no card.
 *
 * FIX
 *   A Cloudflare Worker on the route `app.cruciferousgreens.com/s/*`
 *   returns HTTP 200 for every /s/<slug> request:
 *     - Crawlers read per-share OG/Twitter tags (workout name, exercise
 *       count), resolved live from the public share_links table.
 *     - Real browsers run the inline script, which stashes the path in
 *       sessionStorage (same 'cg-spa-redirect' key 404.html uses) and
 *       hands off to /, where the app boots and opens the share.
 *   One code path, no user-agent sniffing: crawlers ignore the script and
 *   read the tags; browsers run the script and land in the app.
 *   Any failure (bad slug, unknown slug, Supabase down, decode failure)
 *   degrades to generic tags — still HTTP 200, still hands off to the app.
 *   Sharing never breaks.
 *
 * DEPLOY
 *   1. Cloudflare dashboard -> Workers & Pages -> Create Worker, paste
 *      this file as the worker code (or `wrangler deploy`).
 *   2. Worker -> Settings -> Domains & Routes -> Add route:
 *      Route: app.cruciferousgreens.com/s/*   Zone: cruciferousgreens.com
 *   3. Security -> WAF -> Rate limiting rules: cap requests to
 *      app.cruciferousgreens.com/s/* (each hit costs a Supabase query;
 *      the route is unauthenticated by design).
 *   4. No secrets needed: the Supabase publishable key below is already
 *      public (it ships inside the app's own JS) and share_links has a
 *      "public read" RLS policy so recipients need no account.
 *
 * MAINTENANCE
 *   Slim payload keys (n/k/e/p) mirror slimSharePayload() in
 *   assets/js/share-codec.js. If that format changes, update
 *   summarizeSlim() below.
 */

const SUPABASE_URL = 'https://kbiikscyyiedgzijamnu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OcWd1Wt0WKMtMpI3jBIGUg_kJ4kJ3wn';

const APP_ORIGIN = 'https://app.cruciferousgreens.com';
const CARD_IMAGE = APP_ORIGIN + '/share-card-home-1200.png';
const SPA_REDIRECT_KEY = 'cg-spa-redirect'; /* keep in sync with 404.html */
const SLUG_RE = /^[A-Za-z0-9]{8}$/;

/* ------------------------------------------------------------------ */
/* Share payload decoding (mirrors share-codec.js: v2 deflate, v1 raw) */
/* ------------------------------------------------------------------ */

function b64urlToBytes(str) {
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function inflateBytes(bytes) {
  const buf = await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  ).arrayBuffer();
  return new Uint8Array(buf);
}

/* Returns the slim payload object, or null when undecodable. */
export async function decodeSharePayload(code) {
  if (!code || typeof code !== 'string' || code.length > 200000) return null;
  try {
    const slim = JSON.parse(new TextDecoder().decode(await inflateBytes(b64urlToBytes(code))));
    if (slim && typeof slim.n === 'string') return slim;
  } catch (_) { /* not v2 */ }
  try {
    const slim = JSON.parse(new TextDecoder().decode(b64urlToBytes(code)));
    if (slim && typeof slim.n === 'string') return slim;
  } catch (_) { /* not v1 either */ }
  return null;
}

/* { title, kindLabel, countLabel } for the OG tags. */
export function summarizeSlim(slim) {
  const name = (slim.n || '').trim() || 'Shared workout';
  if (slim.k === 'p' && slim.p && Array.isArray(slim.p.w)) {
    const workouts = slim.p.w;
    const exCount = workouts.reduce((t, w) => t + (w && Array.isArray(w.e) ? w.e.length : 0), 0);
    return {
      title: name,
      countLabel: workouts.length + (workouts.length === 1 ? ' workout' : ' workouts') +
        (exCount ? ' · ' + exCount + (exCount === 1 ? ' exercise' : ' exercises') : ''),
    };
  }
  const exCount = Array.isArray(slim.e) ? slim.e.length : 0;
  return {
    title: name,
    countLabel: exCount ? exCount + (exCount === 1 ? ' exercise' : ' exercises') : '',
  };
}

/* ------------------------------------------------------------------ */
/* Supabase lookup                                                     */
/* ------------------------------------------------------------------ */

export async function fetchShareSummary(slug) {
  /* { title, countLabel } or null when the slug can't be resolved. */
  try {
    const url = SUPABASE_URL + '/rest/v1/share_links?slug=eq.' +
      encodeURIComponent(slug) + '&select=payload';
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_PUBLISHABLE_KEY,
        'Accept': 'application/json',
      },
      /* The worker awaits this before responding — never let a hung
         Supabase hold a share tap or a crawler past a few seconds. An
         abort lands in the catch below and degrades to generic tags. */
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const code = rows && rows[0] && rows[0].payload;
    const slim = await decodeSharePayload(code);
    return slim ? summarizeSlim(slim) : null;
  } catch (_) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Preview page                                                        */
/* ------------------------------------------------------------------ */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPreviewHtml({ slug, title, countLabel }) {
  /* Titles come from user workout names — bound the length so a
     hand-inserted share_links row can't stuff KBs into the meta tags. */
  const safeTitle = esc(String(title).slice(0, 150));
  const descCore = countLabel ? countLabel + ' · ' : '';
  const description = esc('Someone shared a workout with you — open it to view, save, or start it.');
  const fullDesc = esc(descCore) + description;
  const pageUrl = APP_ORIGIN + '/s/' + encodeURIComponent(slug);
  /* The script is the human path: crawlers never run it, browsers use it
     to land in the app with the share intact (same mechanism as 404.html).
     The <noscript> link covers script-disabled browsers. */
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<title>' + safeTitle + ' — Cruciferous Greens</title>\n' +
    '<meta property="og:type" content="website" />\n' +
    '<meta property="og:site_name" content="Cruciferous Greens Workout" />\n' +
    '<meta property="og:url" content="' + pageUrl + '" />\n' +
    '<meta property="og:title" content="' + safeTitle + '" />\n' +
    '<meta property="og:description" content="' + fullDesc + '" />\n' +
    '<meta property="og:image" content="' + CARD_IMAGE + '" />\n' +
    '<meta property="og:image:width" content="1200" />\n' +
    '<meta property="og:image:height" content="630" />\n' +
    '<meta property="og:image:alt" content="' + safeTitle + ' — shared workout" />\n' +
    '<meta name="twitter:card" content="summary_large_image" />\n' +
    '<meta name="twitter:title" content="' + safeTitle + '" />\n' +
    '<meta name="twitter:description" content="' + fullDesc + '" />\n' +
    '<meta name="twitter:image" content="' + CARD_IMAGE + '" />\n' +
    '<script>\n(function(){\n' +
    '  try{sessionStorage.setItem(' + JSON.stringify(SPA_REDIRECT_KEY) +
    ',location.pathname+location.search+location.hash);}catch(e){}\n' +
    '  location.replace("/");\n})();\n</script>\n' +
    '</head>\n<body>\n<noscript><p><a href="' + pageUrl + '">Open the shared workout</a></p></noscript>\n' +
    '</body>\n</html>\n';
}

/* ------------------------------------------------------------------ */
/* Worker entry                                                        */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    /* If the route is ever widened beyond /s/*, don't serve the share
       page for unrelated paths. */
    const m = /^\/s(?:\/([^/]*))?\/?$/.exec(url.pathname);
    if (!m) return new Response('Not found', { status: 404 });
    const slug = SLUG_RE.test(m[1] || '') ? m[1] : null;

    /* Edge cache via the Cache API: share rows are insert-only, so a
       per-slug page is effectively immutable. s-maxage=300 bounds any
       stale card after an owner deletes a link. (A worker's own response
       Cache-Control headers alone do NOT cache at the edge — the Cache
       API put is what makes it stick.) */
    const cacheKey = new Request(url.origin + '/s/' + (slug || ''), { method: 'GET' });
    if (request.method === 'GET') {
      try {
        const hit = await caches.default.match(cacheKey);
        if (hit) return hit;
      } catch (_) { /* cache miss / unavailable — build fresh */ }
    }

    let summary = null;
    if (slug) summary = await fetchShareSummary(slug);

    const html = buildPreviewHtml({
      slug: slug || '',
      title: (summary && summary.title) || 'Cruciferous Greens',
      countLabel: (summary && summary.countLabel) || '',
    });

    const headers = {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, s-maxage=300, max-age=60',
    };
    const res = new Response(request.method === 'HEAD' ? null : html,
      { status: 200, headers });
    if (request.method === 'GET') {
      try { ctx.waitUntil(caches.default.put(cacheKey, res.clone())); } catch (_) {}
    }
    return res;
  },
};
