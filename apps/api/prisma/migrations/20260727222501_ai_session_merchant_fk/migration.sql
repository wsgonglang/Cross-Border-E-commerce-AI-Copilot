-- The original AI session migration runs before commerce_catalog on a fresh
-- database, so the merchant foreign key must be added after merchants exists.
-- Existing development databases may already have the constraint from the
-- original history. MySQL has no ADD CONSTRAINT IF NOT EXISTS, therefore this
-- migration checks information_schema before executing the ALTER TABLE.

SET @ai_session_merchant_fk_exists = (
    SELECT COUNT(*)
    FROM `information_schema`.`TABLE_CONSTRAINTS`
    WHERE `CONSTRAINT_SCHEMA` = DATABASE()
      AND `TABLE_NAME` = 'ai_sessions'
      AND `CONSTRAINT_NAME` = 'ai_sessions_merchant_id_fkey'
      AND `CONSTRAINT_TYPE` = 'FOREIGN KEY'
);

SET @ai_session_merchant_fk_sql = IF(
    @ai_session_merchant_fk_exists = 0,
    'ALTER TABLE `ai_sessions` ADD CONSTRAINT `ai_sessions_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT 1'
);

PREPARE ai_session_merchant_fk_statement FROM @ai_session_merchant_fk_sql;
EXECUTE ai_session_merchant_fk_statement;
DEALLOCATE PREPARE ai_session_merchant_fk_statement;
