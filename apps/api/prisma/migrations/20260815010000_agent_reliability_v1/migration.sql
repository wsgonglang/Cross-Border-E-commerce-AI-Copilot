ALTER TABLE `product_optimizations`
  ADD COLUMN `prompt_version` VARCHAR(64) NULL,
  ADD COLUMN `error_code` VARCHAR(40) NULL,
  ADD COLUMN `agent_run_id` VARCHAR(30) NULL,
  ADD UNIQUE INDEX `product_optimizations_agent_run_id_key` (`agent_run_id`);

ALTER TABLE `agent_runs`
  ADD COLUMN `days` INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN `prompt_version` VARCHAR(64) NULL,
  ADD COLUMN `error_code` VARCHAR(40) NULL,
  ADD COLUMN `started_at` DATETIME(3) NULL;

ALTER TABLE `agent_tool_calls`
  ADD COLUMN `started_at` DATETIME(3) NULL,
  ADD COLUMN `completed_at` DATETIME(3) NULL,
  ADD COLUMN `duration_ms` INTEGER NULL;

CREATE TABLE `agent_run_feedback` (
  `id` VARCHAR(30) NOT NULL,
  `run_id` VARCHAR(30) NOT NULL,
  `merchant_id` VARCHAR(30) NOT NULL,
  `user_id` VARCHAR(30) NOT NULL,
  `rating` ENUM('HELPFUL', 'NOT_HELPFUL') NOT NULL,
  `reason` ENUM('WRONG_TOOL', 'INACCURATE_DATA', 'INCOMPLETE_ANSWER', 'CITATION_ISSUE', 'TOO_SLOW', 'OTHER') NULL,
  `comment` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `agent_run_feedback_run_id_user_id_key` (`run_id`, `user_id`),
  INDEX `agent_run_feedback_merchant_id_created_at_idx` (`merchant_id`, `created_at`),
  INDEX `agent_run_feedback_user_id_created_at_idx` (`user_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `agent_run_feedback`
  ADD CONSTRAINT `agent_run_feedback_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `agent_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `agent_run_feedback_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `agent_run_feedback_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
