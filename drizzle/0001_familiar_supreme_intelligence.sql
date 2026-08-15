CREATE TABLE `complaintImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`complaintId` varchar(64) NOT NULL,
	`uri` text NOT NULL,
	CONSTRAINT `complaintImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `complaintsDb` (
	`id` varchar(64) NOT NULL,
	`category` varchar(64) NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`orderId` varchar(64),
	`status` enum('new','in_review','resolved','closed') NOT NULL DEFAULT 'new',
	`response` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `complaintsDb_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kitchens` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`nameAr` text NOT NULL,
	`nameEn` text NOT NULL,
	`motherNameAr` text NOT NULL,
	`motherNameEn` text NOT NULL,
	`region` enum('amman','irbid','zarqa','salt','madaba') NOT NULL,
	`neighborhoodAr` text NOT NULL,
	`neighborhoodEn` text NOT NULL,
	`rating` decimal(3,2) NOT NULL DEFAULT '5.00',
	`reviewCount` int NOT NULL DEFAULT 0,
	`isOpen` boolean NOT NULL DEFAULT true,
	`image` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kitchens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` varchar(64) NOT NULL,
	`kitchenId` varchar(64) NOT NULL,
	`nameAr` text NOT NULL,
	`nameEn` text NOT NULL,
	`descriptionAr` text NOT NULL,
	`descriptionEn` text NOT NULL,
	`category` enum('mansaf','maqluba','mahshi','bakery','moona') NOT NULL,
	`price` decimal(6,2) NOT NULL,
	`prepMinutes` int NOT NULL,
	`dailyLimit` int NOT NULL,
	`available` boolean NOT NULL DEFAULT true,
	`image` text NOT NULL,
	CONSTRAINT `meals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(64) NOT NULL,
	`customerId` int NOT NULL,
	`kitchenId` varchar(64) NOT NULL,
	`total` decimal(8,2) NOT NULL,
	`paymentMethod` enum('cod','cliq','wallet') NOT NULL,
	`schedule` enum('now','scheduled') NOT NULL,
	`status` enum('received','preparing','ready','on_the_way','delivered') NOT NULL DEFAULT 'received',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`customerId` int NOT NULL,
	`kitchenId` varchar(64) NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kitchenId` varchar(64) NOT NULL,
	`amount` decimal(8,2) NOT NULL,
	`method` varchar(32) NOT NULL DEFAULT 'CliQ',
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'completed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userProfileId` varchar(64) NOT NULL,
	`labelAr` text NOT NULL,
	`labelEn` text NOT NULL,
	`uri` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` varchar(64) NOT NULL,
	`userId` int,
	`name` text NOT NULL,
	`phone` varchar(32) NOT NULL,
	`role` enum('customer','mother','driver') NOT NULL,
	`status` enum('active','pending_approval','suspended','rejected') NOT NULL DEFAULT 'pending_approval',
	`region` varchar(64) NOT NULL,
	`details` text,
	`rating` decimal(3,2),
	`ordersCount` int NOT NULL DEFAULT 0,
	`joinedDate` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','customer','mother','admin') NOT NULL DEFAULT 'customer';