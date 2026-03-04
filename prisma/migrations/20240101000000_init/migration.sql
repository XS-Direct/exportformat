-- CreateTable
CREATE TABLE `export_models` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'download',
    `outputFormat` VARCHAR(191) NOT NULL DEFAULT 'custom',
    `codeBefore` TEXT NOT NULL,
    `repeatingCode` TEXT NOT NULL,
    `codeAfter` TEXT NULL,
    `mockFields` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
