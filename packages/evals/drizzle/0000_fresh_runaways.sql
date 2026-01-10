CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_metrics_id` integer,
	`model` text NOT NULL,
	`name` text,
	`description` text,
	`contextWindow` integer,
	`inputPrice` real,
	`outputPrice` real,
	`cacheWritesPrice` real,
	`cacheReadsPrice` real,
	`settings` text,
	`jobToken` text,
	`pid` integer,
	`socket_path` text,
	`concurrency` integer DEFAULT 2 NOT NULL,
	`timeout` integer DEFAULT 5 NOT NULL,
	`passed` integer DEFAULT 0 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`task_metrics_id`) REFERENCES `taskMetrics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `taskMetrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tokens_in` integer NOT NULL,
	`tokens_out` integer NOT NULL,
	`tokens_context` integer NOT NULL,
	`cache_writes` integer NOT NULL,
	`cache_reads` integer NOT NULL,
	`cost` real NOT NULL,
	`duration` integer NOT NULL,
	`tool_usage` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`task_metrics_id` integer,
	`language` text NOT NULL,
	`exercise` text NOT NULL,
	`iteration` integer DEFAULT 1 NOT NULL,
	`passed` integer,
	`started_at` text,
	`finished_at` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_metrics_id`) REFERENCES `taskMetrics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_language_exercise_iteration_idx` ON `tasks` (`run_id`,`language`,`exercise`,`iteration`);--> statement-breakpoint
CREATE TABLE `toolErrors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer,
	`task_id` integer,
	`tool_name` text NOT NULL,
	`error` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
