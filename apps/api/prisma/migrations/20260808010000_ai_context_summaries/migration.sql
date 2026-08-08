CREATE TABLE `ai_conversation_summaries` (
    `id` VARCHAR(30) NOT NULL,
    `session_id` VARCHAR(30) NOT NULL,
    `covered_through_message_id` VARCHAR(30) NOT NULL,
    `summary_json` JSON NOT NULL,
    `source_message_count` INTEGER NOT NULL,
    `estimated_source_tokens` INTEGER NOT NULL,
    `prompt_tokens` INTEGER NOT NULL DEFAULT 0,
    `completion_tokens` INTEGER NOT NULL DEFAULT 0,
    `total_tokens` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ai_summary_session_anchor_key`(`session_id`, `covered_through_message_id`),
    INDEX `ai_summary_session_created_idx`(`session_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ai_conversation_summaries`
    ADD CONSTRAINT `ai_conversation_summaries_session_id_fkey`
    FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
