-- Development only. Do not apply this file to a remote database.
INSERT OR IGNORE INTO categories(id,name,slug) VALUES ('controllers','Controllers','controllers'),('consoles','Consoles','consoles'),('games','Games','games'),('accessories','Accessories','accessories');
INSERT OR IGNORE INTO branches(id,name) VALUES ('babar-market','Babar Market'),('model-town','Model Town');
INSERT OR IGNORE INTO site_settings(key,value) VALUES ('announcement','Two branches. One love for gaming. Multan, Pakistan.'),('hero_title','PLAY BEYOND.'),('hero_subtitle','Your next great gaming experience starts here. Explore consoles, controllers and games from Games Factory Pakistan.'),('whatsapp_number',''),('whatsapp_verified','false'),('shipping_policy',''),('returns_policy',''),('privacy_policy','');
INSERT OR IGNORE INTO homepage_sections(id,section_key,title,subtitle,sort_order) VALUES ('controllers','controllers','TAKE CONTROL.','Find your next player two.',1),('games','games','ONE MORE LEVEL.','Discover your next world.',2),('consoles','consoles','YOUR NEXT GENERATION.','A new way to play.',3);
INSERT OR IGNORE INTO products(id,slug,name,description,category_id,brand,platform,product_type,featured,active,demo) VALUES
('demo-controller','demo-wireless-controller','Wireless Controller','Demonstration product. Replace with an owner-approved product, specifications and licensed photography before launch.','controllers','Demo','PlayStation','controller',1,1,1),
('demo-controller-2','demo-wireless-controller-carbon','Wireless Controller — Carbon','Demonstration product. Compatibility and specifications require owner confirmation.','controllers','Demo','Xbox','controller',1,1,1),
('demo-console','demo-next-generation-console','Next-generation Console','Demonstration product. No real inventory or price is represented.','consoles','Demo','PlayStation','console',1,1,1),
('demo-game','demo-orbit','ORBIT / Beyond the Signal','Original development cover, not an actual retail game. Physical case layout demonstration.','games','Demo','PlayStation','physical-game',1,1,1),
('demo-game-2','demo-afterlight','AFTERLIGHT / The Lost City','Original development cover, not an actual retail game.','games','Demo','Xbox','physical-game',1,1,1),
('demo-game-3','demo-drift','DRIFT / Midnight Circuit','Original development cover, not an actual retail game.','games','Demo','Nintendo','physical-game',1,1,1);
INSERT OR IGNORE INTO product_variants(id,product_id,sku,name,price_pkr,attributes_json) VALUES
('demo-v1','demo-controller','DEMO-CTRL-W','White / Standard',18000,'{"Compatibility":"Unverified demo","Connectivity":"Wireless (demo)"}'),
('demo-v2','demo-controller-2','DEMO-CTRL-B','Carbon / Standard',19000,'{"Compatibility":"Unverified demo","Connectivity":"Wireless (demo)"}'),
('demo-v3','demo-console','DEMO-CONSOLE','Standard edition',150000,'{}'),
('demo-v4','demo-game','DEMO-ORBIT','Physical case / Demo',10000,'{"Format":"Physical case demonstration"}'),
('demo-v5','demo-game-2','DEMO-AFTERLIGHT','Physical case / Demo',11000,'{}'),
('demo-v6','demo-game-3','DEMO-DRIFT','Physical case / Demo',12000,'{}');
INSERT OR IGNORE INTO inventory(id,variant_id,branch_id,quantity_available) SELECT 'stock-'||id,id,'babar-market',5 FROM product_variants WHERE id LIKE 'demo-%';
