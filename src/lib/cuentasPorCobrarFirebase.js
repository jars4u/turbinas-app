import { db } from "../firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";

// Esquema único para crear documentos de "cuentasPorCobrar", usado tanto al
// enviar un servicio desde el Dashboard como al registrar una cuenta manual
// desde CuentasPorCobrar.js. Antes cada punto de creación generaba un
// conjunto distinto de campos (algunos sin status/vehiculoId/arrivalTime),
// lo que rompía filtros y validaciones según el origen del dato.
export async function crearCuentaPorCobrar(data = {}) {
  const nombre = (data.customerName || data.cliente || "").toString().trim().toUpperCase();
  const fechaRegistro = typeof data.fechaRegistro === "number" ? data.fechaRegistro : Date.now();
  const payload = {
    modalidad: "servicio",
    vehiculoId: data.vehiculoId || null,
    vehiculo: (data.vehiculo || "").toString().toUpperCase(),
    placa: (data.placa || "").toString().toUpperCase(),
    servicio: (data.servicio || "").toString().toUpperCase(),
    precio: parseFloat(data.precio) || 0,
    precioBs: parseFloat(data.precioBs) || 0,
    observaciones: data.observaciones || "",
    customerName: nombre,
    customerPhone: data.customerPhone || "",
    // Campo legacy mantenido en sincronía por compatibilidad con vistas antiguas
    cliente: nombre,
    status: "por_cobrar",
    fechaRegistro,
    arrivalTime: typeof data.arrivalTime === "number" ? data.arrivalTime : fechaRegistro,
  };
  return await addDoc(collection(db, "cuentasPorCobrar"), payload);
}

// Convierte una cuenta por cobrar en un ingreso cobrado, preservando los datos
// del cliente, el vínculo con el servicio de origen (vehiculoId) y la fecha
// real en que se prestó el servicio (separada de la fecha de cobro).
export async function cobrarCuentaPorCobrar(cuenta, facturaData = {}) {
  if (!cuenta || !cuenta.id) throw new Error("cobrarCuentaPorCobrar: cuenta inválida");

  const hoy = new Date();
  const fechaCobro = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;

  // Preservar la fecha original del servicio (antigüedad de la deuda / "aging"),
  // que de otra forma se perdía por completo al sobreescribir "fecha" con la
  // fecha de cobro.
  const fechaServicioMillis =
    (typeof cuenta.fechaRegistro === "number" && cuenta.fechaRegistro) ||
    (typeof cuenta.arrivalTime === "number" && cuenta.arrivalTime) ||
    null;
  const fechaServicio = fechaServicioMillis ? new Date(fechaServicioMillis) : null;
  const fechaServicioStr = fechaServicio
    ? `${String(fechaServicio.getDate()).padStart(2, "0")}/${String(fechaServicio.getMonth() + 1).padStart(2, "0")}/${fechaServicio.getFullYear()}`
    : null;

  const nombre = (cuenta.customerName || cuenta.cliente || "").toString().toUpperCase();

  const ingresoDoc = {
    tipo: "servicio",
    vehiculoId: cuenta.vehiculoId || null,
    vehiculo: (cuenta.vehiculo || "").toString().toUpperCase(),
    servicio: (cuenta.servicio || "").toString().toUpperCase(),
    precio: parseFloat(cuenta.precio) || 0,
    precioBs: parseFloat(cuenta.precioBs) || 0,
    observaciones: cuenta.observaciones || "",
    fecha: fechaCobro,
    fechaServicio: fechaServicioStr,
    factura: facturaData.numeroFactura || "",
    customerName: nombre,
    customerPhone: cuenta.customerPhone || "",
    formasPago: facturaData.formasPago || [],
    salidaInventario: Array.isArray(facturaData.formasPago) && facturaData.formasPago.some((fp) => fp.salidaInventario),
    // Trazabilidad hacia la cuenta por cobrar que originó este ingreso
    cuentaPorCobrarId: cuenta.id,
  };

  const ingresoRef = await addDoc(collection(db, "ingresosMovimientos"), ingresoDoc);
  await deleteDoc(doc(db, "cuentasPorCobrar", cuenta.id));

  // Cerrar el ciclo de vida del servicio original: si la cuenta vino de un
  // servicio del Dashboard (tiene vehiculoId), marcarlo con el estado final
  // de facturación para que deje de quedar "atascado" en status 'por_cobrar'
  // después de haber sido cobrado.
  if (cuenta.vehiculoId) {
    try {
      const { obtenerEstadosServicio } = await import("./estadosServicioFirebase");
      const { actualizarVehiculo } = await import("./vehiculosFirebase");
      const estados = await obtenerEstadosServicio();
      const estadoFinal = estados.find((e) => e.defaultFacturar)?.nombre;
      if (estadoFinal) {
        await actualizarVehiculo(cuenta.vehiculoId, { status: estadoFinal });
      }
    } catch (e) {
      console.error("cobrarCuentaPorCobrar: no se pudo actualizar el estado final del vehículo", e);
    }
  }

  return ingresoRef;
}

