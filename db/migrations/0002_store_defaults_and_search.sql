INSERT OR IGNORE INTO branches(id,name) VALUES ('babar-market','Babar Market'),('model-town','Model Town');
INSERT OR IGNORE INTO categories(id,name,slug) VALUES ('controllers','Controllers','controllers'),('consoles','Consoles','consoles'),('games','Games','games'),('accessories','Accessories','accessories');
INSERT OR IGNORE INTO site_settings(key,value) VALUES ('announcement','Two branches. One love for gaming. Multan, Pakistan.'),('hero_title','PLAY BEYOND.'),('hero_subtitle','Your next great gaming experience starts here. Explore consoles, controllers and games from Games Factory Pakistan.'),('whatsapp_number',''),('whatsapp_verified','false'),('shipping_policy',''),('returns_policy',''),('privacy_policy','');
INSERT OR IGNORE INTO homepage_sections(id,section_key,title,subtitle,sort_order) VALUES ('controllers','controllers','TAKE CONTROL.','Find your next player two.',1),('games','games','ONE MORE LEVEL.','Discover your next world.',2),('consoles','consoles','YOUR NEXT GENERATION.','A new way to play.',3);
CREATE VIRTUAL TABLE product_search USING fts5(product_id UNINDEXED,name,brand,platform, tokenize='unicode61');
INSERT INTO product_search(product_id,name,brand,platform) SELECT id,name,brand,platform FROM products;
CREATE TRIGGER product_search_insert AFTER INSERT ON products BEGIN
 INSERT INTO product_search(product_id,name,brand,platform) VALUES(NEW.id,NEW.name,NEW.brand,NEW.platform);
END;
CREATE TRIGGER product_search_update AFTER UPDATE ON products BEGIN
 DELETE FROM product_search WHERE product_id=OLD.id;
 INSERT INTO product_search(product_id,name,brand,platform) VALUES(NEW.id,NEW.name,NEW.brand,NEW.platform);
END;
CREATE TRIGGER product_search_delete AFTER DELETE ON products BEGIN DELETE FROM product_search WHERE product_id=OLD.id; END;
