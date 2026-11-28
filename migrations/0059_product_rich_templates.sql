CREATE TABLE product_rich_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
