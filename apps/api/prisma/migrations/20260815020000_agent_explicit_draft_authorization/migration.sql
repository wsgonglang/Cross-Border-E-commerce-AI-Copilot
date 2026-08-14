ALTER TABLE `agent_runs`
  ADD COLUMN `allow_draft_creation` BOOLEAN NOT NULL DEFAULT false;
