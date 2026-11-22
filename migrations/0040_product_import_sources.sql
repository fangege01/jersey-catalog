-- Keep import identities separate from public product URLs and merchant edits.
CREATE TABLE product_import_sources (
  source_hash TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  source_sku TEXT
);
