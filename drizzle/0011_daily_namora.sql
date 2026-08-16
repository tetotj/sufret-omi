CREATE TABLE `driverLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(64) NOT NULL,
	`driverId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`accuracy` decimal(8,2),
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driverLocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `driver_locations_order_captured_idx` ON `driverLocations` (`orderId`,`capturedAt`);--> statement-breakpoint
CREATE INDEX `driver_locations_driver_captured_idx` ON `driverLocations` (`driverId`,`capturedAt`);