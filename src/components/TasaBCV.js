import React from "react";
import { Box, Typography, TextField, Button, Skeleton } from "@mui/material";

export default function TasaBCV({
  tasaBCV,
  tasaEUR,
  loadingTasa,
  mostrarInputTasa,
  tasaManual,
  setTasaManual,
  tasaEURManual,
  setTasaEURManual,
  setTasaBCV,
  setTasaEUR,
  setMostrarInputTasa,
  puedeGuardar = true,
  guardarTasaBCV,
  guardarTasaEURBCV
}) {
  return (
    <Box
      my={2}
      p={2}
      sx={{
        border: "1px solid #ddd",
        borderRadius: 2,
        backgroundColor: "#f9f9f9",
        textAlign: "center",
      }}
    >
      <Typography variant="h6" fontWeight="bold">
        Tasa de Cambio BCV
      </Typography>
      {loadingTasa ? (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={200} height={28} />
          <Skeleton variant="text" width={260} height={14} />
        </Box>
      ) : mostrarInputTasa ? (
        <Box>
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            No se pudo obtener la tasa automáticamente. Ingresa el valor manualmente:
          </Typography>
          <TextField
            label="Tasa BCV manual ($)"
            type="number"
            value={tasaManual}
            onChange={(e) => setTasaManual(e.target.value.replace(/[^0-9.]/g, ""))}
            size="small"
            sx={{ maxWidth: 180, mx: "auto" }}
            inputProps={{
              inputMode: "decimal",
              pattern: "[0-9.]*",
              step: "0.01",
              min: 0,
              style: { MozAppearance: "textfield" },
            }}
          />
          <TextField
            label="Tasa BCV manual (€)"
            type="number"
            value={tasaEURManual}
            onChange={(e) => setTasaEURManual(e.target.value.replace(/[^0-9.]/g, ""))}
            size="small"
            sx={{ maxWidth: 180, mx: "auto", ml: { xs: 0, sm: 1 } }}
            inputProps={{
              inputMode: "decimal",
              pattern: "[0-9.]*",
              step: "0.01",
              min: 0,
              style: { MozAppearance: "textfield" },
            }}
          />
          <Button
            variant="contained"
            color="primary"
            size="small"
            sx={{ mt: 1, ml: 1 }}
            disabled={!tasaManual || !puedeGuardar}
            onClick={async () => {
              setTasaBCV(parseFloat(tasaManual));
              sessionStorage.setItem("tasaBCVManual", tasaManual);
              if (tasaEURManual) {
                setTasaEUR(parseFloat(tasaEURManual));
                sessionStorage.setItem("tasaEURManual", tasaEURManual);
              }
              setMostrarInputTasa(false);
              if (puedeGuardar) {
                // Guardar la tasa manual en Firestore
                await guardarTasaBCV(parseFloat(tasaManual));
                if (tasaEURManual && guardarTasaEURBCV) {
                  await guardarTasaEURBCV(parseFloat(tasaEURManual));
                }
              }
            }}
          >
            Usar tasa
          </Button>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              mt: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: { xs: 2, sm: 5 },
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Dólar (USD $)
              </Typography>
              <Typography variant="h5" color="primary.main">
                Bs. {tasaBCV
                  ? tasaBCV.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "No disponible"}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Euro (EUR €)
              </Typography>
              <Typography variant="h5" color="secondary.main">
                Bs. {tasaEUR
                  ? tasaEUR.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "No disponible"}
              </Typography>
            </Box>
          </Box>
          {sessionStorage.getItem("tasaBCVManual") &&
            tasaBCV === parseFloat(sessionStorage.getItem("tasaBCVManual")) && (
              <Typography
                variant="caption"
                color="warning.main"
                sx={{ display: "block", mt: 1 }}
              >
                Usando tasa BCV manual ingresada por el usuario durante esta sesión.
              </Typography>
            )}
        </>
      )}
      <Typography variant="caption" color="text.secondary">
        Fuente: Banco Central de Venezuela (BCV)
      </Typography>
    </Box>
  );
}
