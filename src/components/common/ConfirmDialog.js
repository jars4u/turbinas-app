import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

export default function ConfirmDialog({
  open,
  title = "Confirmar",
  message = "¿Deseas continuar?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
  confirmColor = "primary",
  maxWidth = "xs",
  fullWidth = true,
}) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth={fullWidth} maxWidth={maxWidth}>
      {title && <DialogTitle>{title}</DialogTitle>}
      {message && (
        <DialogContent>
          <Typography>{message}</Typography>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onCancel} color="primary" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          {cancelText}
        </Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
