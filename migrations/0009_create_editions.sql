CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`displayed_title` text,
	`language` text,
	`publisher` text,
	`publication_date` text,
	`format` text NOT NULL,
	`progress_unit` text NOT NULL,
	`cover_url` text,
	`edition_length` integer
);
--> statement-breakpoint
CREATE INDEX `editions_format_idx` ON `editions` (`format`);--> statement-breakpoint
CREATE TABLE `edition_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`work_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `edition_contents_edition_id_idx` ON `edition_contents` (`edition_id`);--> statement-breakpoint
CREATE INDEX `edition_contents_work_id_idx` ON `edition_contents` (`work_id`);
