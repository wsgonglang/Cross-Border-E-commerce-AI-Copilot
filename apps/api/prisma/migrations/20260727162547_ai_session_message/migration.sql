-- CreateTable
CREATE TABLE `ai_sessions` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `status` ENUM('IDLE', 'STREAMING', 'DONE', 'ERROR') NOT NULL DEFAULT 'IDLE',
    `error` VARCHAR(500) NULL,
    `pinned` BOOLEAN NOT NULL DEFAULT false,
    `group_id` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_sessions_merchant_id_user_id_updated_at_idx`(`merchant_id`, `user_id`, `updated_at`),
    INDEX `ai_sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_messages` (
    `id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NOT NULL,
    `role` VARCHAR(16) NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `parent_id` VARCHAR(30) NULL,
    `children_ids` JSON NOT NULL,
    `revision_json` JSON NULL,
    `revision_idx` INTEGER NOT NULL DEFAULT 0,

    INDEX `ai_messages_session_id_parent_id_idx`(`session_id`, `parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ai_sessions` ADD CONSTRAINT `ai_sessions_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_sessions` ADD CONSTRAINT `ai_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_messages` ADD CONSTRAINT `ai_messages_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
