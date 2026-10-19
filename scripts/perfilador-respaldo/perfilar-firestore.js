// Perfilador EN VIVO de Firestore (alternativa B): calcula las mismas estadísticas
// agregadas que perfilador.js leyendo directamente las colecciones permitidas, sin
// escribir nada en disco. La única salida es stdout.
//
// Uso:
//   1) Preflight (solo count(); no lee documentos):
//      node scripts/perfilador-respaldo/perfilar-firestore.js --clave=<ruta-absoluta-clave.json> --proyecto=turbinas-app
//   2) Lectura (solo tras revisar el preflight):
//      ... --leer --max-lecturas=<N> [--margen-porcentaje=20] [--margen-minimo=100] [--json]
//
// ANTES DE EJECUTAR, verificar a mano en la consola de Google Cloud / Firebase:
//   - Plan del proyecto (Spark/Blaze) y lecturas ya consumidas hoy. El nivel
//     gratuito es de 50.000 lecturas/día y se reinicia hacia medianoche (Pacífico);
//     agotarlo deja a la app sin lecturas hasta el reinicio.
//   - Usar una cuenta de servicio DEDICADA con rol roles/datastore.viewer, o un rol
//     personalizado con solo datastore.entities.get y datastore.entities.list
//     (lo que exigen get/batchGet, runQuery y runAggregationQuery según
//     https://cloud.google.com/firestore/docs/security/iam). NO usar la clave
//     firebase-adminsdk, que puede escribir. El IAM no restringe por colección: la
//     lista permitida la impone solo este script.
//   - Que las colecciones analizadas no tengan subcolecciones con datos financieros
//     (este script no las consulta) y que exista configuracion/factorConversion.
//   - Guardar la clave fuera del repositorio y de carpetas sincronizadas; borrarla
//     o revocarla al terminar.
//
// Garantías y límites:
//   - Lee solo las colecciones de la lista permitida, con proyección de campos
//     (select / fieldMask). Nunca lista colecciones ni subcolecciones.
//   - Procesa documento a documento (stream) con acumuladores incrementales; no
//     guarda arrays de documentos. Ver crearAcumulador() en perfilador.js.
//   - Nunca escribe en disco: ni respaldos, ni cachés, ni resultados.
//   - El límite de lecturas es PREVENTIVO: aborta antes de leer si la estimación
//     más el margen supera --max-lecturas, y corta la lectura si el conteo local
//     lo supera. No garantiza lo que Firestore facture (count() es una estimación
//     en un instante, los datos pueden cambiar y el stream puede traer lotes por
//     adelantado). La proyección reduce bytes transferidos; la documentación de
//     precios no dice que reduzca lecturas, así que la estimación no la descuenta.
//   - Si falta una colección requerida, una consulta falla o la lectura se corta,
//     el informe se marca INCOMPLETO, no se imprimen estadísticas y el código de
//     salida es 3.
"use strict";

const fs = require("fs");
const path = require("path");
const {
  COLECCIONES_ANALIZADAS,
  COLECCIONES_REQUERIDAS,
  CAMPOS_POR_COLECCION,
  crearAcumulador,
  contextoVacio,
  agregarMetodoPago,
  agregarEstadoServicio,
  clasificarModoFactor,
  clasificarFecha,
  evaluarEstado,
  formatearInforme,
} = require("./perfilador");

const RAIZ_REPO = path.resolve(__dirname, "..", "..");
const DIR_RESPALDO = path.join(__dirname, "..", "respaldo-firestore");

// Margen de seguridad sobre la estimación: max(porcentaje, mínimo absoluto)
const MARGEN_PORCENTAJE_DEFECTO = 20;
const MARGEN_MINIMO_DEFECTO = 100;

// Orden de lectura: catálogos primero (el contexto debe estar completo antes de
// crear los acumuladores), luego las colecciones analizadas.
const CATALOGOS = ["metodosPago", "estadosServicio"];
const PLAN = [...CATALOGOS, ...COLECCIONES_ANALIZADAS];
const CONFIG_DOC = { coleccion: "configuracion", id: "factorConversion", campos: ["modo"] };

const SEGMENTOS_SINCRONIZADOS = ["dropbox", "google drive", "googledrive", "icloud drive", "iclouddrive"];
const CODIGOS_GRPC = {
  1: "CANCELLED", 2: "UNKNOWN", 3: "INVALID_ARGUMENT", 4: "DEADLINE_EXCEEDED", 5: "NOT_FOUND",
  7: "PERMISSION_DENIED", 8: "RESOURCE_EXHAUSTED", 9: "FAILED_PRECONDITION", 10: "ABORTED",
  13: "INTERNAL", 14: "UNAVAILABLE", 16: "UNAUTHENTICATED",
};

