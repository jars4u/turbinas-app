import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc } from "firebase/firestore";
import { obtenerFactorConversion } from "./factorConversionFirebase";

const db = getFirestore();
const INGRESOS_COLLECTION = "ingresosMovimientos";

export async function guardarIngreso(ingreso) {
  const factor = await obtenerFactorConversion();
  const fechaStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  // Filtra todos los campos undefined o null
  let mov = Object.fromEntries(
    Object.entries({ ...ingreso, fecha: fechaStr })
      .filter(([_, v]) => v !== undefined && v !== null)
  );
  // Si ya existe formasPago como array, respétalo y no reproceses los campos sueltos
  if (Array.isArray(mov.formasPago) && mov.formasPago.length > 0) {
    // Asegurar factor/usdEquiv para pago movil y normalizar montoBs
    mov.formasPago = mov.formasPago.map(fp => {
      const formaNorm = (fp.formaPago || '').toString().trim().toLowerCase();
      if (formaNorm === 'pago movil') {
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
        ...(mov.formaPago === 'pago movil'
          ? { montoBs: Number(mov.monto), referencia: mov.referencia, factorConversion: Number(factor), usdEquiv: Number(factor) ? (Number(mov.monto) / Number(factor)) : undefined }
          : { monto: Number(mov.monto), referencia: mov.referencia })
      }).filter(([_, v]) => v !== undefined && v !== null)),
      Object.fromEntries(Object.entries({
        formaPago: mov.formaPago2,
        ...(mov.formaPago2 === 'pago movil'
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
        ...(mov.formaPago === 'pago movil'
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
}

export async function obtenerIngresos() {
  const snapshot = await getDocs(collection(db, INGRESOS_COLLECTION));
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      let fechaStr = '';
      let fechaRaw = null;
      if (data.fecha && typeof data.fecha === 'string') {
        // Si es string, normalizar a dd/mm/yyyy
        const parts = data.fecha.split(/[/-]/);
        if (parts.length === 3) {
          fechaStr = `${String(parts[0]).padStart(2, '0')}/${String(parts[1]).padStart(2, '0')}/${parts[2]}`;
          // Para ordenar/filtrar, crear Date en horario local.
          // IMPORTANTE: evitar `new Date('YYYY-MM-DD')` porque se interpreta como UTC
          // y en GMT-4 se corre al día anterior.
          const y = Number(parts[2]);
          const m = Number(parts[1]);
          const d = Number(parts[0]);
          fechaRaw = Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)
            ? new Date(y, m - 1, d, 12, 0, 0)
            : null;
        } else {
          fechaStr = data.fecha;
          fechaRaw = Date.parse(data.fecha) ? new Date(data.fecha) : null;
        }
      } else if (data.fecha && data.fecha.toDate) {
        // Si es Timestamp
        fechaRaw = data.fecha.toDate();
        fechaStr = fechaRaw.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
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
  .sort((a, b) => (a.fechaRaw?.getTime() || 0) - (b.fechaRaw?.getTime() || 0));
}

export async function eliminarIngreso(id) {
  if (!id) throw new Error("ID de ingreso requerido");
  const db = getFirestore();
  await deleteDoc(doc(db, INGRESOS_COLLECTION, id));
}
