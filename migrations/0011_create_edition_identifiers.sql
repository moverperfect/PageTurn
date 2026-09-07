CREATE TABLE `edition_identifiers` (
	`id` text PRIMARY KEY NOT NULL,
	`edition_id` text NOT NULL,
	`namespace` text NOT NULL,
	`value` text NOT NULL,
	`value_normalized` text NOT NULL,
	`provenance` text,
	FOREIGN KEY (`edition_id`) REFERENCES `editions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_identifiers_namespace_value_uidx` ON `edition_identifiers` (`namespace`,`value_normalized`);--> statement-breakpoint
CREATE INDEX `edition_identifiers_edition_id_idx` ON `edition_identifiers` (`edition_id`);