import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { observarMetodosPago, obtenerMetodosPago } from "../lib/metodosPagoFirebase";
import {
  getMetodosPagoCache,
  metodosActivos as filtrarActivos,
} from "../lib/metodosPago";

const MetodosPagoContext = createContext(null);

export function MetodosPagoProvider({ children }) {
  const { usuario } = useAuth();
  const [metodos, setMetodos] = useState(() => getMetodosPagoCache());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Las reglas de Firestore exigen sesión iniciada para leer la configuración
    if (!usuario) {
      setLoading(false);
      return undefined;
    }
    let activo = true;
    setLoading(true);
    // Lectura inicial: además siembra los métodos históricos si la colección está vacía
    obtenerMetodosPago()
      .then((lista) => {
        if (!activo) return;
        if (lista.length > 0) setMetodos(lista);
      })
      .catch((e) => { if (activo) setError(e); })
      .finally(() => { if (activo) setLoading(false); });

    const unsub = observarMetodosPago(
      (lista) => {
        if (!activo) return;
        if (lista.length > 0) setMetodos(lista);
        setLoading(false);
      },
      (e) => { if (activo) setError(e); }
    );
    return () => { activo = false; unsub && unsub(); };
  }, [usuario]);

  const value = useMemo(
    () => ({
      metodos,
      metodosActivos: filtrarActivos(metodos),
      loading,
      error,
      refrescar: () => obtenerMetodosPago().then((lista) => {
        if (lista.length > 0) setMetodos(lista);
        return lista;
      }),
    }),
    [metodos, loading, error]
  );

  return (
    <MetodosPagoContext.Provider value={value}>{children}</MetodosPagoContext.Provider>
  );
}

export function useMetodosPago() {
  const ctx = useContext(MetodosPagoContext);
  if (!ctx) {
    // Permite usar el hook fuera del provider (caché local como respaldo)
    const metodos = getMetodosPagoCache();
    return { metodos, metodosActivos: filtrarActivos(metodos), loading: false, error: null, refrescar: obtenerMetodosPago };
  }
  return ctx;
}
