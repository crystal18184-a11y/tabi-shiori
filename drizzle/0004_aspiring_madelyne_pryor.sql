ALTER TABLE `shared_trips` MODIFY COLUMN `tripData` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `user_trip_data` MODIFY COLUMN `tripData` mediumtext NOT NULL;