CREATE TABLE IF NOT EXISTS `announcements` (
	`id` varchar(64) NOT NULL,
	`eyebrowAr` text NOT NULL,
	`eyebrowEn` text NOT NULL,
	`titleAr` text NOT NULL,
	`titleEn` text NOT NULL,
	`bodyAr` text NOT NULL,
	`bodyEn` text NOT NULL,
	`ctaAr` text NOT NULL,
	`ctaEn` text NOT NULL,
	`icon` varchar(64) NOT NULL DEFAULT 'campaign',
	`target` enum('meals','orders') NOT NULL DEFAULT 'meals',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `offers` (
	`id` varchar(64) NOT NULL,
	`mealId` varchar(64) NOT NULL,
	`badgeAr` text NOT NULL,
	`badgeEn` text NOT NULL,
	`discountPercent` decimal(5,2),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);

INSERT IGNORE INTO `announcements` (`id`, `eyebrowAr`, `eyebrowEn`, `titleAr`, `titleEn`, `bodyAr`, `bodyEn`, `ctaAr`, `ctaEn`, `icon`, `target`, `sortOrder`, `isActive`) VALUES
('announcement-multi-kitchen', 'تحديث جديد من سفرة أمي', 'A new Sufret Omi update', 'اطلبي من أكثر من مطعم', 'Order from multiple kitchens', 'قسّمنا السلة تلقائياً لكل مطبخ حتى توصلك طلباتك بسهولة.', 'Your cart is split for each kitchen for an easier delivery.', 'اكتشفي الأكلات', 'Discover meals', 'restaurant-menu', 'meals', 1, true),
('announcement-jordanian-offers', 'عروض أمهات الأردن', 'Jordanian home offers', 'نكهة بيتية بانتظارك', 'A home-cooked offer awaits', 'اكتشفي أكلات مميزة محضّرة بحب من مطابخ قريبة منك.', 'Discover special meals prepared with care by kitchens near you.', 'شاهدي العروض', 'See offers', 'local-offer', 'meals', 2, true),
('announcement-order-tracking', 'تتبّع أسهل لطلباتك', 'Easier order tracking', 'كل طلب في مكانه', 'Every order in one place', 'تابعي حالة كل مطبخ وسائق خطوة بخطوة من شاشة طلباتي.', 'Follow every kitchen and driver step by step from My Orders.', 'تتبعي طلباتك', 'Track orders', 'two-wheeler', 'orders', 3, true);

INSERT IGNORE INTO `offers` (`id`, `mealId`, `badgeAr`, `badgeEn`, `discountPercent`, `sortOrder`, `isActive`) VALUES
('offer-mansaf-family', 'mansaf-family', 'عرض سفرة العيلة', 'Family table offer', 10.00, 1, true),
('offer-maqluba-chicken', 'maqluba-chicken', 'خصم اليوم', 'Today''s discount', 15.00, 2, true),
('offer-zaatar-bakery', 'zaatar-bakery', 'عرض المخبوزات', 'Bakery offer', 10.00, 3, true);
