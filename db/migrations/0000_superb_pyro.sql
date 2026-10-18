CREATE TABLE `stock_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`inventory_id` text NOT NULL,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "allocation_positive" CHECK("stock_allocations"."quantity">0)
);
--> statement-breakpoint
CREATE TABLE `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_identity` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`metadata_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text DEFAULT 'Multan' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`map_url` text DEFAULT '' NOT NULL,
	`opening_hours` text DEFAULT '' NOT NULL,
	`pickup_enabled` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`old_status` text NOT NULL,
	`new_status` text NOT NULL,
	`actor` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`r2_key` text NOT NULL,
	`alt_text` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`is_transparent_asset` integer DEFAULT 0 NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_images_r2_key_unique` ON `product_images` (`r2_key`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`quantity_available` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_nonnegative" CHECK("inventory"."quantity_available" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_variant_branch` ON `inventory` (`variant_id`,`branch_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`sku_snapshot` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`variant_name_snapshot` text NOT NULL,
	`unit_price_pkr` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total_pkr` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "item_total" CHECK("order_items"."quantity" > 0 AND "order_items"."line_total_pkr" = "order_items"."unit_price_pkr" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE INDEX `items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`client_request_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`customer_json` text NOT NULL,
	`fulfillment_type` text NOT NULL,
	`branch_id` text,
	`branch_name_snapshot` text DEFAULT '' NOT NULL,
	`subtotal_pkr` integer NOT NULL,
	`shipping_pkr` integer NOT NULL,
	`total_pkr` integer NOT NULL,
	`currency` text DEFAULT 'PKR' NOT NULL,
	`status` text DEFAULT 'AWAITING_WHATSAPP_MESSAGE' NOT NULL,
	`whatsapp_number_snapshot` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "order_total" CHECK("orders"."total_pkr" = "orders"."subtotal_pkr" + "orders"."shipping_pkr")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_client_request_id_unique` ON `orders` (`client_request_id`);--> statement-breakpoint
CREATE INDEX `orders_status_date` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category_id` text NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`platform` text NOT NULL,
	`condition` text DEFAULT 'New' NOT NULL,
	`product_type` text NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`seo_title` text DEFAULT '' NOT NULL,
	`seo_description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `product_catalog_idx` ON `products` (`active`,`category_id`,`platform`);--> statement-breakpoint
CREATE TABLE `homepage_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`section_key` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `homepage_sections_section_key_unique` ON `homepage_sections` (`section_key`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shipping_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`province` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`flat_fee_pkr` integer NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "shipping_nonnegative" CHECK("shipping_rates"."flat_fee_pkr" >= 0)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`attributes_json` text DEFAULT '{}' NOT NULL,
	`price_pkr` integer NOT NULL,
	`compare_at_price_pkr` integer,
	`available` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "price_positive" CHECK("product_variants"."price_pkr" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE INDEX `variant_product_idx` ON `product_variants` (`product_id`);