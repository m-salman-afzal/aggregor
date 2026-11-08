ALTER TABLE `sessions` ADD `hasWorked` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `reportedTitle` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `statusChangedAt` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `statusKind` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `statusMessage` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `statusProgress` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `terminalTitle` text;