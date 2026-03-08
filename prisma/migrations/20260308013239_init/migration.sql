-- CreateTable
CREATE TABLE "CashBook" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CashBook_pkey" PRIMARY KEY ("id")
);
