import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Button,
  CircularProgress
} from "@mui/material";

export default function PaymentModal({ open, onClose, form, onRegister }) {
  const [loading, setLoading] = useState(false);
  const [facturaForm, setFacturaForm] = useState({
    numeroFactura: "",
    formaPago: "",
    referencia: ""
  });
  const [facturaIntento, setFacturaIntento] = useState(false);

  const handleRegister = async () => {
    setFacturaIntento(true);
    if (!facturaForm.numeroFactura || !facturaForm.formaPago) return;
    setLoading(true);
    await onRegister({
      numeroFactura: facturaForm.numeroFactura,
      formaPago: facturaForm.formaPago,
      referencia: facturaForm.referencia
    });
    setLoading(false);
    setFacturaForm({ numeroFactura: "", formaPago: "", referencia: "" });
    setFacturaIntento(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') {
          onClose();
        }
      }}
    >
      <DialogTitle>Facturación</DialogTitle>
      <DialogContent sx={{ minWidth: 350, maxWidth: 400 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Modelo</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>{form.vehiculo}</Typography>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Servicio</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>{form.servicio}</Typography>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Precio</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>${form.precio}</Typography>
        </Box>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
          <TextField
            label="No. de factura"
            name="numeroFactura"
            size="small"
            value={facturaForm.numeroFactura}
            onChange={e => setFacturaForm({ ...facturaForm, numeroFactura: e.target.value })}
            sx={{ flex: 1 }}
            required
            error={facturaIntento && !facturaForm.numeroFactura}
            helperText={facturaIntento && !facturaForm.numeroFactura ? 'Campo obligatorio' : ''}
          />
          <Select
            name="formaPago"
            size="small"
            value={facturaForm.formaPago}
            onChange={e => setFacturaForm({ ...facturaForm, formaPago: e.target.value })}
            displayEmpty
            sx={{ flex: 1 }}
            required
            error={facturaIntento && !facturaForm.formaPago}
          >
            <MenuItem value="">Forma de pago...</MenuItem>
            <MenuItem value="efectivo">Efectivo</MenuItem>
            <MenuItem value="pago movil">Pago móvil</MenuItem>
            <MenuItem value="zelle">Zelle</MenuItem>
            <MenuItem value="transferencia">Transferencia</MenuItem>
            <MenuItem value="credito">Crédito</MenuItem>
          </Select>
        </Box>
        <TextField
          label="Referencia / Observaciones"
          name="referencia"
          fullWidth
          size="small"
          value={facturaForm.referencia}
          onChange={e => setFacturaForm({ ...facturaForm, referencia: e.target.value })}
          sx={{ mb: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onClose} variant="outlined" color="primary" size="small" disabled={loading}>Cerrar</Button>
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={handleRegister}
          disabled={loading}
          startIcon={loading ? <CircularProgress color="inherit" size={18} /> : null}
        >
          {loading ? "Registrando..." : "Registrar pago"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
