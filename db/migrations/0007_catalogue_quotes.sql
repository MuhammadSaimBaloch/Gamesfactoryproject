ALTER TABLE product_details ADD COLUMN price_on_request INTEGER NOT NULL DEFAULT 0 CHECK(price_on_request IN (0,1));
