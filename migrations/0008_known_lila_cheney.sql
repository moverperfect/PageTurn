-- Persist a normalized title key so catalog search can filter in D1.
-- SQLite requires a default when adding a NOT NULL column to a table that
-- may already have rows; new writes always set title_search from the title.
ALTER TABLE `works` ADD `title_search` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `works` SET `title_search` = lower(`title`) WHERE `title_search` = '';--> statement-breakpoint
CREATE INDEX `works_title_search_idx` ON `works` (`title_search`);
