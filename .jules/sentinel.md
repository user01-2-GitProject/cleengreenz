## 2026-09-28 - Email Subject CRLF Injection & Response Security Headers

**Vulnerability:** Unsanitized newline characters (`\r` and `\n`) in user inputs (`lead.name`, `lead.service`) could allow email header injection when sending notification emails via Resend. Additionally, missing HTTP security headers on Cloudflare Worker endpoint responses left the application exposed to clickjacking, MIME-sniffing, and referrer leakage risks.

**Learning:** When passing user inputs into email subject lines or using lightweight Worker response helpers, input values must be explicitly stripped of CR/LF control characters, and HTTP response objects must explicitly set standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`).

**Prevention:** Always strip linebreaks (`.replace(/[\r\n]/g, ' ')`) before embedding dynamic user values in email headers/subjects, and enforce strict security response headers across all Cloudflare Worker routes.
