import { getFirestore, collection, addDoc, getDocs, Timestamp, doc, deleteDoc } from "firebase/firestore";

const db = getFirestore();
const INGRESOS_COLLECTION = "ingresosMovimientos";

export async function guardarIngreso(ingreso) {
  const fechaStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  // Filtra todos los campos undefined o null
  let mov = Object.fromEntries(
    Object.entries({ ...ingreso, fecha: fechaStr })
      .filter(([_, v]) => v !== undefined && v !== null)
  );
  // Si ya existe formasPago como array, respétalo y no reproceses los campos sueltos
  if (Array.isArray(mov.formasPago) && mov.formasPago.length > 0) {
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
          ? { montoBs: Number(mov.monto), referencia: mov.referencia }
          : { monto: Number(mov.monto), referencia: mov.referencia })
      }).filter(([_, v]) => v !== undefined && v !== null)),
      Object.fromEntries(Object.entries({
        formaPago: mov.formaPago2,
        ...(mov.formaPago2 === 'pago movil'
          ? { montoBs: Number(mov.monto2), referencia: mov.referencia2 }
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
          ? { montoBs: Number(mov.monto), referencia: mov.referencia }
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
          // Para ordenar, crear un objeto Date
          fechaRaw = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
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
