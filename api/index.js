import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Obtener todos los vehículos
app.get("/vehiculos", async (req, res) => {
  const vehiculos = await prisma.vehiculo.findMany();
  const serializados = vehiculos.map((v) => ({
    ...v,
    arrivalTime: v.arrivalTime?.toString(),
  }));
  res.json(serializados);
});

// Crear vehículo
app.post("/vehiculos", async (req, res) => {
  const {
    vehiculo,
    placa,
    servicio,
    arrivalTime,
    observaciones,
    customerName,
    customerPhone,
    status,
    precio,
  } = req.body;
  const nuevo = await prisma.vehiculo.create({
    data: {
      vehiculo,
      placa,
      servicio,
      arrivalTime,
      observaciones,
      customerName,
      customerPhone,
      status,
      precio,
    },
  });
  res.json({ ...nuevo, arrivalTime: nuevo.arrivalTime?.toString() });
});

// Editar vehículo
app.put("/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  const {
    vehiculo,
    placa,
    servicio,
    arrivalTime,
    observaciones,
    customerName,
    customerPhone,
    status,
    precio,
  } = req.body;
  const actualizado = await prisma.vehiculo.update({
    where: { id: Number(id) },
    data: {
      vehiculo,
      placa,
      servicio,
      arrivalTime,
      observaciones,
      customerName,
      customerPhone,
      status,
      precio,
    },
  });
  res.json({
    ...actualizado,
    arrivalTime: actualizado.arrivalTime?.toString(),
  });
});

// Eliminar vehículo
app.delete("/vehiculos/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.vehiculo.delete({ where: { id: Number(id) } });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
