CREATE TABLE `shared_trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(16) NOT NULL,
	`tripData` text NOT NULL,
	`ownerOpenId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shared_trips_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_trips_shareCode_unique` UNIQUE(`shareCode`)
);
