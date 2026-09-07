CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_name_normalized_uidx` ON `subjects` (`name_normalized`);--> statement-breakpoint
CREATE TABLE `work_subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`provenance` text,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_subjects_work_subject_uidx` ON `work_subjects` (`work_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `work_subjects_subject_id_idx` ON `work_subjects` (`subject_id`);