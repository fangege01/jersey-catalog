ALTER TABLE product_images ADD COLUMN seo_alias TEXT;

-- New URLs resolve to the same immutable original objects. Keep old aliases
-- independently of gallery edits so renaming a picture never breaks its URL.
CREATE TABLE product_image_url_aliases (
  alias_key TEXT PRIMARY KEY,
  image_key TEXT NOT NULL
);
