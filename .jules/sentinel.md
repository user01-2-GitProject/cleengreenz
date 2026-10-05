## 2026-09-28 - Email Subject CRLF Injection & Response Security Headers

**Vulnerability:** Unsanitized newline characters (`\r` and `\n`) in user inputs (`lead.name`, `lead.service`) could allow email header injection when sending notification emails via Resend. Additionally, missing HTTP security headers on Cloudflare Worker endpoint responses left the application exposed to clickjacking, MIME-sniffing, and referrer leakage risks.

**Learning:** When passing user inputs into email subject lines or using lightweight Worker response helpers, input values must be explicitly stripped of CR/LF control characters, and HTTP response objects must explicitly set standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).

**Prevention:** Always strip linebreaks (`.replace(/[\r\n]/g, ' ')`) before embedding dynamic user values in email headers/subjects, and enforce strict security response headers across all Cloudflare Worker routes.

## 2026-03-30 - Cloudflare Worker JSON Body Primitive / Null Handling & DoS Prevention

**Vulnerability:** In Cloudflare Worker handlers using `await request.json()`, sending JSON payloads that parse to `null` or primitives (e.g. `null`, `123`, `true`) causes `typeof body` to return `'object'` or primitive. Accessing object properties like `body.type` on `null` throws an unhandled `TypeError`, resulting in HTTP 500 server errors and potential denial-of-service.

**Learning:** `JSON.parse('null')` returns `null` in JavaScript, which passes naive existence/type checks (`typeof null === 'object'`). Cloudflare Worker API endpoints parsing JSON payloads must explicitly validate that the body is a non-null object and not an array before property access.

**Prevention:** Always validate parsed request bodies with `if (!body || typeof body !== 'object' || Array.isArray(body))` before accessing properties on incoming API JSON payloads.
