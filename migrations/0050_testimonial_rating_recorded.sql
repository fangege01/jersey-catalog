ALTER TABLE customer_testimonials ADD COLUMN rating_recorded INTEGER NOT NULL DEFAULT 1 CHECK (rating_recorded IN (0, 1));
