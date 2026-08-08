ALTER TABLE `agent_runs`
  ADD COLUMN `session_id` VARCHAR(30) NULL,
  ADD COLUMN `user_message_id` VARCHAR(30) NULL,
  ADD COLUMN `assistant_message_id` VARCHAR(30) NULL;

ALTER TABLE `agent_runs`
  ADD UNIQUE INDEX `agent_runs_assistant_message_id_key` (`assistant_message_id`),
  ADD INDEX `agent_runs_session_id_created_at_idx` (`session_id`, `created_at`),
  ADD INDEX `agent_runs_user_message_id_created_at_idx` (`user_message_id`, `created_at`);

ALTER TABLE `agent_runs`
  MODIFY COLUMN `status` ENUM('PLANNING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PLANNING';
