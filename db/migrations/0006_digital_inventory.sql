DROP TRIGGER confirm_stock;
-- Atomic allocation on confirmation. One branch fulfills each line; no reservation on handoff.
CREATE TRIGGER confirm_stock BEFORE UPDATE OF status ON orders
WHEN NEW.status='CONFIRMED' AND OLD.status='CONTACTED'
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM order_items oi WHERE oi.order_id=NEW.id AND NOT EXISTS (
   SELECT 1 FROM inventory i JOIN branches b ON b.id=i.branch_id
   JOIN product_variants v ON v.id=i.variant_id JOIN products p ON p.id=v.product_id
   WHERE i.variant_id=oi.variant_id AND i.quantity_available>=oi.quantity AND b.active=1 AND v.available=1 AND p.active=1
   AND (NEW.fulfillment_type IN ('delivery','digital') OR (i.branch_id=NEW.branch_id AND b.pickup_enabled=1))
  )
 ) THEN RAISE(ABORT,'Inventory unavailable during confirmation') END;
 INSERT INTO stock_allocations(id,order_id,inventory_id,quantity)
 SELECT lower(hex(randomblob(16))), NEW.id,
 (SELECT i.id FROM inventory i JOIN branches b ON b.id=i.branch_id WHERE i.variant_id=oi.variant_id AND i.quantity_available>=oi.quantity AND b.active=1 AND (NEW.fulfillment_type IN ('delivery','digital') OR i.branch_id=NEW.branch_id) ORDER BY i.quantity_available DESC,i.id LIMIT 1),oi.quantity
 FROM order_items oi WHERE oi.order_id=NEW.id;
 UPDATE inventory SET quantity_available=quantity_available-(SELECT sum(a.quantity) FROM stock_allocations a WHERE a.order_id=NEW.id AND a.inventory_id=inventory.id),updated_at=CURRENT_TIMESTAMP
 WHERE id IN (SELECT inventory_id FROM stock_allocations WHERE order_id=NEW.id);
END;
