ALTER TABLE `rule_documents`
    ADD COLUMN `market` VARCHAR(32) NULL,
    ADD COLUMN `language` VARCHAR(16) NULL,
    ADD COLUMN `category` VARCHAR(64) NULL,
    ADD COLUMN `effective_from` DATETIME(3) NULL,
    ADD COLUMN `effective_to` DATETIME(3) NULL,
    ADD COLUMN `version` VARCHAR(64) NULL,
    ADD COLUMN `supersedes_document_id` VARCHAR(30) NULL;

CREATE INDEX `rule_documents_platform_market_category_status_idx`
    ON `rule_documents`(`platform`, `market`, `category`, `status`);
CREATE INDEX `rule_documents_effective_from_effective_to_idx`
    ON `rule_documents`(`effective_from`, `effective_to`);
CREATE INDEX `rule_documents_supersedes_document_id_idx`
    ON `rule_documents`(`supersedes_document_id`);

ALTER TABLE `rule_documents`
    ADD CONSTRAINT `rule_documents_supersedes_document_id_fkey`
    FOREIGN KEY (`supersedes_document_id`) REFERENCES `rule_documents`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
