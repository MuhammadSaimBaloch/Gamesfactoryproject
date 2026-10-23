ALTER TABLE product_variants ADD COLUMN condition TEXT CHECK(condition IS NULL OR condition IN ('New','Used','Refurbished'));
INSERT OR IGNORE INTO categories(id,name,slug,description,active) VALUES('retro','Retro','retro','Retro consoles and classic games.',1);
