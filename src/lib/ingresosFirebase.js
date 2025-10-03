import { getFirestore, collection, addDoc, getDocs, Timestamp } from "firebase/firestore";

const db = getFirestore();
const INGRESOS_COLLECTION = "ingresosMovimientos";

export async function guardarIngreso(ingreso) {
  const fechaStr = new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  // Antes de guardar, eliminamos todos los campos con valor undefined para evitar que Firestore reciba datos innecesarios.
  // Esto previene errores y mantiene la base de datos limpia, incluso si el frontend envía campos opcionales.
  const mov = Object.fromEntries(
    Object.entries({ ...ingreso, fecha: fechaStr })
      .filter(([_, v]) => v !== undefined)
  );
  console.log('guardarIngreso llamado con:', mov);
  // Si hay segunda forma de pago, guardar ambas en un array con monto
  if (mov.formaPago2) {
    mov.formasPago = [
      {
        formaPago: mov.formaPago,
        ...(mov.formaPago === 'pago movil'
          ? { montoBs: Number(mov.monto), referencia: mov.referencia }
          : { monto: Number(mov.monto), referencia: mov.referencia })
      },
      {
        formaPago: mov.formaPago2,
        ...(mov.formaPago2 === 'pago movil'
          ? { montoBs: Number(mov.monto2), referencia: mov.referencia2 }
          : { monto: Number(mov.monto2), referencia: mov.referencia2 })
      }
    ];
    delete mov.formaPago;
    delete mov.monto;
    delete mov.referencia;
    delete mov.formaPago2;
    delete mov.monto2;
    delete mov.referencia2;
  } else if (mov.formaPago && mov.monto) {
    // Solo una forma de pago, guardar como array para unificar estructura
    mov.formasPago = [
      {
        formaPago: mov.formaPago,
        ...(mov.formaPago === 'pago movil'
          ? { montoBs: Number(mov.monto), referencia: mov.referencia }
          : { monto: Number(mov.monto), referencia: mov.referencia })
      }
    ];
    delete mov.formaPago;
    delete mov.monto;
    delete mov.referencia;
  }
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
