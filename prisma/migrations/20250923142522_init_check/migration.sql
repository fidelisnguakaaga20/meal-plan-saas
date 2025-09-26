/*
  Warnings:

  - You are about to drop the column `stripSubscriptionId` on the `Profile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeSubscriptionId]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Profile_stripSubscriptionId_key";

-- AlterTable
ALTER TABLE "public"."Profile" DROP COLUMN "stripSubscriptionId",
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_stripeSubscriptionId_key" ON "public"."Profile"("stripeSubscriptionId");
