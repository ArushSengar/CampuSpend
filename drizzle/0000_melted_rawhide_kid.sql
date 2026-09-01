CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'UPI' NOT NULL,
	`upi_id` text,
	`balance` integer DEFAULT 0 NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`icon` text DEFAULT 'Wallet' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`limit` integer NOT NULL,
	`period` text DEFAULT 'MONTHLY' NOT NULL,
	`rollover` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `budgets_user_idx` ON `budgets` (`user_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`emoji` text DEFAULT '🧾' NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`kind` text DEFAULT 'EXPENSE' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_slug_idx` ON `categories` (`user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`emoji` text DEFAULT '🎯' NOT NULL,
	`color` text DEFAULT '#22c55e' NOT NULL,
	`target_amount` integer NOT NULL,
	`saved_amount` integer DEFAULT 0 NOT NULL,
	`deadline` integer,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_idx` ON `goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `recurrings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text DEFAULT 'EXPENSE' NOT NULL,
	`method` text DEFAULT 'UPI' NOT NULL,
	`category_id` text,
	`account_id` text,
	`merchant` text,
	`frequency` text DEFAULT 'MONTHLY' NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`next_run` integer NOT NULL,
	`last_run` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recurrings_user_idx` ON `recurrings` (`user_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`type` text DEFAULT 'EXPENSE' NOT NULL,
	`method` text DEFAULT 'UPI' NOT NULL,
	`account_id` text,
	`category_id` text,
	`merchant` text,
	`note` text,
	`occurred_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`source` text DEFAULT 'MANUAL' NOT NULL,
	`raw_text` text,
	`confidence` integer,
	`splits` text,
	`recurring_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurrings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tx_user_date_idx` ON `transactions` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `tx_user_category_idx` ON `transactions` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `tx_user_type_idx` ON `transactions` (`user_id`,`type`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`avatar_hue` integer DEFAULT 258 NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`monthly_income` integer DEFAULT 0 NOT NULL,
	`college` text,
	`ai_provider` text DEFAULT 'local' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);