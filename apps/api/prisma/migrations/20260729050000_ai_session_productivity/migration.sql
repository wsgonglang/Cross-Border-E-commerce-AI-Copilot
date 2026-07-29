ALTER TABLE `ai_sessions`
    ADD COLUMN `archived_at` DATETIME(3) NULL;

CREATE INDEX `ai_sessions_merchant_id_user_id_archived_at_updated_at_idx`
    ON `ai_sessions`(`merchant_id`, `user_id`, `archived_at`, `updated_at`);
DROP INDEX `ai_sessions_merchant_id_user_id_updated_at_idx` ON `ai_sessions`;

ALTER TABLE `ai_messages`
    ADD COLUMN `favorited` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `ai_message_links` (
    `id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NOT NULL,
    `message_id` VARCHAR(30) NOT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `entity_type` VARCHAR(24) NOT NULL,
    `entity_id` VARCHAR(30) NOT NULL,
    `entity_code` VARCHAR(64) NOT NULL,
    `entity_label` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ai_message_links_message_id_entity_type_entity_id_key`(`message_id`, `entity_type`, `entity_id`),
    INDEX `ai_message_links_session_id_created_at_idx`(`session_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_session_shares` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NOT NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `snapshot` JSON NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `ai_session_shares_merchant_id_created_at_idx`(`merchant_id`, `created_at`),
    INDEX `ai_session_shares_session_id_created_at_idx`(`session_id`, `created_at`),
    INDEX `ai_session_shares_expires_at_revoked_at_idx`(`expires_at`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_session_share_recipients` (
    `share_id` VARCHAR(30) NOT NULL,
    `user_id` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_session_share_recipients_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`share_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ai_message_links`
    ADD CONSTRAINT `ai_message_links_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_message_links`
    ADD CONSTRAINT `ai_message_links_message_id_fkey`
    FOREIGN KEY (`message_id`) REFERENCES `ai_messages`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_message_links`
    ADD CONSTRAINT `ai_message_links_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ai_session_shares`
    ADD CONSTRAINT `ai_session_shares_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ai_session_shares`
    ADD CONSTRAINT `ai_session_shares_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_session_shares`
    ADD CONSTRAINT `ai_session_shares_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ai_session_share_recipients`
    ADD CONSTRAINT `ai_session_share_recipients_share_id_fkey`
    FOREIGN KEY (`share_id`) REFERENCES `ai_session_shares`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ai_session_share_recipients`
    ADD CONSTRAINT `ai_session_share_recipients_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
