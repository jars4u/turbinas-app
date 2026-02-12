import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Box, Button, CircularProgress } from "@mui/material";
import ConfirmDialog from "../common/ConfirmDialog";

export default function EstadoChangeDialog({
  open,
  onClose,
  estados = [],
  vehiculo = null,
  onApplyEstado,
}) {
  const [confirmOcultar, setConfirmOcultar] = useState({ open: false, estado: null });
  const [loading, setLoading] = useState(false);
  const [applyingEstado, setApplyingEstado] = useState(null);

  const handleSelect = async (estado) => {
    if (!vehiculo) return;
    if (estado?.defaultFacturar) return;
    const esOcultar = !!estado.dejarDeMostrar;
    if (esOcultar) {
      setConfirmOcultar({ open: true, estado });
      return;
    }
    try {
      setLoading(true);
      setApplyingEstado(estado.nombre);
      await onApplyEstado?.(estado, { ocultar: false });
      onClose?.();
    } finally {
      setLoading(false);
      setApplyingEstado(null);
    }
  };

  const handleConfirmOcultar = async () => {
    if (!vehiculo || !confirmOcultar.estado) return;
    try {
      setLoading(true);
      setApplyingEstado(confirmOcultar.estado.nombre);
      await onApplyEstado?.(confirmOcultar.estado, { ocultar: true });
      setConfirmOcultar({ open: false, estado: null });
      onClose?.();
    } finally {
      setLoading(false);
      setApplyingEstado(null);
    }
  };

  const validColors = [
    "default",
    "primary",
    "secondary",
    "error",
    "info",
    "success",
    "warning",
  ];

  const estadosCambiables = Array.isArray(estados) ? estados : [];

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>Cambiar estado</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 220 }}>
            {estadosCambiables.map((estado) => {
              const isSelected =
                vehiculo && ((vehiculo.status === estado.nombre) || (vehiculo.estado === estado.nombre));
              let buttonColor = validColors.includes(estado.color) ? estado.color : "primary";
              let sxButton = { justifyContent: "flex-start", textTransform: "none", fontWeight: 600 };
              if (estado.color === "grey") {
                buttonColor = "inherit";
                sxButton = {
                  ...sxButton,
                  bgcolor: "#e0e0e0",
                  color: "#424242",
                  "&:hover": { bgcolor: "#bdbdbd" },
                };
              }
              return (
                <Button
                  key={estado.nombre}
                  variant={isSelected ? "contained" : "outlined"}
                  color={buttonColor}
                  onClick={() => handleSelect(estado)}
                  sx={sxButton}
                  disabled={loading || !!estado?.defaultFacturar}
                  startIcon={applyingEstado === estado.nombre && loading ? <CircularProgress color="inherit" size={16} /> : null}
                >
                  {estado.label}
                </Button>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} color="primary" disabled={loading}>Cancelar</Button>
            {loading ? <Box sx={{ display: 'flex', alignItems: 'center', pr: 1 }}><CircularProgress size={20} /></Box> : null}
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOcultar.open}
        title="Confirmar acción"
        message="Este servicio desaparecerá del Dashboard. ¿Desea continuar?"
        confirmText="Confirmar"
        cancelText="Cancelar"
        confirmColor="error"
        onCancel={() => setConfirmOcultar({ open: false, estado: null })}
        onConfirm={handleConfirmOcultar}
      />
    </>
  );
}
