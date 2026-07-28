-- CreateTable
CREATE TABLE `rule_documents` (
    `id` VARCHAR(30) NOT NULL,
    `merchant_id` VARCHAR(30) NULL,
    `created_by_id` VARCHAR(30) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `platform` VARCHAR(64) NOT NULL,
    `scope` ENUM('GLOBAL', 'MERCHANT') NOT NULL,
    `source_url` VARCHAR(500) NULL,
    `content` MEDIUMTEXT NOT NULL,
    `content_hash` CHAR(64) NOT NULL,
    `status` ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rule_documents_merchant_id_status_created_at_idx`(`merchant_id`, `status`, `created_at`),
    INDEX `rule_documents_scope_status_created_at_idx`(`scope`, `status`, `created_at`),
    INDEX `rule_documents_content_hash_idx`(`content_hash`),
    INDEX `rule_documents_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rule_chunks` (
    `id` VARCHAR(30) NOT NULL,
    `document_id` VARCHAR(30) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `heading` VARCHAR(255) NULL,
    `content` TEXT NOT NULL,
    `search_terms` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `rule_chunks_document_id_sequence_key`(`document_id`, `sequence`),
    INDEX `rule_chunks_document_id_idx`(`document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rule_documents`
    ADD CONSTRAINT `rule_documents_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rule_documents`
    ADD CONSTRAINT `rule_documents_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rule_chunks`
    ADD CONSTRAINT `rule_chunks_document_id_fkey`
    FOREIGN KEY (`document_id`) REFERENCES `rule_documents`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
