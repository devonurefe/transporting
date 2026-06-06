/*
  Warnings:

  - You are about to alter the column `date` on the `BlockedDate` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.
  - You are about to alter the column `suitableFor` on the `Machine` table. The data in that column could be lost. The data in that column will be cast from `String` to `Json`.
  - You are about to alter the column `endDate` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.
  - You are about to alter the column `startDate` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlockedDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    CONSTRAINT "BlockedDate_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BlockedDate" ("date", "id", "machineId", "reason") SELECT "date", "id", "machineId", "reason" FROM "BlockedDate";
DROP TABLE "BlockedDate";
ALTER TABLE "new_BlockedDate" RENAME TO "BlockedDate";
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "profile" TEXT,
    "companyName" TEXT,
    "address" TEXT,
    "avatarUrl" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Customer" ("createdAt", "email", "id", "name", "passwordHash", "phone", "profile") SELECT "createdAt", "email", "id", "name", "passwordHash", "phone", "profile" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE TABLE "new_Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryLabel" TEXT NOT NULL,
    "height" REAL NOT NULL,
    "reach" REAL NOT NULL,
    "weight" REAL NOT NULL,
    "pricePerDay" REAL NOT NULL,
    "powerType" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suitableFor" JSONB NOT NULL,
    "weeklyDiscountPercent" REAL,
    "monthlyDiscountPercent" REAL,
    "campaignText" TEXT,
    "campaignDiscountPercent" REAL,
    "campaignDiscountAmount" REAL,
    "packageContents" TEXT,
    "additionalImages" JSONB
);
INSERT INTO "new_Machine" ("campaignDiscountAmount", "campaignDiscountPercent", "campaignText", "category", "categoryLabel", "description", "height", "id", "imageAlt", "imageUrl", "monthlyDiscountPercent", "name", "powerType", "pricePerDay", "reach", "suitableFor", "weeklyDiscountPercent", "weight") SELECT "campaignDiscountAmount", "campaignDiscountPercent", "campaignText", "category", "categoryLabel", "description", "height", "id", "imageAlt", "imageUrl", "monthlyDiscountPercent", "name", "powerType", "pricePerDay", "reach", "suitableFor", "weeklyDiscountPercent", "weight" FROM "Machine";
DROP TABLE "Machine";
ALTER TABLE "new_Machine" RENAME TO "Machine";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "machineName" TEXT NOT NULL,
    "machinePrice" REAL NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "rentalDays" INTEGER NOT NULL,
    "deliveryType" TEXT NOT NULL,
    "deliveryAddress" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerProfile" TEXT,
    "subtotal" REAL NOT NULL,
    "transportCost" REAL NOT NULL,
    "driverCost" REAL NOT NULL,
    "vatAmount" REAL NOT NULL,
    "totalAmount" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customerId" TEXT,
    "addons" TEXT NOT NULL,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("addons", "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "customerProfile", "deliveryAddress", "deliveryType", "driverCost", "endDate", "id", "machineId", "machineName", "machinePrice", "rentalDays", "startDate", "status", "subtotal", "totalAmount", "transportCost", "vatAmount") SELECT "addons", "createdAt", "customerEmail", "customerId", "customerName", "customerPhone", "customerProfile", "deliveryAddress", "deliveryType", "driverCost", "endDate", "id", "machineId", "machineName", "machinePrice", "rentalDays", "startDate", "status", "subtotal", "totalAmount", "transportCost", "vatAmount" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
