import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { obtenerTasasBCV, MONEDAS_BCV } from "./tasasBCV";

const db = getFirestore();
const FACTOR_DOC_ID = "factorConversion";
const CONFIG_COLLECTION = "configuracion";

/** Modos disponibles para el factor de conversión. */
export const MODOS_FACTOR = {
  MANUAL: "manual",
  BCV_USD: "bcv_usd",
  BCV_EUR: "bcv_eur",
};

export const ETIQUETAS_MODO_FACTOR = {
  [MODOS_FACTOR.MANUAL]: "Factor manual",
  [MODOS_FACTOR.BCV_USD]: "BCV Dólar",
  [MODOS_FACTOR.BCV_EUR]: "BCV Euro",
};

/** Evento que emiten los guardados para que la app recargue el factor. */
export const EVENTO_FACTOR_CONVERSION = "factorConversionActualizado";

const MODOS_VALIDOS = Object.values(MODOS_FACTOR);

function numeroPositivo(valor) {
  const n = Number(valor);
  return isNaN(n) || n <= 0 ? null : n;
}

function monedaDeModo(modo) {
  if (modo === MODOS_FACTOR.BCV_USD) return MONEDAS_BCV.USD;
  if (modo === MODOS_FACTOR.BCV_EUR) return MONEDAS_BCV.EUR;
  return null;
}

/**
 * Normaliza el documento de configuración. Los documentos antiguos solo tienen
 * `valor`, por lo que se interpretan como modo manual.
 */
function normalizarConfig(data) {
  const modo = MODOS_VALIDOS.includes(data && data.modo)
    ? data.modo
    : MODOS_FACTOR.MANUAL;
  const valor = numeroPositivo(data && data.valor);
  const valorManual = numeroPositivo(data && data.valorManual) || valor || 1;
  return {
    modo,
    valorManual,
    valor: valor || valorManual,
    fecha: (data && data.fecha) || null,
  };
}

/** Configuración cruda del factor (modo + valor manual + último valor usado). */
export async function obtenerConfigFactorConversion() {
  try {
    const docSnap = await getDoc(doc(db, CONFIG_COLLECTION, FACTOR_DOC_ID));
    if (docSnap.exists()) return normalizarConfig(docSnap.data());
  } catch (error) {
    // Sin acceso o sin conexión: se usa la configuración por defecto
  }
  return normalizarConfig(null);
}

/**
 * Resuelve el factor efectivo a partir de una configuración.
 * En modo BCV consulta la tasa vigente; si no hay conexión usa el último valor
 * guardado como respaldo.
 */
export async function resolverFactorConversion(config, opciones) {
  const cfg = config || normalizarConfig(null);
  const moneda = monedaDeModo(cfg.modo);

  if (!moneda) {
    return {
      factor: cfg.valorManual || 1,
      modo: cfg.modo,
      moneda: null,
      tasa: null,
      fuente: "manual",
      valorManual: cfg.valorManual,
      actualizado: null,
    };
  }

  const tasas = await obtenerTasasBCV(opciones);
  const tasa = numeroPositivo(tasas[moneda]);
  return {
    factor: tasa || cfg.valor || cfg.valorManual || 1,
    modo: cfg.modo,
    moneda,
    tasa,
    fuente: tasa ? tasas.fuente : "respaldo",
    valorManual: cfg.valorManual,
    actualizado: tasas.actualizado || null,
  };
}

/** Factor efectivo listo para multiplicar precios en USD y obtener Bs. */
export async function obtenerFactorConversion(opciones) {
  const detalle = await obtenerDetalleFactorConversion(opciones);
  return detalle.factor;
}

/** Igual que `obtenerFactorConversion` pero con el contexto del modo y la tasa. */
export async function obtenerDetalleFactorConversion(opciones) {
  const config = await obtenerConfigFactorConversion();
  return resolverFactorConversion(config, opciones);
}

function avisarCambio(detalle) {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent(EVENTO_FACTOR_CONVERSION, { detail: detalle })
      );
    }
  } catch (error) {
    // El aviso es opcional
  }
}

/**
 * Guarda el modo elegido (y el valor manual cuando aplica).
 * También persiste el factor efectivo en `valor` para que sirva de respaldo.
 */
export async function guardarConfigFactorConversion({ modo, valorManual }) {
  const modoFinal = MODOS_VALIDOS.includes(modo) ? modo : MODOS_FACTOR.MANUAL;
  const actual = await obtenerConfigFactorConversion();
  const manualFinal = numeroPositivo(valorManual) || actual.valorManual || 1;

  const detalle = await resolverFactorConversion(
    { ...actual, modo: modoFinal, valorManual: manualFinal },
    { forzar: true }
  );

  await setDoc(
    doc(db, CONFIG_COLLECTION, FACTOR_DOC_ID),
    {
      modo: modoFinal,
      valorManual: manualFinal,
      valor: detalle.factor,
      fecha: new Date().toISOString(),
    },
    { merge: true }
  );

  avisarCambio(detalle);
  return detalle;
}

/** Compatibilidad: guardar un número fija el modo manual con ese valor. */
export async function guardarFactorConversion(valor) {
  return guardarConfigFactorConversion({
    modo: MODOS_FACTOR.MANUAL,
    valorManual: valor,
  });
}

/**
 * Refresca en Firestore el valor de respaldo cuando el modo es BCV, para que
 * quien no tenga conexión con la API siga viendo una tasa reciente.
 */
export async function sincronizarValorRespaldo(detalle) {
  if (!detalle || !detalle.tasa || detalle.fuente !== "bcv") return false;
  try {
    await setDoc(
      doc(db, CONFIG_COLLECTION, FACTOR_DOC_ID),
      { valor: detalle.factor, fecha: new Date().toISOString() },
      { merge: true }
    );
    return true;
  } catch (error) {
    return false; // Sin permisos de escritura: no es crítico
  }
}
