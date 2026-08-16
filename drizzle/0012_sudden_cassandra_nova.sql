CREATE TABLE `orderActionRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`customerId` int NOT NULL,
	`action` enum('cancellation_requested','replacement_requested') NOT NULL,
	`note` text,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orderActionRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `order_action_order_status_idx` ON `orderActionRequests` (`orderId`,`status`);--> statement-breakpoint
CREATE INDEX `order_action_customer_created_idx` ON `orderActionRequests` (`customerId`,`createdAt`);