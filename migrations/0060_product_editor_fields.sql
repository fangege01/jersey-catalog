ALTER TABLE products ADD COLUMN catalog_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN team TEXT;
ALTER TABLE products ADD COLUMN product_type TEXT;
ALTER TABLE products ADD COLUMN sleeve_type TEXT;
ALTER TABLE products ADD COLUMN product_tags TEXT;
CREATE INDEX idx_product_catalog_category ON products(catalog_category_id);
