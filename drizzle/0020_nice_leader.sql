CREATE TABLE `authChallenges` (
	`id` varchar(64) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`purpose` enum('sign_in','sign_up','password_reset') NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `phoneVerifiedAt` timestamp;--> statement-breakpoint
CREATE INDEX `auth_challenges_phone_purpose_idx` ON `authChallenges` (`phone`,`purpose`,`createdAt`);--> statement-breakpoint
CREATE INDEX `auth_challenges_expiry_idx` ON `authChallenges` (`expiresAt`,`consumedAt`);