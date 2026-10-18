-- Safe initial store settings for a fresh clone or CI.
-- Actual payment account details belong in the owner panel/private setup data.
UPDATE branches SET name='Babar Market — Main Branch',address='Shop No 17B, Babar Market, Katchery Road, Mohalla Qadirabad, Multan, Pakistan',phone='03186496819',opening_hours='Contact us for today’s opening hours.',map_url='https://www.google.com/maps/search/?api=1&query=Games%20Factory%20Shop%2017B%20Babar%20Market%20Katchery%20Road%20Multan' WHERE id='babar-market';
UPDATE branches SET name='Emirates Mall — Shalimar Colony',address='Shop No 12, Emirates Mall, Shalimar Colony, Multan, Pakistan',phone='03186496819',opening_hours='Contact us for today’s opening hours.',map_url='https://www.google.com/maps/search/?api=1&query=Shop%2012%20Emirates%20Mall%20Shalimar%20Colony%20Multan' WHERE id='model-town';
INSERT INTO site_settings(key,value) VALUES
('whatsapp_number','923186496819'),
('whatsapp_verified','true'),
('contact_enabled','true'),
('announcement','We don’t offer Cash on Delivery at this time.'),
('payment_policy','Accepted payment methods: Meezan Bank, Faysal Bank, Easypaisa and SadaPay. Contact the store for verified account details. Cash on Delivery is not available. Wait for staff to confirm your order, stock, shipping charges and total before transferring payment. Share your payment reference with the store for verification.')
ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP;
