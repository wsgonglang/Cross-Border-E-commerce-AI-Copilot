ALTER TABLE `orders`
    ADD COLUMN `payment_status` ENUM('UNPAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED') NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN `fulfillment_status` ENUM('UNFULFILLED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'UNFULFILLED',
    ADD COLUMN `tracking_number` VARCHAR(100) NULL,
    ADD COLUMN `carrier` VARCHAR(100) NULL,
    ADD COLUMN `refund_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

UPDATE `orders`
SET
    `payment_status` = CASE
        WHEN `status` = 'REFUNDED' THEN 'REFUNDED'
        WHEN `status` IN ('CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'REFUNDING') THEN 'PAID'
        ELSE 'UNPAID'
    END,
    `fulfillment_status` = CASE
        WHEN `status` = 'PENDING' THEN 'UNFULFILLED'
        WHEN `status` = 'CONFIRMED' THEN 'PROCESSING'
        WHEN `status` = 'SHIPPED' THEN 'SHIPPED'
        WHEN `status` IN ('DELIVERED', 'COMPLETED', 'REFUNDING', 'REFUNDED') THEN 'DELIVERED'
        ELSE 'CANCELLED'
    END,
    `refund_amount` = CASE
        WHEN `status` = 'REFUNDED' THEN `total_amount`
        ELSE 0
    END;

CREATE INDEX `orders_ops_filter_idx`
    ON `orders`(`merchant_id`, `payment_status`, `fulfillment_status`, `created_at`);

CREATE TABLE `order_saved_views` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `filters` JSON NOT NULL,
    `sort_by` VARCHAR(32) NOT NULL DEFAULT 'createdAt',
    `sort_order` VARCHAR(4) NOT NULL DEFAULT 'desc',
    `columns` JSON NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `order_saved_views_merchant_id_user_id_name_key`(`merchant_id`, `user_id`, `name`),
    INDEX `order_saved_views_merchant_id_user_id_is_default_idx`(`merchant_id`, `user_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_events` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `order_id` VARCHAR(30) NOT NULL,
    `actor_user_id` VARCHAR(30) NULL,
    `type` ENUM('CREATED', 'STATUS_CHANGED', 'BULK_OPERATION', 'NOTE') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_events_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `order_events_merchant_id_created_at_idx`(`merchant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `order_events` (
    `id`,
    `merchant_id`,
    `order_id`,
    `type`,
    `title`,
    `description`,
    `metadata`,
    `created_at`
)
SELECT
    CONCAT('evt_', LEFT(REPLACE(UUID(), '-', ''), 26)),
    `merchant_id`,
    `id`,
    'CREATED',
    '订单已创建',
    '迁移现有订单生成的初始时间线',
    JSON_OBJECT('status', `status`),
    `created_at`
FROM `orders`;

CREATE TABLE `order_bulk_operations` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `idempotency_key` VARCHAR(100) NOT NULL,
    `payload_hash` CHAR(64) NOT NULL,
    `action` ENUM('CONFIRM', 'MARK_SHIPPED', 'MARK_DELIVERED', 'CANCEL', 'START_REFUND', 'CONFIRM_REFUND') NOT NULL,
    `status` ENUM('RUNNING', 'COMPLETED', 'PARTIAL_FAILED') NOT NULL DEFAULT 'RUNNING',
    `total_items` INTEGER NOT NULL,
    `succeeded_items` INTEGER NOT NULL DEFAULT 0,
    `failed_items` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `completed_at` DATETIME(3) NULL,

    UNIQUE INDEX `order_bulk_operations_merchant_id_idempotency_key_key`(`merchant_id`, `idempotency_key`),
    INDEX `order_bulk_operations_merchant_id_created_at_idx`(`merchant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order_bulk_items` (
    `id` VARCHAR(30) NOT NULL,
    `operation_id` VARCHAR(30) NOT NULL,
    `requested_order_id` VARCHAR(30) NOT NULL,
    `order_id` VARCHAR(30) NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `from_status` ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDING', 'REFUNDED') NULL,
    `to_status` ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDING', 'REFUNDED') NULL,
    `error` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `order_bulk_items_operation_id_requested_order_id_key`(`operation_id`, `requested_order_id`),
    INDEX `order_bulk_items_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `order_saved_views`
    ADD CONSTRAINT `order_saved_views_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `order_saved_views_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `order_events`
    ADD CONSTRAINT `order_events_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `order_events_order_id_merchant_id_fkey`
    FOREIGN KEY (`order_id`, `merchant_id`) REFERENCES `orders`(`id`, `merchant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `order_events_actor_user_id_fkey`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `order_bulk_operations`
    ADD CONSTRAINT `order_bulk_operations_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `order_bulk_operations_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_bulk_items`
    ADD CONSTRAINT `order_bulk_items_operation_id_fkey`
    FOREIGN KEY (`operation_id`) REFERENCES `order_bulk_operations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `order_bulk_items_order_id_fkey`
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
