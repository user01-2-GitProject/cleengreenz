## 2026-09-28 - Email Subject CRLF Injection & Response Security Headers

**Vulnerability:** Unsanitized newline characters (`\r` and `\n`) in user inputs (`lead.name`, `lead.service`) could allow email header injection when sending notification emails via Resend. Additionally, missing HTTP security headers on Cloudflare Worker endpoint responses left the application exposed to clickjacking, MIME-sniffing, and referrer leakage risks.

**Learning:** When passing user inputs into email subject lines or using lightweight Worker response helpers, input values must be explicitly stripped of CR/LF control characters, and HTTP response objects must explicitly set standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).

**Prevention:** Always strip linebreaks (`.replace(/[\r\n]/g, ' ')`) before embedding dynamic user values in email headers/subjects, and enforce strict security response headers across all Cloudflare Worker routes.

## 2026-03-30 - Missing Client IP Rate Limiter Bypass & Memory Cap

**Vulnerability:** In `functions/api/lead.js` and `functions/leads.js`, rate limiting checked `if (clientIp && isRateLimited(clientIp))`. Requests lacking both `cf-connecting-ip` and `x-forwarded-for` headers resulted in a falsy `clientIp`, bypassing rate limiting entirely. Additionally, `isRateLimited` did not reject new IPs when map size reached capacity (1000) during IP flooding attacks.

**Learning:** Rate limiters must always fall back to a default bucket (e.g. `'unknown'`) when client IP headers are absent rather than skipping validation. In-memory sliding-window maps must also return rate limited (`true`) when capacity limit is reached and cannot be reduced by stale entry sweeps.

**Prevention:** Ensure `clientIp` falls back to `'unknown'` across all worker endpoints, and cap map size in sliding-window rate limiters.
