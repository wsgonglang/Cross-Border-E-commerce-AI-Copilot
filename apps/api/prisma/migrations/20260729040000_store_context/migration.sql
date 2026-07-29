CREATE TABLE `stores` (
  `id` VARCHAR(30) NOT NULL,
  `merchant_id` VARCHAR(30) NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `platform` VARCHAR(40) NOT NULL,
  `market` CHAR(2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `locale` VARCHAR(16) NOT NULL,
  `timezone` VARCHAR(64) NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `stores_merchant_id_code_key` (`merchant_id`, `code`),
  UNIQUE INDEX `stores_id_merchant_id_key` (`id`, `merchant_id`),
  INDEX `stores_merchant_id_status_created_at_idx` (`merchant_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `stores_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_listings` (
  `id` VARCHAR(30) NOT NULL,
  `merchant_id` VARCHAR(30) NOT NULL,
  `store_id` VARCHAR(30) NOT NULL,
  `product_id` VARCHAR(30) NOT NULL,
  `external_product_id` VARCHAR(100) NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `language` VARCHAR(16) NOT NULL,
  `price` DECIMAL(12, 2) NOT NULL,
  `currency` CHAR(3) NOT NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `product_listings_store_id_product_id_key` (`store_id`, `product_id`),
  INDEX `product_listings_merchant_id_store_id_status_updated_at_idx` (`merchant_id`, `store_id`, `status`, `updated_at`),
  INDEX `product_listings_merchant_id_product_id_idx` (`merchant_id`, `product_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_listings_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_listings_store_id_merchant_id_fkey` FOREIGN KEY (`store_id`, `merchant_id`) REFERENCES `stores` (`id`, `merchant_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_listings_product_id_merchant_id_fkey` FOREIGN KEY (`product_id`, `merchant_id`) REFERENCES `products` (`id`, `merchant_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `orders` ADD COLUMN `store_id` VARCHAR(30) NULL;
CREATE INDEX `orders_merchant_id_store_id_created_at_idx` ON `orders`(`merchant_id`, `store_id`, `created_at`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_store_id_merchant_id_fkey` FOREIGN KEY (`store_id`, `merchant_id`) REFERENCES `stores`(`id`, `merchant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `agent_runs` ADD COLUMN `store_id` VARCHAR(30) NULL;
CREATE INDEX `agent_runs_merchant_id_store_id_created_at_idx` ON `agent_runs`(`merchant_id`, `store_id`, `created_at`);
ALTER TABLE `agent_runs` ADD CONSTRAINT `agent_runs_store_id_merchant_id_fkey` FOREIGN KEY (`store_id`, `merchant_id`) REFERENCES `stores`(`id`, `merchant_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
