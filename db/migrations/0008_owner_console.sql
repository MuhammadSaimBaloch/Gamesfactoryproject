CREATE TABLE sales (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('percent','fixed')),
 value INTEGER NOT NULL CHECK(value>0), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 starts_at TEXT NOT NULL DEFAULT '', ends_at TEXT NOT NULL DEFAULT '',
 CHECK(mode<>'percent' OR value<=100)
);
--> statement-breakpoint
CREATE TABLE sale_variants (
 sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 variant_id TEXT NOT NULL REFERENCES product_variants(id), PRIMARY KEY(sale_id,variant_id)
);
--> statement-breakpoint
CREATE INDEX sale_variant_lookup ON sale_variants(variant_id);
--> statement-breakpoint
CREATE TABLE inventory_context (id TEXT PRIMARY KEY CHECK(id='current'),actor TEXT NOT NULL,reason TEXT NOT NULL,reference TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE inventory_movements (
 id INTEGER PRIMARY KEY AUTOINCREMENT, inventory_id TEXT NOT NULL,
 before_quantity INTEGER NOT NULL, after_quantity INTEGER NOT NULL,
 actor TEXT NOT NULL, reason TEXT NOT NULL, reference TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TRIGGER inventory_change_history AFTER UPDATE OF quantity_available ON inventory
WHEN OLD.quantity_available<>NEW.quantity_available
BEGIN
 INSERT INTO inventory_movements(inventory_id,before_quantity,after_quantity,actor,reason,reference)
 VALUES(NEW.id,OLD.quantity_available,NEW.quantity_available,
 coalesce((SELECT actor FROM inventory_context WHERE id='current'),'system'),
 coalesce((SELECT reason FROM inventory_context WHERE id='current'),'Order allocation or cancellation'),
 coalesce((SELECT reference FROM inventory_context WHERE id='current'),''));
END;
--> statement-breakpoint
CREATE TABLE media_assets (
 id TEXT PRIMARY KEY,r2_key TEXT NOT NULL UNIQUE,alt_text TEXT NOT NULL,
 width INTEGER NOT NULL,height INTEGER NOT NULL,is_transparent_asset INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT OR IGNORE INTO site_settings(key,value) VALUES('low_stock_threshold','3');
