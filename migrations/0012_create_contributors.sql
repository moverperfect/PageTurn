CREATE TABLE `contributors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_search` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contributors_name_search_uidx` ON `contributors` (`name_search`);--> statement-breakpoint
CREATE TABLE `contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`contributor_id` text NOT NULL,
	`work_id` text,
	`edition_id` text,
	`role` text NOT NULL,
	FOREIGN KEY (`contributor_id`) REFERENCES `contributors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contributions_contributor_id_idx` ON `contributions` (`contributor_id`);--> statement-breakpoint
CREATE INDEX `contributions_work_id_idx` ON `contributions` (`work_id`);--> statement-breakpoint
CREATE INDEX `contributions_edition_id_idx` ON `contributions` (`edition_id`);
