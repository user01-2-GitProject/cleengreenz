# Lead tracking

What gets counted:

- **Estimate forms.** The form on the homepage posts to `/api/lead` (`functions/api/lead.js`), which saves the request in a Cloudflare D1 database and emails it to chris@cleengreenz.com through Resend. If the email can't be sent, the page falls back to opening the visitor's email app like the old form did, so no request is lost.
- **Call and email taps.** Every `tel:` and `mailto:` link with a `data-lead` attribute is counted (`js/leads.js`).
- **Estimate button clicks.** Every "Free estimate" button that jumps to the form is counted.
- **Visits.** Cloudflare Web Analytics, turned on in the Pages dashboard (no code needed).

See the numbers at **/leads** (for example https://cleengreenz.com/leads). The browser asks for a password: any username, and the `LEADS_PASSWORD` secret as the password.

## One-time Cloudflare setup

Run from the repo root, logged in with `npx wrangler login`.

1. Create the database and its table:

   ```sh
   npx wrangler d1 create cleengreenz-leads
   npx wrangler d1 execute cleengreenz-leads --remote --file migrations/0001_leads.sql
   ```

2. In the Cloudflare dashboard, open Workers & Pages → **cleengreenz** → Settings → Bindings, and add a **D1 database** binding named `DB` pointing at `cleengreenz-leads` (for Production, and Preview if you use it).

3. Email: create a free [Resend](https://resend.com) account, add the domain `cleengreenz.com` there and add the DNS records it shows, then create an API key and store it:

   ```sh
   npx wrangler pages secret put RESEND_API_KEY --project-name cleengreenz
   ```

4. Pick a password for the /leads page:

   ```sh
   npx wrangler pages secret put LEADS_PASSWORD --project-name cleengreenz
   ```

5. Web Analytics: Workers & Pages → **cleengreenz** → Metrics → **Enable** Web Analytics.

6. Deploy as usual:

   ```sh
   npx wrangler pages deploy . --project-name cleengreenz
   ```

Optional settings (Settings → Variables): `LEAD_TO` changes who gets the emails (comma-separated), and `LEAD_FROM` changes the sender, which must be on the domain verified in Resend.

Until steps 1 to 4 are done, the site still works: the form falls back to opening an email, and taps are simply not stored.
