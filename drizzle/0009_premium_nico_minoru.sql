CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entityType` enum('meal','kitchen') NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `favorites_user_entity_unique` UNIQUE(`userId`,`entityType`,`entityId`)
);
--> statement-breakpoint
CREATE INDEX `favorites_user_type_idx` ON `favorites` (`userId`,`entityType`);--> statement-breakpoint
CREATE INDEX `favorites_entity_idx` ON `favorites` (`entityType`,`entityId`);