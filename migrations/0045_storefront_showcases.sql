CREATE TABLE storefront_showcase_items (
  id INTEGER PRIMARY KEY,
  section TEXT NOT NULL CHECK (section IN ('cases', 'factory')),
  slot TEXT CHECK (slot IN ('factory', 'documents', 'customize')),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 10000),
  visible INTEGER NOT NULL DEFAULT 0 CHECK (visible IN (0, 1)),
  image_id INTEGER NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  body_en TEXT NOT NULL DEFAULT '',
  body_zh TEXT NOT NULL DEFAULT '',
  alt_en TEXT NOT NULL,
  alt_zh TEXT NOT NULL,
  CHECK ((section = 'cases' AND slot IS NULL) OR (section = 'factory' AND slot IS NOT NULL)),
  UNIQUE (section, slot)
);
CREATE INDEX storefront_showcase_order ON storefront_showcase_items(section, visible, position, id);
CREATE INDEX storefront_showcase_media ON storefront_showcase_items(image_id);
