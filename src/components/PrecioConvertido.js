import React, { useEffect, useState } from "react";
import { obtenerFactorConversion } from "../lib/factorConversionFirebase";
import { obtenerTasaBCV } from "../lib/tasaBCVFirebase";
import { Typography } from "@mui/material";

export default function PrecioConvertido({ precio }) {
  const [factor, setFactor] = useState(null);
  const [tasa, setTasa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const f = await obtenerFactorConversion();
      const t = await obtenerTasaBCV();
      setFactor(f);
      setTasa(t);
      setLoading(false);
    }
    fetchData();
  }, []);

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