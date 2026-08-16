CREATE TABLE `orderMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`senderId` int NOT NULL,
	`senderRole` enum('customer','mother','driver') NOT NULL,
	`senderName` varchar(160) NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `driverId` int;--> statement-breakpoint
CREATE INDEX `order_messages_order_created_idx` ON `orderMessages` (`orderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `order_messages_sender_idx` ON `orderMessages` (`senderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_driver_status_idx` ON `orders` (`driverId`,`status`);