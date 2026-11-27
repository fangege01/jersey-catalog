CREATE TABLE media_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) BETWEEN 1 AND 60)
);

ALTER TABLE media ADD COLUMN category_id TEXT REFERENCES media_categories(id) ON DELETE SET NULL;
CREATE INDEX media_category_order ON media(category_id, created_at DESC, id DESC);
