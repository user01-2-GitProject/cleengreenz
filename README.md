# Cleen Greenz — cleengreenz.com

Website for **Cleen Greenz Lawn Care** (owner: Chris Liebetrau), Niles,
Michigan — lawn care and snow removal serving the Michiana area since
2009. Built and maintained by [Pawating](https://pawating.com).

## Stack

Static HTML/CSS/JS — there is no build step. Hosted on **Cloudflare
Pages**: the repo root is the site root, `functions/` holds Pages
Functions, and `_headers` sets the security headers.

## Layout

- `index.html` — the homepage (hero, services, yard estimator, estimate form)
- `lawns/`, `shoveling/`, `leaf-cleanup/`, `seeding/`, `estimates/` —
  service pages, each an `index.html`. Note: `estimates/index.html` is
  the public estimates page; the `estimates/*.js` files next to it are
  pricing-engine modules, not pages.
- `estimates/*.js` — the yard-pricing engine (rates, lot lookup,
  validation) used by the estimator UI
- `js/leads.js` — lead tracking plus the estimate form (posts to `/api/lead`)
- `js/estimates.js` — the "Price your yard" estimator UI on the homepage
- `functions/api/lead.js` — Pages Function: lead intake (stores + emails Chris)
- `functions/api/estimate.js` — Pages Function: yard estimate API
- `media/` — images and video (mascots, owner photo, logo, favicon)
- `tests/` — test suite (`npm test`, node --test + jsdom)
- `404.html` — branded not-found page
- `sitemap.xml` / `robots.txt` — crawler files; update the sitemap when
  pages are added or removed

## Deploy

Push to `main` and Cloudflare Pages deploys production. Pushes to other
branches get Pages preview deployments — review there before merging.

## Notes

- The estimate form and the yard estimator are the lead flow; see
  `LEADS.md` for how leads are handled.
- `package.json` exists only for the test suite — the site itself has
  no dependencies and no build.