class ErrorUso extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
  }
}

class ErrorLimite extends Error {}

// ---------------------------------------------------------------------------
// Argumentos y validaciones previas (no tocan Firebase)
// ---------------------------------------------------------------------------

function enteroNoNegativo(valor, nombre, maximo) {
  if (!/^\d+$/.test(valor || "")) throw new ErrorUso("argumento_invalido", `${nombre} debe ser un entero no negativo.`);
  const n = Number(valor);
  if (maximo !== undefined && n > maximo) throw new ErrorUso("argumento_invalido", `${nombre} no puede superar ${maximo}.`);
  return n;
}

function parsearArgumentos(args) {
  const opciones = {
    clave: null,
    proyecto: null,
    leer: false,
    maxLecturas: null,
    margenPorcentaje: MARGEN_PORCENTAJE_DEFECTO,
    margenMinimo: MARGEN_MINIMO_DEFECTO,
    json: false,
  };
  for (const arg of args) {
    const [nombre, ...resto] = arg.split("=");
    const valor = resto.join("=");
    switch (nombre) {
      case "--clave": opciones.clave = valor; break;
      case "--proyecto": opciones.proyecto = valor; break;
      case "--leer": opciones.leer = true; break;
      case "--json": opciones.json = true; break;
      case "--max-lecturas": opciones.maxLecturas = enteroNoNegativo(valor, "--max-lecturas"); break;
      case "--margen-porcentaje": opciones.margenPorcentaje = enteroNoNegativo(valor, "--margen-porcentaje", 1000); break;
      case "--margen-minimo": opciones.margenMinimo = enteroNoNegativo(valor, "--margen-minimo"); break;
      default: throw new ErrorUso("argumento_desconocido", "Argumento no reconocido (los argumentos no se repiten por seguridad).");
    }
  }
  if (!opciones.clave) throw new ErrorUso("falta_clave", "Falta --clave=<ruta-absoluta>.");
  if (!opciones.proyecto || !/^[a-z0-9-]{4,40}$/.test(opciones.proyecto)) {
    throw new ErrorUso("falta_proyecto", "Falta --proyecto=<id-del-proyecto> o tiene un formato inválido.");
  }
  if (opciones.leer && opciones.maxLecturas === null) {
    throw new ErrorUso("falta_max_lecturas", "--leer exige --max-lecturas=<N>.");
  }
  return opciones;
}

function comparable(p, plataforma) {
  const r = path.resolve(p);
  return plataforma === "win32" ? r.toLowerCase() : r;
}

