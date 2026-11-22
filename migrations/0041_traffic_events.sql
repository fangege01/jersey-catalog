CREATE TABLE traffic_events (
  id TEXT PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  visitor_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('page_view', 'product_view', 'whatsapp_click')),
  path TEXT NOT NULL,
  landing_path TEXT NOT NULL,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  source TEXT NOT NULL,
  campaign TEXT NOT NULL,
  content TEXT NOT NULL,
  device TEXT NOT NULL,
  os TEXT NOT NULL,
  browser TEXT NOT NULL
);
CREATE INDEX traffic_events_time ON traffic_events(occurred_at);
