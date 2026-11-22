CREATE TABLE customer_testimonials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  attribution TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  position INTEGER NOT NULL,
  avatar_media_id INTEGER REFERENCES media(id) ON DELETE RESTRICT
);
CREATE INDEX customer_testimonials_order ON customer_testimonials(position, id);
CREATE INDEX customer_testimonials_public ON customer_testimonials(published, position, id);
CREATE INDEX customer_testimonials_avatar ON customer_testimonials(avatar_media_id);
