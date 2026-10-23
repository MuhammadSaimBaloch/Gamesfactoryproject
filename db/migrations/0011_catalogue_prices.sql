-- One-time owner-approved prices. Future admin edits are not overwritten on deploy.
UPDATE product_variants
SET price_pkr=CASE (SELECT product_type FROM products WHERE id=product_id)
  WHEN 'controller' THEN 21999
  WHEN 'console' THEN 249999
  ELSE 9999 END,
  compare_at_price_pkr=NULL,updated_at=CURRENT_TIMESTAMP
WHERE product_id IN (SELECT id FROM products WHERE product_type IN ('controller','console','physical-game','digital-game'));
DELETE FROM sale_variants WHERE variant_id IN (
  SELECT v.id FROM product_variants v JOIN products p ON p.id=v.product_id
  WHERE p.product_type IN ('controller','console','physical-game','digital-game')
);
UPDATE product_details SET price_on_request=0;
