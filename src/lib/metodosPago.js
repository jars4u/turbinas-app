// Utilidades puras para trabajar con las formas (métodos) de pago configurables.
// El resto de la app decide la divisa de un pago a partir de estas funciones,
// de modo que agregar un método nuevo en Configuración no rompe el cierre.

export const MONEDA_USD = "USD";
export const MONEDA_BS = "BS";

export const MONEDAS = [
  { value: MONEDA_USD, label: "Dólares ($)", simbolo: "$" },
  { value: MONEDA_BS, label: "Bolívares (Bs)", simbolo: "Bs" },
];

export function simboloMoneda(moneda) {
  return moneda === MONEDA_BS ? "Bs" : "$";
}

// Métodos que existían antes de que la configuración fuera editable.
// Se usan como semilla en Firestore y como respaldo si la config no cargó.
export const METODOS_PAGO_DEFAULT = [
  { clave: "efectivo", nombre: "Efectivo", moneda: MONEDA_USD, activo: true, orden: 1, predeterminado: true },
  { clave: "binance", nombre: "Binance", moneda: MONEDA_USD, activo: true, orden: 2, predeterminado: true },
  { clave: "pago movil", nombre: "Pago móvil", moneda: MONEDA_BS, activo: true, orden: 3, predeterminado: true },
  { clave: "zelle", nombre: "Zelle", moneda: MONEDA_USD, activo: true, orden: 4, predeterminado: true },
  { clave: "transferencia", nombre: "Transferencia", moneda: MONEDA_USD, activo: false, orden: 5, predeterminado: true },
  { clave: "credito", nombre: "Crédito", moneda: MONEDA_USD, activo: false, orden: 6, predeterminado: true },
];

// Claves que históricamente se guardaron en Bs aunque no estén configuradas.
const CLAVES_BS_LEGADO = ["pago movil"];

const CACHE_STORAGE_KEY = "metodosPagoCache";

/**
 * Normaliza el nombre de una forma de pago: minúsculas, sin acentos y sin
 * espacios repetidos. Los movimientos guardados usan mayúsculas ("PAGO MOVIL")
 * o acentos ("Pago móvil"), por eso todas las comparaciones pasan por aquí.
 */
export function normalizarMetodo(nombre) {
  return (nombre || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function hidratarDesdeStorage() {
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (_) {
    return null;
  }
}

let metodosCache = hidratarDesdeStorage() || METODOS_PAGO_DEFAULT;

export function setMetodosPagoCache(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return;
  metodosCache = lista;
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(lista));
  } catch (_) { /* noop */ }
}

export function getMetodosPagoCache() {
  return metodosCache;
}

export function ordenarMetodos(lista) {
  return [...(lista || [])].sort((a, b) => {
    const oa = Number.isFinite(Number(a?.orden)) ? Number(a.orden) : 999;
    const ob = Number.isFinite(Number(b?.orden)) ? Number(b.orden) : 999;
    if (oa !== ob) return oa - ob;
    return (a?.nombre || "").localeCompare(b?.nombre || "");
  });
}

export function buscarMetodo(nombre, metodos) {
  const clave = normalizarMetodo(nombre);
  if (!clave) return null;
  const lista = Array.isArray(metodos) && metodos.length > 0 ? metodos : metodosCache;
  return lista.find((m) => normalizarMetodo(m?.clave || m?.nombre) === clave) || null;
}

/** Devuelve 'USD' o 'BS' para una forma de pago (por nombre o clave). */
export function getMonedaMetodo(nombre, metodos) {
  const metodo = buscarMetodo(nombre, metodos);
  if (metodo?.moneda) return metodo.moneda === MONEDA_BS ? MONEDA_BS : MONEDA_USD;
  // Respaldo para movimientos antiguos o métodos eliminados de la configuración
  return CLAVES_BS_LEGADO.includes(normalizarMetodo(nombre)) ? MONEDA_BS : MONEDA_USD;
}

export function esMetodoBs(nombre, metodos) {
  return getMonedaMetodo(nombre, metodos) === MONEDA_BS;
}

export function esMetodoUSD(nombre, metodos) {
  return getMonedaMetodo(nombre, metodos) === MONEDA_USD;
}

/** Nombre "bonito" para mostrar: usa el configurado o capitaliza la clave guardada. */
export function nombreMetodo(nombre, metodos) {
  const metodo = buscarMetodo(nombre, metodos);
  if (metodo?.nombre) return metodo.nombre;
  return normalizarMetodo(nombre)
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Etiqueta con divisa, p. ej. "Pago móvil (Bs)". */
export function etiquetaMetodo(nombre, metodos) {
  const moneda = getMonedaMetodo(nombre, metodos);
  return `${nombreMetodo(nombre, metodos)} (${simboloMoneda(moneda)})`;
}

/** Métodos activos, ordenados, listos para poblar un <Select>. */
export function metodosActivos(metodos) {
  const lista = Array.isArray(metodos) && metodos.length > 0 ? metodos : metodosCache;
  return ordenarMetodos(lista.filter((m) => m?.activo !== false));
}

/**
 * Clave del método en Bs que se usa cuando se captura un monto en bolívares
 * sin haber elegido explícitamente una forma de pago en esa moneda.
 */
export function metodoBsPorDefecto(metodos) {
  const activo = metodosActivos(metodos).find((m) => m.moneda === MONEDA_BS);
  return normalizarMetodo(activo?.clave || activo?.nombre) || "pago movil";
}

/**
 * Monto en Bs de una forma de pago guardada. Los registros históricos a veces
 * guardan el valor en `monto` en lugar de `montoBs`.
 */
export function montoBsDeFormaPago(fp) {
  const bs = Number(fp?.montoBs);
  if (fp?.montoBs !== undefined && fp?.montoBs !== null && !isNaN(bs)) return bs;
  const monto = Number(fp?.monto);
  if (fp?.monto !== undefined && fp?.monto !== null && !isNaN(monto)) return monto;
  return 0;
}

/** Monto en USD de una forma de pago en divisa. */
export function montoUSDDeFormaPago(fp) {
  const monto = Number(fp?.monto);
  if (fp?.monto !== undefined && fp?.monto !== null && !isNaN(monto)) return monto;
  const montoUSD = Number(fp?.montoUSD);
  if (fp?.montoUSD !== undefined && fp?.montoUSD !== null && !isNaN(montoUSD)) return montoUSD;
  return 0;
}

/** Equivalente en USD de un pago en Bs (usa usdEquiv guardado o el factor). */
export function usdEquivDeFormaPago(fp, factorConversion) {
  const guardado = Number(fp?.usdEquiv);
  if (fp?.usdEquiv !== undefined && fp?.usdEquiv !== null && !isNaN(guardado)) return guardado;
  const factor = Number(fp?.factorConversion) || Number(factorConversion);
  const montoBs = montoBsDeFormaPago(fp);
  return factor ? montoBs / factor : 0;
}
