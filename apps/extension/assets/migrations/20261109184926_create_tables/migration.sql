CREATE TABLE `projects` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`isAdded` integer DEFAULT false NOT NULL,
	`path` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`agentSessionId` text,
	`customName` text,
	`harnessId` text NOT NULL,
	`hasWorked` integer DEFAULT false NOT NULL,
	`name` text NOT NULL,
	`projectId` text NOT NULL,
	`reportedTitle` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`statusChangedAt` text,
	`statusKind` text,
	`statusMessage` text,
	`statusProgress` integer,
	`terminalTitle` text,
	`viewedAt` text,
	CONSTRAINT `fk_sessions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);
