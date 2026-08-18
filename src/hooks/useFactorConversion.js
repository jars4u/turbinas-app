import { useCallback, useEffect, useRef, useState } from "react";
import {
  obtenerDetalleFactorConversion,
  EVENTO_FACTOR_CONVERSION,
} from "../lib/factorConversionFirebase";

// Cada cuánto se revisa que el factor (y la tasa BCV) sigan vigentes
const INTERVALO_REFRESCO_MS = 5 * 60 * 1000;

/**
 * Devuelve el factor de conversión efectivo según el modo configurado
 * (manual, BCV dólar o BCV euro) y lo mantiene actualizado: al montar,
 * cada 5 minutos, al volver a la pestaña y cuando alguien guarda el ajuste.
 */
export default function useFactorConversion() {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const montado = useRef(true);

  const refrescar = useCallback(async (opciones) => {
    try {
      const nuevo = await obtenerDetalleFactorConversion(opciones);
      if (montado.current) setDetalle(nuevo);
      return nuevo;
    } catch (error) {
      return null;
    } finally {
      if (montado.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    refrescar();

    const refrescarForzado = () => refrescar({ forzar: true });
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescarForzado();
    };

    const intervalo = setInterval(refrescarForzado, INTERVALO_REFRESCO_MS);
    window.addEventListener("focus", refrescarForzado);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(EVENTO_FACTOR_CONVERSION, refrescarForzado);

    return () => {
      montado.current = false;
      clearInterval(intervalo);
      window.removeEventListener("focus", refrescarForzado);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(EVENTO_FACTOR_CONVERSION, refrescarForzado);
    };
  }, [refrescar]);

  return {
    factor: detalle && detalle.factor > 0 ? detalle.factor : 1,
    detalle,
    cargando,
    refrescar,
  };
}
