CREATE TABLE `projects` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`path` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`customName` text,
	`harnessId` text NOT NULL,
	`name` text NOT NULL,
	`projectId` text NOT NULL,
	CONSTRAINT `fk_sessions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
);
--> statement-breakpoint
CREATE TABLE `windows` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`key` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `windowProjects` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`projectId` text NOT NULL,
	`windowId` text NOT NULL,
	CONSTRAINT `fk_windowProjects_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`),
	CONSTRAINT `fk_windowProjects_windowId_windows_id_fk` FOREIGN KEY (`windowId`) REFERENCES `windows`(`id`),
	CONSTRAINT `windowProjects_windowId_projectId_unique` UNIQUE(`windowId`,`projectId`)
);
