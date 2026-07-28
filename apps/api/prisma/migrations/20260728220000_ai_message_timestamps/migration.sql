ALTER TABLE `ai_messages`
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `ai_messages_session_id_created_at_idx`
    ON `ai_messages`(`session_id`, `created_at`);
