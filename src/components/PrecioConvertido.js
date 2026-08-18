import React, { useEffect, useState } from "react";
import { obtenerTasaBCVPorMoneda, MONEDAS_BCV } from "../lib/tasasBCV";
import useFactorConversion from "../hooks/useFactorConversion";
import { Typography } from "@mui/material";

export default function PrecioConvertido({ precio }) {
  const { factor, detalle, cargando } = useFactorConversion();
  const [tasa, setTasa] = useState(null);

  // La tasa del dólar se consulta al vuelo para expresar el equivalente en $
  useEffect(() => {
    let activo = true;
    obtenerTasaBCVPorMoneda(MONEDAS_BCV.USD)
      .then((t) => {
        if (activo) setTasa(t);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [detalle]);

  const loading = cargando;
  let resultado = null;
  const precioNum = parseFloat(precio);
  let resultadoBs = null;
  if (!loading && factor && tasa && !isNaN(precioNum)) {
    resultado = (precioNum * factor / tasa).toFixed(2);
    resultadoBs = (precioNum * factor).toFixed(2);
  }

  return (
    <Typography variant="caption" color="warning.main" sx={{ mt: 0, mb: 1, fontSize: '0.7rem' }}>
      {loading
        ? "Calculando conversión..."
        : (resultado !== null && resultadoBs !== null
            ? `Si paga en Bs el precio será de $${Number(resultado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} a tasa BCV | Bs ${Number(resultadoBs).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "")}
    </Typography>
  );
}