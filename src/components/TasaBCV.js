import React from "react";
import { Box, Typography, TextField, Button, Skeleton } from "@mui/material";

export default function TasaBCV({
  tasaBCV,
  loadingTasa,
  mostrarInputTasa,
  tasaManual,
  setTasaManual,
  setTasaBCV,
  setMostrarInputTasa,
  guardarTasaBCV
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
          <Skeleton variant="text" width={260} height={14} />
        </Box>
      ) : mostrarInputTasa ? (
        <Box>
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            No se pudo obtener la tasa automáticamente. Ingresa el valor manualmente:
          </Typography>
          <TextField
            label="Tasa BCV manual"
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
          <Button
            variant="contained"
            color="primary"
            size="small"
            sx={{ mt: 1, ml: 1 }}
            disabled={!tasaManual}
            onClick={async () => {
              setTasaBCV(parseFloat(tasaManual));
              sessionStorage.setItem("tasaBCVManual", tasaManual);
              setMostrarInputTasa(false);
              await guardarTasaBCV(parseFloat(tasaManual)); // Guardar manual en Firestore
            }}
          >
            Usar tasa
          </Button>
        </Box>
      ) : (
        <>
          <Typography variant="h5" color="primary.main">
            Bs. {tasaBCV
              ? tasaBCV.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "No disponible"}
          </Typography>
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
