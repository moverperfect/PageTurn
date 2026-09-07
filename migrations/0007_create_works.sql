CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`first_publication_date` text
);
--> statement-breakpoint
CREATE INDEX `works_title_idx` ON `works` (`title`);