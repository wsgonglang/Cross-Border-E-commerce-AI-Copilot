ALTER TABLE `products`
    ADD COLUMN `selling_points` JSON NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

UPDATE `products`
SET `selling_points` = JSON_ARRAY()
WHERE `selling_points` IS NULL;

ALTER TABLE `products`
    MODIFY COLUMN `selling_points` JSON NOT NULL;

CREATE TABLE `product_optimizations` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `product_id` VARCHAR(30) NOT NULL,
    `requested_by_id` VARCHAR(30) NOT NULL,
    `status` ENUM('GENERATING', 'DRAFT', 'APPLIED', 'REJECTED', 'ERROR') NOT NULL DEFAULT 'GENERATING',
    `target_language` VARCHAR(16) NOT NULL,
    `base_product_version` INTEGER NOT NULL,
    `source_data` JSON NOT NULL,
    `draft_data` JSON NULL,
    `provider_name` VARCHAR(64) NULL,
    `model_name` VARCHAR(128) NULL,
    `prompt_tokens` INTEGER NOT NULL DEFAULT 0,
    `completion_tokens` INTEGER NOT NULL DEFAULT 0,
    `total_tokens` INTEGER NOT NULL DEFAULT 0,
    `error` VARCHAR(1000) NULL,
    `applied_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_optimizations_merchant_id_product_id_created_at_idx`(`merchant_id`, `product_id`, `created_at`),
    INDEX `product_optimizations_requested_by_id_created_at_idx`(`requested_by_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_versions` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `product_id` VARCHAR(30) NOT NULL,
    `optimization_id` VARCHAR(30) NULL,
    `actor_user_id` VARCHAR(30) NOT NULL,
    `version` INTEGER NOT NULL,
    `before_data` JSON NOT NULL,
    `after_data` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `product_versions_optimization_id_key`(`optimization_id`),
    INDEX `product_versions_merchant_id_product_id_created_at_idx`(`merchant_id`, `product_id`, `created_at`),
    INDEX `product_versions_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    UNIQUE INDEX `product_versions_product_id_version_key`(`product_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product_optimizations`
    ADD CONSTRAINT `product_optimizations_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_optimizations`
    ADD CONSTRAINT `product_optimizations_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_optimizations`
    ADD CONSTRAINT `product_optimizations_requested_by_id_fkey`
    FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_versions`
    ADD CONSTRAINT `product_versions_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_versions`
    ADD CONSTRAINT `product_versions_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_versions`
    ADD CONSTRAINT `product_versions_optimization_id_fkey`
    FOREIGN KEY (`optimization_id`) REFERENCES `product_optimizations`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `product_versions`
    ADD CONSTRAINT `product_versions_actor_user_id_fkey`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