// --- Migración de datos existentes (no destructiva) ---------------------
// Solo completa campos faltantes en documentos ya creados con el esquema
// anterior/inconsistente. Nunca borra ni sobrescribe datos válidos que ya
// existan. Pensada para ejecutarse una sola vez desde el panel de owner.

// Normaliza documentos de "cuentasPorCobrar" (pendientes de cobro) que
// hayan sido creados antes de unificar el esquema: agrega status,
// vehiculoId, fechaRegistro/arrivalTime y sincroniza el campo legacy
// 'cliente' cuando falten, sin tocar los que ya están completos.
export async function migrarCuentasPorCobrarPendientes() {
  const snapshot = await getDocs(collection(db, "cuentasPorCobrar"));
  let actualizados = 0;
  let sinCambios = 0;
  let errores = 0;

  for (const docSnap of snapshot.docs) {
    try {
      const data = docSnap.data();
      const patch = {};
      const nombre = (data.customerName || data.cliente || "").toString().trim().toUpperCase();

      if (!data.modalidad) patch.modalidad = "servicio";
      if (!data.status) patch.status = "por_cobrar";
      if (!("vehiculoId" in data)) patch.vehiculoId = null;
      if (typeof data.fechaRegistro !== "number") patch.fechaRegistro = Date.now();
      const fechaBase = typeof data.fechaRegistro === "number" ? data.fechaRegistro : patch.fechaRegistro;
      if (typeof data.arrivalTime !== "number") patch.arrivalTime = fechaBase;
      if (nombre && data.cliente !== nombre) patch.cliente = nombre;
      if (nombre && data.customerName !== nombre) patch.customerName = nombre;

      if (Object.keys(patch).length > 0) {
        await updateDoc(doc(db, "cuentasPorCobrar", docSnap.id), patch);
        actualizados += 1;
      } else {
        sinCambios += 1;
      }
    } catch (e) {
      console.error("migrarCuentasPorCobrarPendientes: error en doc", docSnap.id, e);
      errores += 1;
    }
  }

  return { total: snapshot.size, actualizados, sinCambios, errores };
}

// Normaliza documentos de "ingresosMovimientos" que provienen del flujo de
// servicios pero quedaron con campos incompletos (sin 'tipo', o sin
// vehiculo/servicio explícitos aunque sí tengan 'descripcion'). No intenta
// adivinar cliente/teléfono: si esos datos no se guardaron en su momento,
// ya no es posible recuperarlos de forma confiable.
export async function migrarIngresosMovimientosServicio() {
  const snapshot = await getDocs(collection(db, "ingresosMovimientos"));
  let actualizados = 0;
  let sinCambios = 0;
  let errores = 0;

  for (const docSnap of snapshot.docs) {
    try {
      const data = docSnap.data();
      const patch = {};
      const pareceServicio = !!(data.vehiculo || data.servicio || typeof data.precio === "number");

      if (pareceServicio && !data.tipo) patch.tipo = "servicio";

      if (!data.vehiculo && !data.servicio && typeof data.descripcion === "string" && data.descripcion.includes(" - ")) {
        const [veh, ...resto] = data.descripcion.split(" - ");
        const servicio = resto.join(" - ").trim();
        if (veh && veh.trim()) patch.vehiculo = veh.trim().toUpperCase();
        if (servicio) patch.servicio = servicio.toUpperCase();
      }

      if (Object.keys(patch).length > 0) {
        await updateDoc(doc(db, "ingresosMovimientos", docSnap.id), patch);
        actualizados += 1;
      } else {
        sinCambios += 1;
      }
    } catch (e) {
      console.error("migrarIngresosMovimientosServicio: error en doc", docSnap.id, e);
      errores += 1;
    }
  }

  return { total: snapshot.size, actualizados, sinCambios, errores };
}
