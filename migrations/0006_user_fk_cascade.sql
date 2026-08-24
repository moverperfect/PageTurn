-- Rebuild books and reading_sessions so their user_id foreign keys gain
-- ON DELETE CASCADE, matching src/lib/schema.ts (issue #291). SQLite cannot
-- alter a foreign key in place; D1 keeps foreign keys enforced, so the
-- rebuild defers enforcement until the migration's transaction commits.
--
-- Both copies happen before either drop, and the new reading_sessions
-- references __new_books rather than books: cascade actions still fire under
-- defer_foreign_keys, so dropping books must not be reachable from any table
-- that already holds copied rows. The rename rewrites the reference back.
PRAGMA defer_foreign_keys = true;--> statement-breakpoint
CREATE TABLE `__new_books` (
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
	`cost` real NOT NULL,
	`starting_page` integer DEFAULT 0 NOT NULL,
	`finished` integer DEFAULT false NOT NULL,
	`user_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_books` (`id`, `title`, `author`, `format`, `page_count`, `isbn`, `author_sex`, `recommended`, `genre`, `published_year`, `publisher`, `date_acquired`, `date_removed`, `cost`, `starting_page`, `finished`, `user_id`)
SELECT `id`, `title`, `author`, `format`, `page_count`, `isbn`, `author_sex`, `recommended`, `genre`, `published_year`, `publisher`, `date_acquired`, `date_removed`, `cost`, `starting_page`, `finished`, `user_id` FROM `books`;--> statement-breakpoint
CREATE TABLE `__new_reading_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`book_id` text NOT NULL,
	`pages_read` integer NOT NULL,
	`duration` integer NOT NULL,
	`finished` integer NOT NULL,
	`user_id` text,
	FOREIGN KEY (`book_id`) REFERENCES `__new_books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_reading_sessions` (`id`, `date`, `book_id`, `pages_read`, `duration`, `finished`, `user_id`)
SELECT `id`, `date`, `book_id`, `pages_read`, `duration`, `finished`, `user_id` FROM `reading_sessions`;--> statement-breakpoint
DROP TABLE `reading_sessions`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
ALTER TABLE `__new_reading_sessions` RENAME TO `reading_sessions`;--> statement-breakpoint
CREATE INDEX `books_user_id_idx` ON `books` (`user_id`);--> statement-breakpoint
CREATE INDEX `books_title_author_idx` ON `books` (`title`,`author`);--> statement-breakpoint
CREATE INDEX `books_finished_idx` ON `books` (`finished`);--> statement-breakpoint
CREATE INDEX `books_genre_idx` ON `books` (`genre`);--> statement-breakpoint
CREATE INDEX `books_user_title_id_idx` ON `books` (`user_id`,`title`,`id`);--> statement-breakpoint
CREATE INDEX `books_user_date_acquired_id_idx` ON `books` (`user_id`,`date_acquired`,`id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_book_id_idx` ON `reading_sessions` (`book_id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_user_id_idx` ON `reading_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_book_date_idx` ON `reading_sessions` (`book_id`,`date`);--> statement-breakpoint
CREATE INDEX `reading_sessions_user_date_id_idx` ON `reading_sessions` (`user_id`,`date`,`id`);
