import React from "react";
import { Alert, AlertTitle, Box, Typography } from "@mui/material";

const formatUsd = (valor) =>
  `$${Number(valor || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatBs = (valor) =>
  `Bs ${Number(valor || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Textos de lo que quedó fuera de un total (resumirCompletitud de src/lib/finanzas.js).
 * Los egresos ambiguos se describen solo con datos que no dependen de cómo se
 * interpreten: el USD registrado (mínimo) y los Bs sin clasificar, sin sumarlos.
 */
export function lineasCompletitud(completitud) {
  if (!completitud) return [];
  const { ambiguos, pendientesConversion, sinPeriodo } = completitud;
  const lineas = [];
  if (ambiguos && ambiguos.cantidad > 0) {
    lineas.push({
      clave: "ambiguos",
      titulo: "Excluido por ambigüedad",
      texto: `${ambiguos.cantidad} egreso(s) con importe en USD y en Bs a la vez: al menos ${formatUsd(ambiguos.minimoUSD)} registrados en USD y ${formatBs(ambiguos.bsSinClasificar)} sin clasificar. No se suman para no contar dos veces el mismo gasto.`,
    });
  }
  if (pendientesConversion && pendientesConversion.cantidad > 0) {
    const partes = [];
    if (pendientesConversion.egresos > 0) partes.push(`${pendientesConversion.egresos} egreso(s) sin tasa registrada`);
    if (pendientesConversion.ingresos > 0) partes.push(`${pendientesConversion.ingresos} ingreso(s) sin factor para estimar`);
    lineas.push({
      clave: "conversion",
      titulo: "Pendiente de conversión",
      texto: `${partes.join(" y ")}, por ${formatBs(pendientesConversion.bs)}. No suman en USD.`,
    });
  }
  if (sinPeriodo && sinPeriodo.total > 0) {
    lineas.push({
      clave: "periodo",
      titulo: "Sin período",
      texto: `${sinPeriodo.total} registro(s) sin fecha verificable no se asignan a ningún período.`,
    });
  }
  return lineas;
}

export function textoEstimaciones(completitud) {
  if (!completitud || !completitud.incluyeEstimaciones) return null;
  return `Incluye ${formatUsd(completitud.usdEstimado)} estimados con el factor manual actual (ingresos en Bs sin conversión registrada).`;
}

/** Constancia de nóminas prorrateadas: suman, pero solo la parte de sus días en el rango. */
export function textoProrrateos(completitud) {
  const p = completitud && completitud.prorrateos;
  if (!p || p.cantidad === 0) return null;
  return `Nómina prorrateada: ${p.cantidad} nómina(s) quedaron entre dos meses o en el límite del rango. Se incluyen ${formatUsd(p.usd)} de ${formatUsd(p.usdTotal)}, en proporción a los días que caen en el rango.`;
}

/**
 * Aviso de totales parciales. `compacto` usa texto pequeño (paneles laterales).
 * No muestra nada si el total está completo y no incluye estimaciones.
 */
export default function AvisoCompletitud({ completitud, compacto = false, sx }) {
  if (!completitud) return null;
  const lineas = lineasCompletitud(completitud);
  const estimaciones = textoEstimaciones(completitud);
  const prorrateos = textoProrrateos(completitud);
  if (completitud.completo && !estimaciones && !prorrateos) return null;

  if (compacto) {
    return (
      <Box sx={sx}>
        {!completitud.completo && (
          <Typography variant="caption" color="warning.main" sx={{ display: "block", fontWeight: 600 }}>
            Totales parciales, no reconciliados:
          </Typography>
        )}
        {lineas.map((l) => (
          <Typography key={l.clave} variant="caption" color="warning.main" sx={{ display: "block" }}>
            {l.titulo}: {l.texto}
          </Typography>
        ))}
        {[estimaciones, prorrateos].filter(Boolean).map((t) => (
          <Typography key={t} variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {t}
          </Typography>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, ...sx }}>
      {!completitud.completo && (
        <Alert severity="warning">
          <AlertTitle>Totales parciales: no reconciliados</AlertTitle>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Los totales incluyen solo los registros contabilizables. Queda fuera:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {lineas.map((l) => (
              <li key={l.clave}>
                <Typography variant="body2">
                  <strong>{l.titulo}:</strong> {l.texto}
                </Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}
      {estimaciones && <Alert severity="info">{estimaciones}</Alert>}
      {prorrateos && <Alert severity="info">{prorrateos}</Alert>}
    </Box>
  );
}
