CREATE TABLE `pushTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`token` varchar(512) NOT NULL,
	`platform` enum('ios','android','web') NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `announcements` ADD `imageUrl` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `imageUrl` text;--> statement-breakpoint
CREATE INDEX `push_tokens_user_active_idx` ON `pushTokens` (`userId`,`isActive`);--> statement-breakpoint
CREATE INDEX `announcements_active_order_idx` ON `announcements` (`isActive`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `announcements_schedule_idx` ON `announcements` (`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `offers_active_order_idx` ON `offers` (`isActive`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `offers_schedule_idx` ON `offers` (`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `offers_meal_idx` ON `offers` (`mealId`);