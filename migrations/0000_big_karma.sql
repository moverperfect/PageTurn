CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`format` text NOT NULL,
	`page_count` integer NOT NULL,
	`isbn` text NOT NULL,
	`author_sex` text NOT NULL,
	`recommended` integer NOT NULL,
	`genre` text NOT NULL,
	`published_year` integer NOT NULL,
	`publisher` text NOT NULL,
	`date_acquired` text NOT NULL,
	`date_removed` text,
	`cost` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`book_id` text NOT NULL,
	`pages_read` integer NOT NULL,
	`duration` integer NOT NULL,
	`finished` integer NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
