"use strict";

/**
 * Herramienta: resumen_servicios_por_estado
 *
 * Qué consulta (solo lectura):
 *   - estadosServicio: catálogo oficial de estados (nombre, label, defaultFacturar,
 *     dejarDeMostrar), el mismo que configura la app en "Estados de servicio".
 *   - vehiculos: SOLO conteos agregados (count()) del total y de cada status del
 *     catálogo. No lee ningún documento de vehículo, así que no toca datos de clientes.
 * Qué devuelve: el número de servicios en cada estado actual del catálogo, en los
 *   estados que asigna el propio sistema (ESTADOS_DEL_SISTEMA) y los que tienen un
 *   status no reconocido (por ejemplo, valores históricos).
 * Qué NO hace: no filtra por fechas ni interpreta qué estados significan "entregado",
 *   "pendiente" o "facturado": eso son reglas de negocio que no decide la herramienta.
 *   Solo informa las marcas tal como están en la configuración.
 * Autorización: la ejecuta el servidor tras verificar owner/admin; el modelo no
 *   puede elegir colecciones, filtros ni consultas.
 */

const NOMBRE = "resumen_servicios_por_estado";

// Estados que asigna el código y no forman parte del catálogo configurable:
// "por_cobrar" lo pone el editor de servicios al enviar un servicio a cuentas por
// cobrar (ServicioEditor.js) y se crea así en cuentasPorCobrarFirebase.js.
const ESTADOS_DEL_SISTEMA = [
  { nombre: "por_cobrar", etiqueta: "Por cobrar (entregado, pendiente de pago)" },
];
const MAX_ESTADOS = 50;
const MAX_TEXTO_ESTADO = 60;

const definicion = {
  nombre: NOMBRE,
  descripcion:
    "Cuenta los servicios (vehículos) registrados en Turbinas App según su estado actual, " +
    "usando el catálogo oficial de estados de servicio y el estado del sistema 'por_cobrar' " +
    "(servicio entregado pendiente de pago, en cuentas por cobrar). Devuelve el total, la cantidad " +
    "por estado y cuántos tienen un estado no reconocido. No admite filtros ni fechas: describe el " +
    "estado actual de todos los registros. Úsala solo cuando la pregunta requiera datos reales " +
    "de servicios o vehículos por estado.",
  // Mismo formato que input_schema de una definición de herramienta del proveedor
  esquema: { type: "object", properties: {}, additionalProperties: false },
  datos: ["estadosServicio: nombre, label, defaultFacturar, dejarDeMostrar", "vehiculos: solo conteos agregados por status"],
  roles: ["owner", "admin"],
};

function textoSeguro(valor) {
  return typeof valor === "string" && valor.trim() !== "" && valor.length <= MAX_TEXTO_ESTADO ? valor.trim() : null;
}

/**
 * fuente (solo lectura, ver firebase.js):
 *   leerEstadosServicio() -> [{ nombre, label, defaultFacturar, dejarDeMostrar }]
 *   contarVehiculos() -> número
 *   contarVehiculosConStatus(nombre) -> número
 */
async function ejecutar(_argumentos, { fuente, ahora = () => new Date() }) {
  const estadosCrudos = await fuente.leerEstadosServicio();
  if (!Array.isArray(estadosCrudos)) throw new Error("catalogo_invalido");
  if (estadosCrudos.length > MAX_ESTADOS) {
    return { error: { codigo: "catalogo_demasiado_grande", mensaje: `El catálogo tiene más de ${MAX_ESTADOS} estados.` } };
  }

  const vistos = new Set();
  const estados = [];
  let omitidos = 0;
  for (const e of estadosCrudos) {
    const nombre = textoSeguro(e && e.nombre);
    if (!nombre || vistos.has(nombre)) {
      omitidos += 1;
      continue;
    }
    vistos.add(nombre);
    estados.push({
      nombre,
      etiqueta: textoSeguro(e.label) || nombre,
      origen: "catalogo",
      esEstadoFacturacion: e.defaultFacturar === true,
      dejaDeMostrarse: e.dejarDeMostrar === true,
    });
  }
  // Si el catálogo ya define un estado del sistema, se respeta el del catálogo
  for (const sistema of ESTADOS_DEL_SISTEMA) {
    if (vistos.has(sistema.nombre)) continue;
    vistos.add(sistema.nombre);
    estados.push({ ...sistema, origen: "sistema", esEstadoFacturacion: false, dejaDeMostrarse: false });
  }

  const total = await fuente.contarVehiculos();
  const porEstado = [];
  for (const estado of estados) {
    porEstado.push({ ...estado, cantidad: await fuente.contarVehiculosConStatus(estado.nombre) });
  }
  for (const n of [total, ...porEstado.map((e) => e.cantidad)]) {
    if (!Number.isInteger(n) || n < 0) throw new Error("conteo_invalido");
  }

  const reconocidos = porEstado.reduce((acc, e) => acc + e.cantidad, 0);
  const notas = [
    "Conteos agregados del estado actual (campo status) de la colección vehiculos.",
    "Cada conteo es una consulta independiente: si hubo cambios durante la consulta, las cifras pueden no cuadrar exactamente.",
  ];
  if (omitidos > 0) notas.push(`${omitidos} estado(s) del catálogo sin nombre válido o repetidos no se contaron.`);
  if (reconocidos > total) notas.push("La suma por estado supera el total: los datos cambiaron durante la consulta.");

  return {
    resultado: {
      herramienta: NOMBRE,
      fuente: "Turbinas App (Firestore): estadosServicio y conteos de vehiculos",
      consultadoEn: ahora().toISOString(),
      totalServicios: total,
      porEstado: porEstado.sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre)),
      conEstadoNoReconocido: Math.max(0, total - reconocidos),
      notas,
    },
  };
}

module.exports = { definicion, ejecutar, NOMBRE, ESTADOS_DEL_SISTEMA };
