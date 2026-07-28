CREATE TABLE `batch_optimization_tasks` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `target_language` VARCHAR(16) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `total_items` INTEGER NOT NULL,
    `completed_items` INTEGER NOT NULL DEFAULT 0,
    `failed_items` INTEGER NOT NULL DEFAULT 0,
    `cancelled_items` INTEGER NOT NULL DEFAULT 0,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `batch_optimization_tasks_merchant_id_idempotency_key_key`(`merchant_id`, `idempotency_key`),
    INDEX `batch_optimization_tasks_merchant_id_created_at_idx`(`merchant_id`, `created_at`),
    INDEX `batch_optimization_tasks_created_by_id_created_at_idx`(`created_by_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `batch_optimization_items` (
    `id` VARCHAR(30) NOT NULL,
    `task_id` VARCHAR(30) NOT NULL,
    `product_id` VARCHAR(30) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `error` VARCHAR(1000) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `batch_optimization_items_task_id_product_id_key`(`task_id`, `product_id`),
    INDEX `batch_optimization_items_task_id_status_idx`(`task_id`, `status`),
    INDEX `batch_optimization_items_product_id_created_at_idx`(`product_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product_optimizations`
    ADD COLUMN `batch_item_id` VARCHAR(30) NULL;

CREATE UNIQUE INDEX `product_optimizations_batch_item_id_key`
    ON `product_optimizations`(`batch_item_id`);

ALTER TABLE `batch_optimization_tasks`
    ADD CONSTRAINT `batch_optimization_tasks_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `batch_optimization_tasks_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `batch_optimization_items`
    ADD CONSTRAINT `batch_optimization_items_task_id_fkey`
    FOREIGN KEY (`task_id`) REFERENCES `batch_optimization_tasks`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `batch_optimization_items_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product_optimizations`
    ADD CONSTRAINT `product_optimizations_batch_item_id_fkey`
    FOREIGN KEY (`batch_item_id`) REFERENCES `batch_optimization_items`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
