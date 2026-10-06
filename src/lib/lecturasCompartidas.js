// Comparte lecturas de Firestore entre componentes que piden lo mismo a la vez
// (p. ej. el resumen contable y los gráficos de Cierre del Día cargan ingresos y
// egresos al mismo tiempo): se hace una sola consulta y ambos reciben el resultado.
//
// Sin `ttlMs` solo se comparte la petición en curso: en cuanto termina, la
// siguiente llamada vuelve a consultar, así que nunca se sirven datos viejos.
// Con `ttlMs` el resultado se reutiliza durante ese tiempo; úsalo solo en
// colecciones cuyas escrituras pasan por su módulo y llaman a `invalidarLectura`.

const entradas = new Map();

// Cada llamador recibe su propia copia (array y objetos de primer nivel), para
// que si uno la modifica no afecte a los demás.
function copiar(resultado) {
  if (!Array.isArray(resultado)) return resultado;
  return resultado.map((item) =>
    item && typeof item === "object" && !Array.isArray(item) ? { ...item } : item
  );
}

export function leerCompartido(clave, consultar, { ttlMs = 0 } = {}) {
  const ahora = Date.now();
  const entrada = entradas.get(clave);
  if (entrada) {
    if (entrada.promesa) return entrada.promesa.then(copiar);
    if (ttlMs > 0 && ahora - entrada.fecha < ttlMs) return Promise.resolve(copiar(entrada.valor));
  }

  const nueva = { promesa: null, valor: undefined, fecha: 0 };
  nueva.promesa = Promise.resolve()
    .then(consultar)
    .then(
      (valor) => {
        if (entradas.get(clave) === nueva) {
          nueva.promesa = null;
          nueva.valor = valor;
          nueva.fecha = Date.now();
          if (!(ttlMs > 0)) entradas.delete(clave);
        }
        return valor;
      },
      (error) => {
        if (entradas.get(clave) === nueva) entradas.delete(clave);
        throw error;
      }
    );
  entradas.set(clave, nueva);
  return nueva.promesa.then(copiar);
}

/** Descarta la lectura en curso o cacheada para que la próxima consulte de nuevo. */
export function invalidarLectura(clave) {
  entradas.delete(clave);
}
