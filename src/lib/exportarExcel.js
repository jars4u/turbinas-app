// Utilidad para exportar datos a Excel desde un array de objetos
import * as XLSX from 'xlsx';

export function exportarExcel(datos, nombreArchivo = 'historial.xlsx') {
  // Si no hay datos, no exportar
  if (!Array.isArray(datos) || datos.length === 0) return;
  // Formatear campos de fecha como texto legible
  const datosFormateados = datos.map(row => {
    const copia = { ...row };
    // Formatear arrivalTime y fechaEntrega si existen y son fechas
    if (copia.arrivalTime) {
      const d = new Date(copia.arrivalTime);
      if (!isNaN(d.getTime())) {
        copia.arrivalTime = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    if (copia.fechaEntrega) {
      const d = new Date(copia.fechaEntrega);
      if (!isNaN(d.getTime())) {
        copia.fechaEntrega = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
    return copia;
  });
  // Crear hoja de cálculo
  const ws = XLSX.utils.json_to_sheet(datosFormateados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial');
  // Descargar archivo
  XLSX.writeFile(wb, nombreArchivo);
}
