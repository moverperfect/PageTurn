ALTER TABLE `books` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `reading_sessions` ADD `user_id` text REFERENCES user(id);
