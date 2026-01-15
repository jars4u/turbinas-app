export async function migrarNumeroFacturaAFactura() {
  const { getFirestore, collection, getDocs, updateDoc, doc, deleteField } = await import("firebase/firestore");
  const db = getFirestore();
  const colRef = collection(db, "ingresosMovimientos");
  const snapshot = await getDocs(colRef);
  let actualizados = 0;
  let omitidos = 0;
  let errores = 0;
  for (const d of snapshot.docs) {
    const data = d.data();
    const numero = data?.numeroFactura;
    const fac = data?.factura;
    if (numero && (!fac || String(fac).trim() === "")) {
      try {
        await updateDoc(doc(db, "ingresosMovimientos", d.id), {
          factura: String(numero).toUpperCase(),
          numeroFactura: deleteField(),
        });
        actualizados += 1;
      } catch (e) {
        errores += 1;
      }
    } else if (numero) {
      try {
        await updateDoc(doc(db, "ingresosMovimientos", d.id), {
          numeroFactura: deleteField(),
        });
      } catch (e) {
        // Si no se puede eliminar, lo contamos como omitido
      }
      omitidos += 1;
    } else {
      omitidos += 1;
    }
  }
  return { actualizados, omitidos, errores };
}
