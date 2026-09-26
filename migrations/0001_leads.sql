-- One row per lead signal. Form requests carry contact details; call/email
-- clicks and estimate-button clicks only carry where on the page they came from.
CREATE TABLE IF NOT EXISTS leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  type       TEXT    NOT NULL,  -- form | call | email | estimate_click
  location   TEXT,              -- which button or link (hero, header, footer...)
  name       TEXT,
  phone      TEXT,
  address    TEXT,
  service    TEXT,
  notes      TEXT,
  emailed    INTEGER NOT NULL DEFAULT 0,
  page       TEXT,
  referrer   TEXT,
  country    TEXT,
  city       TEXT
);
CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at);
CREATE INDEX IF NOT EXISTS leads_type    ON leads (type, created_at);
