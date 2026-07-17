// Utilidades de fecha para semana laboral (lunes a viernes)

// Convierte Date local a 'YYYY-MM-DD'
export function toLocalYMD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Dado 'YYYY-MM-DD' retorna { mondayStr, fridayStr, days[] } en horario local
export function getWeekRangeLocal(fechaStr) {
  if (!fechaStr || typeof fechaStr !== "string" || fechaStr.length < 10) {
    return { mondayStr: "", fridayStr: "", days: [] };
  }
  const [y, m, d] = fechaStr.split("-").map(Number);
  const base = new Date(y, m - 1, d, 12, 0, 0); // mediodía local para evitar desfases
  const day = base.getDay(); // 0=Dom,1=Lun,...
  const diffToMonday = (day + 6) % 7; // Dom->6, Lun->0, Mar->1, ...
  const monday = new Date(base);
  monday.setDate(base.getDate() - diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toLocalYMD(d));
  }
  return { mondayStr: toLocalYMD(monday), fridayStr: toLocalYMD(friday), days };
}

// Formatea minutos transcurridos como texto relativo en español
// (ej. "Hace 5 min", "Hace 2h 15m", "Hace 1d 3h")
export function formatTiempoRelativo(minutos) {
  const mins = Math.max(0, minutos);
  if (mins < 60) return `Hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  const minRestantes = mins % 60;
  if (horas < 24) return `Hace ${horas}h${minRestantes > 0 ? ` ${minRestantes}m` : ""}`;
  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;
  return `Hace ${dias}d${horasRestantes > 0 ? ` ${horasRestantes}h` : ""}`;
}

// Color de aging/SLA según minutos transcurridos desde el registro del servicio:
// verde (<2h), ámbar (2-6h), rojo (>6h)
export function obtenerColorAging(minutos) {
  if (minutos < 120) return "#4caf50";
  if (minutos < 360) return "#ff9800";
  return "#f44336";
}

