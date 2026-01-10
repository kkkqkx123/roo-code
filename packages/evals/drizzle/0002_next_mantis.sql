PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_runs` (
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
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_metrics_id`) REFERENCES `taskMetrics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_runs`("id", "task_metrics_id", "model", "name", "description", "contextWindow", "inputPrice", "outputPrice", "cacheWritesPrice", "cacheReadsPrice", "settings", "jobToken", "pid", "socket_path", "concurrency", "timeout", "passed", "failed", "created_at") SELECT "id", "task_metrics_id", "model", "name", "description", "contextWindow", "inputPrice", "outputPrice", "cacheWritesPrice", "cacheReadsPrice", "settings", "jobToken", "pid", "socket_path", "concurrency", "timeout", "passed", "failed", "created_at" FROM `runs`;--> statement-breakpoint
DROP TABLE `runs`;--> statement-breakpoint
ALTER TABLE `__new_runs` RENAME TO `runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_taskMetrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tokens_in` integer NOT NULL,
	`tokens_out` integer NOT NULL,
	`tokens_context` integer NOT NULL,
	`cache_writes` integer NOT NULL,
	`cache_reads` integer NOT NULL,
	`cost` real NOT NULL,
	`duration` integer NOT NULL,
	`tool_usage` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_taskMetrics`("id", "tokens_in", "tokens_out", "tokens_context", "cache_writes", "cache_reads", "cost", "duration", "tool_usage", "created_at") SELECT "id", "tokens_in", "tokens_out", "tokens_context", "cache_writes", "cache_reads", "cost", "duration", "tool_usage", "created_at" FROM `taskMetrics`;--> statement-breakpoint
DROP TABLE `taskMetrics`;--> statement-breakpoint
ALTER TABLE `__new_taskMetrics` RENAME TO `taskMetrics`;--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`task_metrics_id` integer,
	`language` text NOT NULL,
	`exercise` text NOT NULL,
	`iteration` integer DEFAULT 1 NOT NULL,
	`passed` integer,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_metrics_id`) REFERENCES `taskMetrics`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "run_id", "task_metrics_id", "language", "exercise", "iteration", "passed", "started_at", "finished_at", "created_at") SELECT "id", "run_id", "task_metrics_id", "language", "exercise", "iteration", "passed", "started_at", "finished_at", "created_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_language_exercise_iteration_idx` ON `tasks` (`run_id`,`language`,`exercise`,`iteration`);