function estaDentro(hijo, padre, plataforma) {
  const rel = path.relative(comparable(padre, plataforma), comparable(hijo, plataforma));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function enCarpetaSincronizada(ruta, entorno, plataforma) {
  const raices = Object.entries(entorno || {})
    .filter(([k, v]) => /^onedrive/i.test(k) && typeof v === "string" && v)
    .map(([, v]) => v);
  if (raices.some((r) => estaDentro(ruta, r, plataforma))) return true;
  const segmentos = comparable(ruta, plataforma).split(/[\\/]+/).map((s) => s.toLowerCase());
  return segmentos.some((s) => s.startsWith("onedrive") || SEGMENTOS_SINCRONIZADOS.includes(s));
}

/** La clave debe ser un archivo, con ruta absoluta, fuera del repo y de carpetas sincronizadas. */
function validarRutaClave(ruta, { raizRepo = RAIZ_REPO, entorno = process.env, plataforma = process.platform } = {}) {
  if (!path.isAbsolute(ruta)) throw new ErrorUso("clave_ruta_relativa", "La ruta de la clave debe ser absoluta.");
  let real;
  try {
    real = fs.realpathSync(ruta);
    if (!fs.statSync(real).isFile()) throw new Error("no es archivo");
  } catch (_) {
    throw new ErrorUso("clave_no_accesible", "La clave no existe, no es accesible o no es un archivo.");
  }
  for (const r of [ruta, real]) {
    if (estaDentro(r, raizRepo, plataforma)) throw new ErrorUso("clave_dentro_del_repositorio", "La clave no puede estar dentro del repositorio.");
    if (enCarpetaSincronizada(r, entorno, plataforma)) throw new ErrorUso("clave_en_carpeta_sincronizada", "La clave no puede estar en una carpeta sincronizada (OneDrive, Dropbox, etc.).");
  }
  return real;
}

/** Carga la clave y comprueba que pertenece al proyecto esperado. Nunca la imprime. */
function cargarClave(ruta, proyecto) {
  let clave;
  try {
    clave = JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch (_) {
    throw new ErrorUso("clave_invalida", "La clave no es un JSON legible.");
  }
  if (!clave || clave.type !== "service_account" || typeof clave.client_email !== "string" || typeof clave.private_key !== "string") {
    throw new ErrorUso("clave_invalida", "La clave no es de una cuenta de servicio.");
  }
  if (clave.project_id !== proyecto) {
    throw new ErrorUso("proyecto_no_coincide", "El project_id de la clave no coincide con --proyecto.");
  }
  return clave;
}

// ---------------------------------------------------------------------------
// Firestore (real solo en ejecución manual; las pruebas inyectan un simulado)
// ---------------------------------------------------------------------------

function crearFirestoreReal(clave) {
  const resolver = (m) => require(require.resolve(m, { paths: [DIR_RESPALDO] }));
  const { initializeApp, cert } = resolver("firebase-admin/app");
  const { getFirestore } = resolver("firebase-admin/firestore");
  const app = initializeApp({ credential: cert(clave), projectId: clave.project_id }, `perfilador-${process.pid}-${Date.now()}`);
  const db = getFirestore(app);
  return {
    db,
    cerrar: async () => {
      await db.terminate();
      await app.delete();
    },
  };
}

function codigoError(e) {
  if (e instanceof ErrorLimite) return "limite_lecturas_alcanzado";
  const c = e && e.code;
  if (typeof c === "number") return CODIGOS_GRPC[c] || `GRPC_${c}`;
  if (typeof c === "string" && /^[A-Za-z0-9/_-]{1,40}$/.test(c)) return c;
  return "DESCONOCIDO";
}

function calcularMargen(estimadas, porcentaje, minimo) {
  return Math.max(Math.ceil((estimadas * porcentaje) / 100), minimo);
}

// ---------------------------------------------------------------------------
// Fase 1: preflight con count()
// ---------------------------------------------------------------------------

async function preflight(db, opciones) {
  const filas = [];
  let costoPreflight = 0;
  for (const nombre of PLAN) {
    let contados;
    try {
      const snap = await db.collection(nombre).count().get();
      contados = snap.data().count;
    } catch (e) {
      return { error: { coleccion: nombre, codigo: codigoError(e) }, filas };
    }
    if (!Number.isInteger(contados) || contados < 0) {
      return { error: { coleccion: nombre, codigo: "respuesta_count_invalida" }, filas };
    }
    // count() se factura por entradas de índice: 1 lectura por cada 1.000, mínimo 1
    costoPreflight += Math.max(1, Math.ceil(contados / 1000));
    // Toda consulta cobra al menos 1 lectura aunque no devuelva documentos
    filas.push({ nombre, requerida: COLECCIONES_REQUERIDAS.includes(nombre), contados, lecturasEstimadas: Math.max(contados, 1) });
  }
  filas.push({ nombre: `${CONFIG_DOC.coleccion}/${CONFIG_DOC.id}`, requerida: false, contados: null, lecturasEstimadas: 1 });

  const estimadas = filas.reduce((a, f) => a + f.lecturasEstimadas, 0);
  const margen = calcularMargen(estimadas, opciones.margenPorcentaje, opciones.margenMinimo);
  const requeridasSinDocumentos = filas.filter((f) => f.requerida && f.contados === 0).map((f) => f.nombre);
  return {
    filas,
    costoPreflight,
    estimadas,
    margen,
    totalConMargen: estimadas + margen,
    limite: opciones.maxLecturas,
    margenPorcentaje: opciones.margenPorcentaje,
    margenMinimo: opciones.margenMinimo,
    requeridasSinDocumentos,
  };
}

function formatearPreflight(pf, proyecto) {
  const L = [];
  L.push("PREFLIGHT (solo count(); no se leyó ningún documento)");
  L.push(`Proyecto verificado (project_id de la clave = --proyecto): ${proyecto}`);
  if (pf.error) {
    L.push(`ERROR en count() de ${pf.error.coleccion}: ${pf.error.codigo}. No se continúa.`);
    return L.join("\n");
  }
  L.push("  colección | documentos según count() | lecturas estimadas");
  for (const f of pf.filas) {
    L.push(`  ${f.nombre}${f.requerida ? " (requerida)" : " (opcional)"} | ${f.contados === null ? "no aplica (lectura por ID)" : f.contados} | ${f.lecturasEstimadas}`);
  }
  L.push(`Lecturas estimadas para la fase de lectura: ${pf.estimadas}`);
  L.push(`Margen de seguridad: max(${pf.margenPorcentaje}% de la estimación, mínimo ${pf.margenMinimo}) = ${pf.margen}`);
  L.push(`Total estimado con margen: ${pf.totalConMargen}`);
  L.push(`Límite autorizado (--max-lecturas): ${pf.limite === null ? "no indicado" : pf.limite}`);
  L.push(`Coste estimado de este preflight: ${pf.costoPreflight} lecturas (count(): 1 por cada 1.000 entradas de índice, mínimo 1 por consulta)`);
  if (pf.requeridasSinDocumentos.length) {
    L.push(`ATENCIÓN: colecciones requeridas sin documentos o inexistentes: ${pf.requeridasSinDocumentos.join(", ")}. Firestore no distingue ambos casos; no se leerá.`);
  }
  L.push("Advertencias: es una estimación, no una garantía de facturación. Los datos pueden cambiar entre el preflight y la lectura;");
  L.push("  la proyección de campos reduce bytes transferidos pero no hay evidencia de que reduzca lecturas facturables.");
  return L.join("\n");
}

// ---------------------------------------------------------------------------
// Fase 2: lectura incremental
// ---------------------------------------------------------------------------

function cargarAJSON() {
  // tipos.js convierte Timestamp/GeoPoint/referencias al mismo formato que el respaldo
  return require(path.join(DIR_RESPALDO, "tipos.js")).aJSON;
}

/** Recorre una consulta proyectada documento a documento, sin acumularlos. */
async function recorrer(db, nombre, procesar, control, aJSON) {
  if (control.contadas + 1 > control.tope) throw new ErrorLimite();
  const stream = db.collection(nombre).select(...CAMPOS_POR_COLECCION[nombre]).stream();
  let leidos = 0;
  try {
    for await (const snap of stream) {
      if (control.contadas + 1 > control.tope) throw new ErrorLimite();
      control.contadas += 1;
      leidos += 1;
      procesar(aJSON(snap.data()));
    }
  } finally {
    if (stream && typeof stream.destroy === "function") stream.destroy();
  }
  // Una consulta sin resultados cobra 1 lectura
  if (leidos === 0) control.contadas += 1;
  return leidos;
}

async function lectura(db, pf, opciones, ahora) {
  const aJSON = cargarAJSON();
  const control = { contadas: 0, tope: pf.totalConMargen };
  const contados = Object.fromEntries(pf.filas.map((f) => [f.nombre, f.contados]));
  const cobertura = {};
  for (const nombre of [...PLAN, CONFIG_DOC.coleccion]) {
    cobertura[nombre] = { origen: "firestore", estado: "no_leida", contados: contados[nombre] ?? null };
  }
  const ctx = contextoVacio(ahora.getUTCFullYear());
  const resultados = {};
  let configuracion = { estado: "no_leida" };
  let detenido = false;

  async function paso(nombre, fn) {
    if (detenido) return;
    try {
      const leidos = await fn();
      cobertura[nombre] = { ...cobertura[nombre], estado: "analizada", leidos };
    } catch (e) {
      detenido = true;
      cobertura[nombre] = { ...cobertura[nombre], estado: "error", error: e instanceof ErrorLimite ? "limite_lecturas_alcanzado" : "consulta_o_procesamiento_fallido", codigo: codigoError(e) };
    }
  }

  await paso("metodosPago", async () => {
    const n = await recorrer(db, "metodosPago", (d) => agregarMetodoPago(ctx, d), control, aJSON);
    ctx.configMetodosDisponible = n > 0;
    return n;
  });
  await paso("estadosServicio", async () => {
    const n = await recorrer(db, "estadosServicio", (d) => agregarEstadoServicio(ctx, d), control, aJSON);
    ctx.configEstadosDisponible = n > 0;
    return n;
  });
  await paso(CONFIG_DOC.coleccion, async () => {
    if (control.contadas + 1 > control.tope) throw new ErrorLimite();
    const ref = db.collection(CONFIG_DOC.coleccion).doc(CONFIG_DOC.id);
    const [snap] = await db.getAll(ref, { fieldMask: CONFIG_DOC.campos });
    control.contadas += 1;
    configuracion = {
      estado: "analizada",
      fondoCajaChica: "no_solicitado",
      modoFactorConversion: snap && snap.exists ? clasificarModoFactor(aJSON(snap.data())) : "documento_no_disponible",
    };
    return snap && snap.exists ? 1 : 0;
  });
  for (const nombre of COLECCIONES_ANALIZADAS) {
    await paso(nombre, async () => {
      const acumulador = crearAcumulador(nombre, ctx);
      const n = await recorrer(db, nombre, (d) => acumulador.procesar(d), control, aJSON);
      resultados[nombre] = acumulador.finalizar();
      return n;
    });
  }

  // Una colección requerida sin documentos no se distingue de una inexistente
  for (const nombre of COLECCIONES_REQUERIDAS) {
    if (cobertura[nombre].estado === "analizada" && cobertura[nombre].leidos === 0) cobertura[nombre].estado = "sin_documentos";
  }
  const { estado, motivos } = evaluarEstado(cobertura);
  return {
    origen: "firestore",
    proyecto: opciones.proyecto,
    fechaLectura: clasificarFecha(ahora.toISOString()).dia,
    estado,
    motivos,
    cobertura,
    otrasColecciones: { nombres: [], noMostradas: 0 },
    contexto: {
      configMetodosPagoDisponible: ctx.configMetodosDisponible,
      metodosConMonedaConfigurada: ctx.monedaPorMetodo.size,
      configEstadosServicioDisponible: ctx.configEstadosDisponible,
    },
    configuracion,
    // Con el informe incompleto no se exponen estadísticas parciales
    resultados: estado === "VALIDO" ? resultados : {},
    lecturas: { estimadas: pf.estimadas, margen: pf.margen, limite: pf.limite, contadas: control.contadas },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/**
 * Códigos de salida: 0 preflight sin lectura o informe VÁLIDO; 2 uso/credenciales;
 * 3 fallo de consulta o informe INCOMPLETO; 4 abortado por el límite de lecturas.
 */
async function ejecutar(argv, deps = {}) {
  const {
    crearFirestore = crearFirestoreReal,
    entorno = process.env,
    raizRepo = RAIZ_REPO,
    plataforma = process.platform,
    salida = process.stdout,
    errores = process.stderr,
    ahora = new Date(),
  } = deps;

  let opciones;
  let clave;
  try {
    opciones = parsearArgumentos(argv.slice(2));
    const ruta = validarRutaClave(opciones.clave, { raizRepo, entorno, plataforma });
    clave = cargarClave(ruta, opciones.proyecto);
  } catch (e) {
    errores.write(`${e instanceof ErrorUso ? `${e.message} [${e.codigo}]` : "Error inesperado validando la ejecución."}\n`);
    return 2;
  }

  let conexion;
  try {
    conexion = crearFirestore(clave);
  } catch (e) {
    errores.write(`No se pudo inicializar Firestore [${codigoError(e)}].\n`);
    return 3;
  }
  clave = null;

  try {
    const pf = await preflight(conexion.db, opciones);
    const textoPreflight = formatearPreflight(pf, opciones.proyecto);
    const emitir = (perfil, extra) => {
      if (opciones.json) salida.write(`${JSON.stringify({ preflight: pf, ...extra, ...(perfil ? { perfil } : {}) }, null, 2)}\n`);
      else salida.write(`${textoPreflight}${extra.mensaje ? `\n${extra.mensaje}` : ""}${perfil ? `\n\n${formatearInforme(perfil)}` : ""}\n`);
    };

    if (pf.error) {
      emitir(null, { mensaje: "Preflight fallido: no se leyó ningún documento." });
      return 3;
    }
    if (pf.requeridasSinDocumentos.length) {
      emitir(null, { mensaje: "ESTADO: NO VÁLIDO — faltan colecciones requeridas. No se leyó ningún documento." });
      return 3;
    }
    if (!opciones.leer) {
      emitir(null, { mensaje: "Fase de lectura NO ejecutada (requiere --leer --max-lecturas=N)." });
      return 0;
    }
    if (pf.totalConMargen > opciones.maxLecturas) {
      emitir(null, { mensaje: `ABORTADO antes de leer documentos: estimación + margen (${pf.totalConMargen}) supera --max-lecturas (${opciones.maxLecturas}).` });
      return 4;
    }

    const perfil = await lectura(conexion.db, pf, opciones, ahora);
    emitir(perfil, {});
    return perfil.estado === "VALIDO" ? 0 : 3;
  } finally {
    try {
      if (conexion && typeof conexion.cerrar === "function") await conexion.cerrar();
    } catch (_) {
      // Cerrar la conexión no afecta al resultado
    }
  }
}

if (require.main === module) {
  ejecutar(process.argv).then(
    (codigo) => {
      process.exitCode = codigo;
    },
    () => {
      process.stderr.write("Error inesperado.\n");
      process.exitCode = 3;
    }
  );
}

module.exports = {
  ejecutar,
  parsearArgumentos,
  validarRutaClave,
  cargarClave,
  calcularMargen,
  preflight,
  PLAN,
  CONFIG_DOC,
  MARGEN_PORCENTAJE_DEFECTO,
  MARGEN_MINIMO_DEFECTO,
};
