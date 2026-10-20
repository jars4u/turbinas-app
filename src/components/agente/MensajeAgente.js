import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";

function formatearFechaHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Resultado de una consulta a la app. Se pinta desde los datos estructurados que
 * devolvió la herramienta (no desde el texto del modelo), para que quede claro
 * qué cifras son datos reales de Turbinas App.
 */
function ResultadoConsulta({ consulta }) {
  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "#fff", border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
        <Chip size="small" color="primary" variant="outlined" icon={<StorageOutlinedIcon />} label="Datos de Turbinas App" />
        {consulta.resultado && (
          <Typography variant="caption" color="text.secondary">
            Consultado: {formatearFechaHora(consulta.resultado.consultadoEn)}
          </Typography>
        )}
      </Box>
      {consulta.error ? (
        <Alert severity="warning" sx={{ py: 0 }}>
          No se pudieron obtener los datos: {consulta.error.mensaje}
        </Alert>
      ) : consulta.herramienta === "resumen_servicios_por_estado" && consulta.resultado ? (
        <>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            Servicios por estado actual
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" aria-label="Servicios por estado">
              <TableHead>
                <TableRow>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {consulta.resultado.porEstado.map((e) => (
                  <TableRow key={e.nombre}>
                    <TableCell>
                      {e.etiqueta}
                      {e.esEstadoFacturacion && (
                        <Typography component="span" variant="caption" color="text.secondary"> · estado de facturación</Typography>
                      )}
                      {e.origen === "sistema" && (
                        <Typography component="span" variant="caption" color="text.secondary"> · estado del sistema</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">{e.cantidad}</TableCell>
                  </TableRow>
                ))}
                {consulta.resultado.conEstadoNoReconocido > 0 && (
                  <TableRow>
                    <TableCell>Otros estados no reconocidos</TableCell>
                    <TableCell align="right">{consulta.resultado.conEstadoNoReconocido}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{consulta.resultado.totalServicios}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        </>
      ) : consulta.resultado && Array.isArray(consulta.resultado.resumen) ? (
        <ResumenConsulta consulta={consulta} />
      ) : (
        <Typography variant="caption" color="text.secondary">Consulta realizada: {consulta.herramienta}</Typography>
      )}
    </Box>
  );
}

const TITULOS = {
  resumen_financiero: "Resumen financiero",
  cuentas_por_cobrar: "Cuentas por cobrar",
  cuentas_por_pagar: "Cuentas por pagar",
  servicios_del_periodo: "Servicios del periodo",
  nomina_por_empleado: "Nómina por empleado",
};

function formatearValor({ valor, tipo }) {
  const n = Number(valor);
  if (tipo === "usd") return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (tipo === "bs") return `Bs ${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (tipo === "numero") return n.toLocaleString("es-VE");
  return String(valor);
}

function formatearDia(dia) {
  const [y, m, d] = String(dia || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : "-";
}

/** Cifras clave de una herramienta de datos (campo `resumen`), periodo y notas. */
function ResumenConsulta({ consulta }) {
  const { resultado } = consulta;
  const notas = Array.isArray(resultado.notas) ? resultado.notas : [];
  return (
    <>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
        {TITULOS[consulta.herramienta] || consulta.herramienta}
      </Typography>
      {resultado.periodo && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          Del {formatearDia(resultado.periodo.desde)} al {formatearDia(resultado.periodo.hasta)} (hora de Venezuela)
        </Typography>
      )}
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" aria-label={TITULOS[consulta.herramienta] || consulta.herramienta}>
          <TableBody>
            {resultado.resumen.map((fila) => (
              <TableRow key={fila.etiqueta}>
                <TableCell sx={{ pl: fila.etiqueta.startsWith("·") ? 3 : undefined }}>{fila.etiqueta.replace(/^·\s*/, "")}</TableCell>
                <TableCell align="right">{formatearValor(fila)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {resultado.totalesCompletos === false && (
        <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.75, fontWeight: 600 }}>
          Totales parciales: revisa las notas.
        </Typography>
      )}
      {notas.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
          {notas.map((nota) => (
            <li key={nota}>
              <Typography variant="caption" color="text.secondary">{nota}</Typography>
            </li>
          ))}
        </Box>
      )}
    </>
  );
}

// Animación de escritura: tiempo entre pasos y duración máxima (los textos largos
// avanzan varias palabras por paso para no hacer esperar).
const INTERVALO_MS = 30;
const DURACION_MAX_MS = 4000;

function prefiereMenosMovimiento() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Muestra el texto palabra a palabra, como los chats de IA, con un cursor.
 * Es una animación de la respuesta ya recibida. Los lectores de pantalla reciben
 * el texto completo de una vez (no palabra a palabra). Si el sistema pide reducir
 * el movimiento, el texto aparece directamente.
 */
function TextoAnimado({ texto, animar, alAvanzar, alTerminar }) {
  const partes = useMemo(() => texto.match(/\S+\s*|\s+/g) || [], [texto]);
  const instantaneo = !animar || prefiereMenosMovimiento();
  const [visibles, setVisibles] = useState(instantaneo ? partes.length : 0);
  const avanzarRef = useRef(alAvanzar);
  const terminarRef = useRef(alTerminar);
  avanzarRef.current = alAvanzar;
  terminarRef.current = alTerminar;

  useEffect(() => {
    if (instantaneo) {
      setVisibles(partes.length);
      return undefined;
    }
    const porPaso = Math.max(1, Math.ceil(partes.length / Math.ceil(DURACION_MAX_MS / INTERVALO_MS)));
    let mostradas = 0;
    const id = setInterval(() => {
      mostradas = Math.min(partes.length, mostradas + porPaso);
      setVisibles(mostradas);
      if (mostradas >= partes.length) clearInterval(id);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [instantaneo, partes]);

  const completo = visibles >= partes.length;
  useEffect(() => {
    if (avanzarRef.current) avanzarRef.current();
    if (completo && terminarRef.current) terminarRef.current();
  }, [visibles, completo]);

  return (
    <>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} aria-hidden={completo ? undefined : true}>
        {partes.slice(0, visibles).join("")}
        {!completo && (
          <Box
            component="span"
            data-testid="cursor-escritura"
            sx={{
              display: "inline-block",
              width: "0.5em",
              height: "1em",
              ml: 0.25,
              verticalAlign: "text-bottom",
              bgcolor: "text.secondary",
              animation: "parpadeo 1s steps(1) infinite",
              "@keyframes parpadeo": { "50%": { opacity: 0 } },
            }}
          />
        )}
      </Typography>
      {!completo && <Box component="span" sx={visualmenteOculto}>{texto}</Box>}
    </>
  );
}

const visualmenteOculto = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/**
 * animar: escribe la respuesta palabra a palabra (solo el último mensaje recibido).
 * Los datos de la app se muestran al terminar de escribir el texto.
 */
export default function MensajeAgente({ mensaje, animar = false, alAvanzar, alTerminarAnimacion }) {
  const esUsuario = mensaje.rol === "usuario";
  const consultas = mensaje.consultas || [];
  const [textoListo, setTextoListo] = useState(!animar);
  const terminar = useCallback(() => {
    setTextoListo(true);
    if (alTerminarAnimacion) alTerminarAnimacion();
  }, [alTerminarAnimacion]);
  const mostrarDetalles = esUsuario || textoListo || !animar;
  return (
    <Box sx={{ display: "flex", justifyContent: esUsuario ? "flex-end" : "flex-start", mb: 1.5 }}>
      <Box
        sx={{
          maxWidth: { xs: "92%", sm: "80%" },
          px: 2,
          py: 1.25,
          borderRadius: esUsuario ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          bgcolor: esUsuario ? "primary.main" : "#f5f5f5",
          color: esUsuario ? "primary.contrastText" : "text.primary",
          minWidth: 0,
        }}
      >
        {esUsuario ? (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {mensaje.texto}
          </Typography>
        ) : (
          <TextoAnimado texto={mensaje.texto} animar={animar} alAvanzar={alAvanzar} alTerminar={terminar} />
        )}
        {!esUsuario && mostrarDetalles && consultas.map((c, i) => <ResultadoConsulta key={`${c.herramienta}-${i}`} consulta={c} />)}
        {!esUsuario && mostrarDetalles && consultas.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            Respuesta general: no consultó datos de Turbinas App.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
