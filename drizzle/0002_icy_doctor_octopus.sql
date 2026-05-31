CREATE TABLE `user_trip_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` varchar(128) NOT NULL,
	`tripData` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_trip_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_trip_data_clientId_unique` UNIQUE(`clientId`)
);
