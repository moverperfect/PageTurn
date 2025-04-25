ALTER TABLE `books` ADD `starting_page` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `finished` integer DEFAULT false NOT NULL;