CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationNumber` varchar(32) NOT NULL,
	`applicantId` int NOT NULL,
	`serviceId` int NOT NULL,
	`businessName` varchar(180) NOT NULL,
	`businessType` varchar(100) NOT NULL,
	`registrationNumber` varchar(80),
	`address` text NOT NULL,
	`contact` varchar(180) NOT NULL,
	`status` enum('draft','submitted','in_review','action_required','approved','rejected') NOT NULL DEFAULT 'draft',
	`currentDepartmentId` int,
	`submittedAt` timestamp,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `applications_applicationNumber_unique` UNIQUE(`applicationNumber`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`actorRole` varchar(32) NOT NULL,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80) NOT NULL,
	`metadata` text,
	`prevHash` varchar(64),
	`rowHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`systemType` varchar(100) NOT NULL,
	`status` enum('healthy','degraded','disabled') NOT NULL DEFAULT 'healthy',
	`lastCheckedAt` timestamp NOT NULL DEFAULT (now()),
	`successRate` int NOT NULL DEFAULT 99,
	CONSTRAINT `connectors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_access_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`departmentId` int,
	`scope` varchar(80) NOT NULL,
	`purpose` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consent_access_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consent_scopes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`applicantId` int NOT NULL,
	`scope` varchar(80) NOT NULL,
	`purpose` varchar(180) NOT NULL,
	`status` enum('granted','revoked') NOT NULL DEFAULT 'granted',
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `consent_scopes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`applicantId` int NOT NULL,
	`purpose` varchar(180) NOT NULL,
	`dataScopes` text NOT NULL,
	`status` enum('granted','revoked') NOT NULL DEFAULT 'granted',
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(160) NOT NULL,
	`shortName` varchar(64) NOT NULL,
	`description` text,
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`sourceSystem` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`fileName` varchar(240) NOT NULL,
	`storageKey` varchar(255),
	`referenceUrl` text,
	`status` enum('referenced','verified','rejected') NOT NULL DEFAULT 'referenced',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int,
	`connectorId` int,
	`direction` enum('outbound','inbound') NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`sourceSchema` varchar(120) NOT NULL,
	`canonicalSchema` varchar(120) NOT NULL,
	`status` enum('processed','failed','retrying') NOT NULL DEFAULT 'processed',
	`payloadSummary` text NOT NULL,
	`fieldNames` text,
	`payloadHash` varchar(64),
	`attempts` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`applicationId` int,
	`type` varchar(60) NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seed_markers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`markerKey` varchar(64) NOT NULL,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seed_markers_id` PRIMARY KEY(`id`),
	CONSTRAINT `seed_markers_markerKey_unique` UNIQUE(`markerKey`)
);
--> statement-breakpoint
CREATE TABLE `service_departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`departmentId` int NOT NULL,
	`sequence` int NOT NULL,
	`stepKey` varchar(80) NOT NULL DEFAULT 'verification',
	`stepLabel` varchar(160) NOT NULL DEFAULT 'Verification',
	`requiredScope` varchar(80),
	`slaDays` int NOT NULL DEFAULT 3,
	CONSTRAINT `service_departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`eligibility` text NOT NULL,
	`requiredDocuments` text NOT NULL,
	`expectedDays` int NOT NULL,
	`status` enum('available','paused') NOT NULL DEFAULT 'available',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_id` PRIMARY KEY(`id`),
	CONSTRAINT `services_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','official','admin') NOT NULL DEFAULT 'user',
	`departmentId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `vault_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`documentType` varchar(100) NOT NULL,
	`fileName` varchar(240) NOT NULL,
	`storageKey` varchar(255),
	`referenceUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`departmentId` int NOT NULL,
	`stepKey` varchar(80) NOT NULL,
	`label` varchar(160) NOT NULL,
	`sequence` int NOT NULL,
	`status` enum('pending','in_progress','completed','blocked','rejected') NOT NULL DEFAULT 'pending',
	`responsibleRole` varchar(100) NOT NULL,
	`requiredScope` varchar(80),
	`remarks` text,
	`slaDueAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `workflow_steps_id` PRIMARY KEY(`id`)
);
