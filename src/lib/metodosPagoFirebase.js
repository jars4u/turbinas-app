import { db } from "../firebase";
import {
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import {
  METODOS_PAGO_DEFAULT,
  MONEDA_BS,
  MONEDA_USD,
  normalizarMetodo,
  ordenarMetodos,
  setMetodosPagoCache,
} from "./metodosPago";

const COLLECTION = "metodosPago";

/**
 * El id del documento se deriva de la clave del método, así sembrar o agregar
 * dos veces sobrescribe el mismo documento en lugar de duplicarlo.
 */
function idDeClave(clave) {
  return normalizarMetodo(clave).replace(/\s+/g, "-") || "sin-nombre";
}

function mapDoc(d) {
  const data = d.data() || {};
  return {
    id: d.id,
    clave: data.clave || normalizarMetodo(data.nombre),
    nombre: data.nombre || "",
    moneda: data.moneda === MONEDA_BS ? MONEDA_BS : MONEDA_USD,
    activo: data.activo !== false,
    orden: Number.isFinite(Number(data.orden)) ? Number(data.orden) : 999,
    predeterminado: !!data.predeterminado,
  };
}

/**
 * Deja una sola entrada por clave. Prioriza el documento cuyo id coincide con
 * la clave (el canónico) y, si no existe, el de menor orden.
 */
function deduplicar(lista) {
  const porClave = new Map();
  for (const metodo of lista) {
    const clave = normalizarMetodo(metodo.clave || metodo.nombre);
    const previo = porClave.get(clave);
    if (!previo) {
      porClave.set(clave, metodo);
      continue;
    }
    const canonico = idDeClave(clave);
    if (metodo.id === canonico && previo.id !== canonico) {
      porClave.set(clave, metodo);
    }
  }
  return Array.from(porClave.values());
}

/** Borra los documentos repetidos que quedaron de siembras anteriores. */
async function limpiarDuplicados(lista, conservados) {
  const idsConservados = new Set(conservados.map((m) => m.id));
  const sobrantes = lista.filter((m) => !idsConservados.has(m.id));
  if (sobrantes.length === 0) return;
  try {
    const batch = writeBatch(db);
    sobrantes.forEach((m) => batch.delete(doc(db, COLLECTION, m.id)));
    await batch.commit();
  } catch (_) {
    // Sin permisos de escritura: la deduplicación en memoria ya evita mostrarlos
  }
}

/** Crea los métodos históricos la primera vez que se abre la aplicación. */
async function sembrarMetodosPorDefecto() {
  const batch = writeBatch(db);
  const creados = METODOS_PAGO_DEFAULT.map((metodo) => {
    const id = idDeClave(metodo.clave);
    batch.set(doc(db, COLLECTION, id), metodo);
    return { id, ...metodo };
  });
  await batch.commit();
  return creados;
}

// Evita que dos llamadas simultáneas (StrictMode, recargas rápidas) siembren a la vez
let siembraEnCurso = null;

export async function obtenerMetodosPago({ sembrar = true } = {}) {
  const snapshot = await getDocs(collection(db, COLLECTION));
  let lista = snapshot.docs.map(mapDoc);

  if (lista.length === 0 && sembrar) {
    try {
      if (!siembraEnCurso) siembraEnCurso = sembrarMetodosPorDefecto();
      lista = await siembraEnCurso;
    } catch (_) {
      // Sin permisos de escritura: se trabaja con los métodos por defecto
      lista = METODOS_PAGO_DEFAULT.map((m) => ({ id: idDeClave(m.clave), ...m }));
    } finally {
      siembraEnCurso = null;
    }
  }

  const unicos = deduplicar(lista);
  if (unicos.length < lista.length) {
    await limpiarDuplicados(lista, unicos);
  }

  const ordenada = ordenarMetodos(unicos);
  setMetodosPagoCache(ordenada);
  return ordenada;
}

/** Suscripción en tiempo real; mantiene el caché sincronizado. */
export function observarMetodosPago(callback, onError) {
  return onSnapshot(
    collection(db, COLLECTION),
    (snapshot) => {
      const lista = ordenarMetodos(deduplicar(snapshot.docs.map(mapDoc)));
      if (lista.length > 0) setMetodosPagoCache(lista);
      callback(lista);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function agregarMetodoPago({ nombre, moneda, activo = true, orden }) {
  const clave = normalizarMetodo(nombre);
  const data = {
    clave,
    nombre: (nombre || "").trim(),
    moneda: moneda === MONEDA_BS ? MONEDA_BS : MONEDA_USD,
    activo: !!activo,
    orden: Number.isFinite(Number(orden)) ? Number(orden) : 999,
    predeterminado: false,
  };
  const id = idDeClave(clave);
  await setDoc(doc(db, COLLECTION, id), data);
  return { id, ...data };
}

export async function actualizarMetodoPago(id, cambios) {
  const data = { ...cambios };
  // La clave nunca cambia: es la que enlaza con los movimientos ya guardados.
  delete data.clave;
  delete data.id;
  delete data.predeterminado;
  if (data.nombre !== undefined) data.nombre = (data.nombre || "").trim();
  if (data.moneda !== undefined) data.moneda = data.moneda === MONEDA_BS ? MONEDA_BS : MONEDA_USD;
  await updateDoc(doc(db, COLLECTION, id), data);
  return { id, ...data };
}

export async function eliminarMetodoPago(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
