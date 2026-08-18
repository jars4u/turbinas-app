import { obtenerTasaBCV, obtenerTasaEURBCV } from "./tasaBCVFirebase";

const COTIZACIONES_URL = "https://ve.dolarapi.com/v1/cotizaciones";
// Tiempo que se considera "fresca" una tasa antes de volver a consultarla
const TTL_MS = 5 * 60 * 1000;
// Máxima espera por la API para no bloquear el guardado de un ingreso
const TIMEOUT_MS = 6000;

export const MONEDAS_BCV = { USD: "usd", EUR: "eur" };

let cache = { usd: null, eur: null, actualizado: 0, fuente: null };
let solicitudEnCurso = null;

function promedioOficial(lista, moneda) {
  if (!Array.isArray(lista)) return null;
  const item = lista.find(
    (c) => c && c.moneda === moneda && c.fuente === "oficial"
  );
  const valor = Number(item && item.promedio);
  return valor > 0 ? valor : null;
}

async function consultarAPI() {
  const controlador =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const temporizador = setTimeout(() => {
    if (controlador) controlador.abort();
  }, TIMEOUT_MS);
  try {
    const resp = await fetch(
      COTIZACIONES_URL,
      controlador ? { signal: controlador.signal } : undefined
    );
    const json = await resp.json();
    return {
      usd: promedioOficial(json, "USD"),
      eur: promedioOficial(json, "EUR"),
    };
  } finally {
    clearTimeout(temporizador);
  }
}

async function consultarFirestore() {
  const [usdBD, eurBD] = await Promise.all([
    obtenerTasaBCV().catch(() => null),
    obtenerTasaEURBCV().catch(() => null),
  ]);
  return {
    usd: Number(usdBD) > 0 ? Number(usdBD) : null,
    eur: Number(eurBD) > 0 ? Number(eurBD) : null,
  };
}

/**
 * Devuelve las tasas oficiales del BCV (dólar y euro) manteniéndolas al día.
 * Usa una caché en memoria de 5 minutos y, si la API falla, recurre al último
 * valor guardado en Firestore.
 */
export async function obtenerTasasBCV({ forzar = false } = {}) {
  const ahora = Date.now();
  const vigente = cache.usd || cache.eur;
  if (!forzar && vigente && ahora - cache.actualizado < TTL_MS) {
    return { ...cache };
  }
  if (solicitudEnCurso) return solicitudEnCurso;

  solicitudEnCurso = (async () => {
    try {
      const { usd, eur } = await consultarAPI();
      if (usd || eur) {
        cache = {
          usd: usd || cache.usd,
          eur: eur || cache.eur,
          actualizado: Date.now(),
          fuente: "bcv",
        };
        return { ...cache };
      }
      throw new Error("La API no devolvió tasas oficiales");
    } catch (error) {
      const { usd, eur } = await consultarFirestore();
      cache = {
        usd: usd || cache.usd,
        eur: eur || cache.eur,
        actualizado: Date.now(),
        fuente: usd || eur ? "firestore" : cache.fuente,
      };
      return { ...cache };
    } finally {
      solicitudEnCurso = null;
    }
  })();

  return solicitudEnCurso;
}

/** Tasa de una sola moneda ("usd" | "eur"). */
export async function obtenerTasaBCVPorMoneda(moneda, opciones) {
  const tasas = await obtenerTasasBCV(opciones);
  const valor = Number(tasas[moneda]);
  return valor > 0 ? valor : null;
}

/** Último valor conocido sin disparar consultas (para pintar de inmediato). */
export function tasasBCVEnCache() {
  return { ...cache };
}
