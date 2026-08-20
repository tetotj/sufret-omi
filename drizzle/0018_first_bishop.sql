CREATE TABLE `mealCustomizationOptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mealId` varchar(64) NOT NULL,
	`type` enum('addition','removal') NOT NULL,
	`titleAr` text NOT NULL,
	`titleEn` text NOT NULL,
	`price` decimal(6,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mealCustomizationOptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `meal_customization_meal_type_idx` ON `mealCustomizationOptions` (`mealId`,`type`);