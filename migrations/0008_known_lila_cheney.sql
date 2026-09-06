-- Persist a searchable title key so catalog search can filter in D1.
-- SQLite requires a default when adding a NOT NULL column to a table that
-- may already have rows. D1 SQL cannot NFC-normalize or Unicode-fold, so this
-- backfill uses ASCII `lower(title)` only. Runtime writes set title_search
-- with NFC + JavaScript toLowerCase() then ς→σ. 0007 and 0008 ship together, so a
-- single deploy backfills an empty table.
ALTER TABLE `works` ADD `title_search` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `works` SET `title_search` = lower(`title`) WHERE `title_search` = '';--> statement-breakpoint
CREATE INDEX `works_title_search_idx` ON `works` (`title_search`);
