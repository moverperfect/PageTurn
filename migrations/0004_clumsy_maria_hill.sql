CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `account_provider_idx` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `books_user_id_idx` ON `books` (`user_id`);--> statement-breakpoint
CREATE INDEX `books_title_author_idx` ON `books` (`title`,`author`);--> statement-breakpoint
CREATE INDEX `books_finished_idx` ON `books` (`finished`);--> statement-breakpoint
CREATE INDEX `books_genre_idx` ON `books` (`genre`);--> statement-breakpoint
CREATE INDEX `books_user_title_id_idx` ON `books` (`user_id`,`title`,`id`);--> statement-breakpoint
CREATE INDEX `books_user_date_acquired_id_idx` ON `books` (`user_id`,`date_acquired`,`id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_book_id_idx` ON `reading_sessions` (`book_id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_user_id_idx` ON `reading_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `reading_sessions_book_date_idx` ON `reading_sessions` (`book_id`,`date`);--> statement-breakpoint
CREATE INDEX `reading_sessions_user_date_id_idx` ON `reading_sessions` (`user_id`,`date`,`id`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_at_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `verification_expires_at_idx` ON `verification` (`expires_at`);