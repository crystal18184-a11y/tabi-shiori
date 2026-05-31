CREATE TABLE `recommended_spots` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(128) NOT NULL,
	`userName` text NOT NULL,
	`placeName` varchar(255) NOT NULL,
	`category` varchar(32) NOT NULL DEFAULT 'その他',
	`address` varchar(512) NOT NULL DEFAULT '',
	`lat` varchar(32) NOT NULL DEFAULT '',
	`lng` varchar(32) NOT NULL DEFAULT '',
	`comment` varchar(1000) NOT NULL DEFAULT '',
	`rating` int NOT NULL DEFAULT 3,
	`sourceUrl` varchar(1000) DEFAULT '',
	`photoUrl` varchar(1000) DEFAULT '',
	`prefecture` varchar(16) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recommended_spots_id` PRIMARY KEY(`id`)
);
