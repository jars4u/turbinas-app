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
                    </TableCell>
                    <TableCell align="right">{e.cantidad}</TableCell>
                  </TableRow>
                ))}
                {consulta.resultado.conEstadoFueraDelCatalogo > 0 && (
                  <TableRow>
                    <TableCell>Estado fuera del catálogo</TableCell>
                    <TableCell align="right">{consulta.resultado.conEstadoFueraDelCatalogo}</TableCell>
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
      ) : (
        <Typography variant="caption" color="text.secondary">Consulta realizada: {consulta.herramienta}</Typography>
      )}
    </Box>
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
