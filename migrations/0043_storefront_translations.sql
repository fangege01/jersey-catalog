CREATE TABLE storefront_translations (
  locale TEXT NOT NULL,
  entity TEXT NOT NULL CHECK (entity IN ('product', 'category', 'page')),
  public_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  PRIMARY KEY (locale, entity, public_id)
);
