-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" SERIAL NOT NULL,
    "vehiculo" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "servicio" TEXT NOT NULL,
    "arrivalTime" BIGINT NOT NULL,
    "observaciones" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'servicio',

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);
