import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc } from "firebase/firestore";
import { obtenerFactorConversion } from "./factorConversionFirebase";
import { esMetodoBs } from "./metodosPago";
import { leerCompartido, invalidarLectura } from "./lecturasCompartidas";
import { leerFecha, formatearFechaDMY } from "./finanzas";

const db = getFirestore();
const INGRESOS_COLLECTION = "ingresosMovimientos";

// `opciones.factor`: factor ya resuelto por quien llama (p. ej. useFactorConversion).
// Evita consultar la configuración y la API del BCV en medio del guardado.
export async function guardarIngreso(ingreso, opciones = {}) {
  const factorDado = Number(opciones.factor);
  const factor = factorDado > 0 ? factorDado : await obtenerFactorConversion();
  const fechaStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  // Filtra todos los campos undefined o null
  let mov = Object.fromEntries(
    Object.entries({ ...ingreso, fecha: fechaStr })
      .filter(([_, v]) => v !== undefined && v !== null)
  );
  // Si ya existe formasPago como array, respétalo y no reproceses los campos sueltos
  if (Array.isArray(mov.formasPago) && mov.formasPago.length > 0) {
    // Asegurar factor/usdEquiv para las formas de pago en Bs y normalizar montoBs
    mov.formasPago = mov.formasPago.map(fp => {
      if (esMetodoBs(fp.formaPago)) {
        const montoBs = fp.montoBs !== undefined && fp.montoBs !== null && !isNaN(Number(fp.montoBs))
          ? Number(fp.montoBs)
          : (fp.monto !== undefined && fp.monto !== null && !isNaN(Number(fp.monto)) ? Number(fp.monto) : undefined);
        if (montoBs !== undefined) {
          return {
            ...fp,
            montoBs,
            factorConversion: Number(factor),
            usdEquiv: Number(factor) ? (montoBs / Number(factor)) : undefined,
          };
        }
      }
      return fp;
    });
    // Elimina los campos sueltos para evitar duplicidad
    delete mov.formaPago;
    delete mov.monto;
    delete mov.referencia;
    delete mov.formaPago2;
    delete mov.monto2;
    delete mov.referencia2;
  } else if (mov.formaPago2) {
    mov.formasPago = [
      Object.fromEntries(Object.entries({
        formaPago: mov.formaPago,
        ...(esMetodoBs(mov.formaPago)
          ? { montoBs: Number(mov.monto), referencia: mov.referencia, factorConversion: Number(factor), usdEquiv: Number(factor) ? (Number(mov.monto) / Number(factor)) : undefined }
          : { monto: Number(mov.monto), referencia: mov.referencia })
      }).filter(([_, v]) => v !== undefined && v !== null)),
      Object.fromEntries(Object.entries({
        formaPago: mov.formaPago2,
        ...(esMetodoBs(mov.formaPago2)
          ? { montoBs: Number(mov.monto2), referencia: mov.referencia2, factorConversion: Number(factor), usdEquiv: Number(factor) ? (Number(mov.monto2) / Number(factor)) : undefined }
          : { monto: Number(mov.monto2), referencia: mov.referencia2 })
      }).filter(([_, v]) => v !== undefined && v !== null))
    ];
    delete mov.formaPago;
    delete mov.monto;
    delete mov.referencia;
    delete mov.formaPago2;
    delete mov.monto2;
    delete mov.referencia2;
  } else if (mov.formaPago && mov.monto) {
    mov.formasPago = [
      Object.fromEntries(Object.entries({
        formaPago: mov.formaPago,
        ...(esMetodoBs(mov.formaPago)
          ? { montoBs: Number(mov.monto), referencia: mov.referencia, factorConversion: Number(factor), usdEquiv: Number(factor) ? (Number(mov.monto) / Number(factor)) : undefined }
          : { monto: Number(mov.monto), referencia: mov.referencia })
      }).filter(([_, v]) => v !== undefined && v !== null))
    ];
    delete mov.formaPago;
    delete mov.monto;
    delete mov.referencia;
  }
  // Filtra nuevamente el objeto final antes de guardar
  mov = Object.fromEntries(Object.entries(mov).filter(([_, v]) => v !== undefined && v !== null));
  await addDoc(collection(db, INGRESOS_COLLECTION), mov);
  invalidarLectura(INGRESOS_COLLECTION);
}

// Peticiones simultáneas (p. ej. resumen + gráficos) comparten una sola consulta
export function obtenerIngresos() {
  return leerCompartido(INGRESOS_COLLECTION, consultarIngresos);
}

async function consultarIngresos() {
  const snapshot = await getDocs(collection(db, INGRESOS_COLLECTION));
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      // Regla única de fechas: dd/mm/aaaa, aaaa-mm-dd y Timestamp, a mediodía local.
      // Si la fecha no es interpretable, fechaRaw queda en null (no se imputa a ningún
      // período) y se conserva el texto original para mostrarlo.
      const { fecha: fechaRaw } = leerFecha(data.fecha);
      const fechaStr = fechaRaw
        ? formatearFechaDMY(fechaRaw)
        : (typeof data.fecha === 'string' ? data.fecha : '');
      // Compatibilidad: exponer montos de formas de pago si existen
      let formasPago = data.formasPago || [];
      // Si no existe formasPago pero sí formaPago y monto, adaptarlo
      if ((!formasPago || formasPago.length === 0) && data.formaPago && data.monto) {
        formasPago = [{ formaPago: data.formaPago, monto: Number(data.monto), referencia: data.referencia }];
      }
      return {
        ...data,
        formasPago,
        fecha: fechaStr,
        fechaRaw,
        id: doc.id
      };
    })
  // Mostrar siempre el ingreso más reciente primero
  .sort((a, b) => (b.fechaRaw?.getTime() || 0) - (a.fechaRaw?.getTime() || 0));
}

export async function eliminarIngreso(id) {
  if (!id) throw new Error("ID de ingreso requerido");
  const db = getFirestore();
  await deleteDoc(doc(db, INGRESOS_COLLECTION, id));
  invalidarLectura(INGRESOS_COLLECTION);
}
