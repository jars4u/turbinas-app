
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Endpoint de registro de usuario
app.post("/register", async (req, res) => {
  const { usuario, clave, admin = false } = req.body;
  if (!usuario || !clave) {
    return res.status(400).json({ error: "Usuario y clave requeridos" });
  }
  try {
    const existe = await prisma.usuario.findUnique({ where: { usuario } });
    if (existe) {
      return res.status(409).json({ error: "El usuario ya existe" });
    }
    const hash = await bcrypt.hash(clave, 10);
    const nuevo = await prisma.usuario.create({ data: { usuario, clave: hash, admin } });
    res.json({ ok: true, usuario: nuevo.usuario });
  } catch (err) {
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

// Listar todos los usuarios
app.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({ select: { id: true, usuario: true, admin: true } });
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// Editar usuario (nombre, clave, admin)
app.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { usuario, clave, admin } = req.body;
  try {
    let data = { usuario, admin };
    if (clave) {
      data.clave = await bcrypt.hash(clave, 10);
    }
    const actualizado = await prisma.usuario.update({
      where: { id: Number(id) },
      data,
    });
    res.json({ ok: true, usuario: actualizado.usuario });
  } catch (err) {
    res.status(500).json({ error: "Error al editar usuario" });
  }
});

// Eliminar usuario
app.delete("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar usuario" });
  }
});

// Endpoint de login
app.post("/login", async (req, res) => {
  const { usuario, clave } = req.body;
  if (!usuario || !clave) {
    return res.status(400).json({ error: "Usuario y clave requeridos" });
  }
  const user = await prisma.usuario.findUnique({ where: { usuario } });
  if (!user) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  const match = await bcrypt.compare(clave, user.clave);
  if (!match) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  res.json({ ok: true, usuario: user.usuario });
});

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
  try {
    await prisma.vehiculo.delete({ where: { id: Number(id) } });
    res.json({ ok: true });
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'El vehículo no existe o ya fue eliminado.' });
    } else {
      res.status(500).json({ error: 'Error al eliminar el vehículo.' });
    }
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API escuchando en puerto ${PORT}`);
});
