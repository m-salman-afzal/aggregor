CREATE TABLE `reviewComments` (
	`deletedAt` text,
	`id` text PRIMARY KEY,
	`sortId` integer DEFAULT 0 NOT NULL,
	`updatedAt` text NOT NULL,
	`body` text NOT NULL,
	`endLine` integer NOT NULL,
	`filePath` text NOT NULL,
	`startLine` integer NOT NULL
);
