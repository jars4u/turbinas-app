import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useCuentasPorCobrarServicios() {
  const [cuentasPorCobrarServicios, setCuentasPorCobrarServicios] = useState([]);
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "cuentasPorCobrar"),
      (snapshot) => {
        const servicios = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((c) => c.modalidad === "servicio");
        setCuentasPorCobrarServicios(servicios);
      }
    );
    return () => unsubscribe();
  }, []);
  return cuentasPorCobrarServicios;
}
