import React from "react";
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

export default function MensajeAgente({ mensaje }) {
  const esUsuario = mensaje.rol === "usuario";
  const consultas = mensaje.consultas || [];
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
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {mensaje.texto}
        </Typography>
        {!esUsuario && consultas.map((c, i) => <ResultadoConsulta key={`${c.herramienta}-${i}`} consulta={c} />)}
        {!esUsuario && consultas.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            Respuesta general: no consultó datos de Turbinas App.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
