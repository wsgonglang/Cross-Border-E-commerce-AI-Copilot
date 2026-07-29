ALTER TABLE `product_optimizations`
    ADD COLUMN `import_item_id` VARCHAR(30) NULL;

CREATE UNIQUE INDEX `product_optimizations_import_item_id_key`
    ON `product_optimizations`(`import_item_id`);

CREATE TABLE `import_jobs` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_hash` CHAR(64) NOT NULL,
    `file_type` VARCHAR(16) NOT NULL,
    `worksheet` VARCHAR(120) NULL,
    `header_row` INTEGER NOT NULL DEFAULT 1,
    `mapping` JSON NOT NULL,
    `mode` ENUM('DRAFT_ONLY', 'DRAFT_AND_AI') NOT NULL,
    `target_language` VARCHAR(16) NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `total_items` INTEGER NOT NULL,
    `valid_items` INTEGER NOT NULL,
    `invalid_items` INTEGER NOT NULL,
    `completed_items` INTEGER NOT NULL DEFAULT 0,
    `failed_items` INTEGER NOT NULL DEFAULT 0,
    `cancelled_items` INTEGER NOT NULL DEFAULT 0,
    `cancelled_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `import_jobs_merchant_id_idempotency_key_key`(`merchant_id`, `idempotency_key`),
    INDEX `import_jobs_merchant_id_created_at_idx`(`merchant_id`, `created_at`),
    INDEX `import_jobs_merchant_id_status_created_at_idx`(`merchant_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `import_items` (
    `id` VARCHAR(30) NOT NULL,
    `job_id` VARCHAR(30) NOT NULL,
    `row_number` INTEGER NOT NULL,
    `status` ENUM('VALIDATION_FAILED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL,
    `source_data` JSON NOT NULL,
    `normalized_data` JSON NULL,
    `warnings` JSON NOT NULL,
    `error` VARCHAR(1000) NULL,
    `product_id` VARCHAR(30) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `import_items_job_id_row_number_key`(`job_id`, `row_number`),
    INDEX `import_items_job_id_status_row_number_idx`(`job_id`, `status`, `row_number`),
    INDEX `import_items_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `import_jobs`
    ADD CONSTRAINT `import_jobs_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `import_jobs`
    ADD CONSTRAINT `import_jobs_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `import_items`
    ADD CONSTRAINT `import_items_job_id_fkey`
    FOREIGN KEY (`job_id`) REFERENCES `import_jobs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `import_items`
    ADD CONSTRAINT `import_items_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `product_optimizations`
    ADD CONSTRAINT `product_optimizations_import_item_id_fkey`
    FOREIGN KEY (`import_item_id`) REFERENCES `import_items`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
