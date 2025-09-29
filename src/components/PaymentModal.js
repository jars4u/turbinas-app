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
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';

export default function PaymentModal({ open, onClose, form, onRegister }) {
  const [loading, setLoading] = useState(false);
  const [facturaForm, setFacturaForm] = useState({
    numeroFactura: "",
    formaPago: "",
    monto: "",
    referencia: "",
    formaPago2: "",
    monto2: "",
    referencia2: ""
  });
  const [agregarFormaPago, setAgregarFormaPago] = useState(false);
  const [facturaIntento, setFacturaIntento] = useState(false);

  const handleRegister = async () => {
    setFacturaIntento(true);
    const precio = Number(form.precio);
    const monto1 = Number(facturaForm.monto);
    const monto2 = Number(facturaForm.monto2);
    if (!facturaForm.numeroFactura || !facturaForm.formaPago || !facturaForm.monto) return;
    if (agregarFormaPago) {
      if (!facturaForm.formaPago2 || !facturaForm.monto2) return;
      if (monto1 + monto2 !== precio) {
        alert('La suma de los montos debe coincidir con el precio.');
        return;
      }
    } else {
      if (monto1 !== precio) {
        alert('El monto debe coincidir con el precio.');
        return;
      }
    }
    setLoading(true);
    await onRegister({
      numeroFactura: facturaForm.numeroFactura,
      formaPago: facturaForm.formaPago,
      monto: facturaForm.monto,
      referencia: facturaForm.referencia,
      formaPago2: agregarFormaPago ? facturaForm.formaPago2 : undefined,
      monto2: agregarFormaPago ? facturaForm.monto2 : undefined,
      referencia2: agregarFormaPago ? facturaForm.referencia2 : undefined
    });
    setLoading(false);
    setFacturaForm({ numeroFactura: "", formaPago: "", monto: "", referencia: "", formaPago2: "", monto2: "", referencia2: "" });
    setFacturaIntento(false);
    setAgregarFormaPago(false);
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
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReceiptOutlinedIcon color="default" fontSize="medium" />
        Facturación
      </DialogTitle>
      <DialogContent sx={{ minWidth: 350, maxWidth: 400 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Modelo</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>{form.vehiculo}</Typography>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Servicio</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>{form.servicio}</Typography>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Precio</Typography>
          <Typography variant="body1" sx={{ mb: form.precio ? 0.5 : 0 }}>
            {form.precio ? `$${form.precio}` : '—'}
          </Typography>
          {!form.precio && (
            <Typography variant="subtitle2" color="warning.main" fontSize={13} sx={{ mb: 1 }}>
              No se ha definido un precio para este servicio. No se puede registrar el pago.
            </Typography>
          )}
        </Box>
        <Box sx={{ mb: 2 }}>
          <TextField
            label="No. de factura"
            name="numeroFactura"
            size="small"
            value={facturaForm.numeroFactura}
            onChange={e => setFacturaForm({ ...facturaForm, numeroFactura: e.target.value })}
            fullWidth
            required
            error={facturaIntento && !facturaForm.numeroFactura}
            helperText={facturaIntento && !facturaForm.numeroFactura ? 'Campo obligatorio' : ''}
          />
        </Box>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
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
            <MenuItem value="efectivo">Efectivo ($)</MenuItem>
            <MenuItem value="pago movil">Pago móvil (Bs)</MenuItem>
            <MenuItem value="zelle">Zelle ($)</MenuItem>
            <MenuItem value="transferencia" disabled>Transferencia</MenuItem>
            <MenuItem value="credito" disabled>Crédito</MenuItem>
          </Select>
          <TextField
            label="Monto"
            name="monto"
            size="small"
            type="number"
            value={facturaForm.monto}
            onChange={e => setFacturaForm({ ...facturaForm, monto: e.target.value })}
            sx={{ flex: 1 }}
            required
            error={facturaIntento && !facturaForm.monto}
            helperText={facturaIntento && !facturaForm.monto ? 'Campo obligatorio' : ''}
          />
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
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="checkbox"
            id="agregarFormaPago"
            checked={agregarFormaPago}
            onChange={e => setAgregarFormaPago(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          <label htmlFor="agregarFormaPago" style={{ fontSize: 15, cursor: 'pointer' }}>
            Agregar segunda forma de pago
          </label>
        </Box>
        {agregarFormaPago && (
          <>
            <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
              <Select
                name="formaPago2"
                size="small"
                value={facturaForm.formaPago2}
                onChange={e => setFacturaForm({ ...facturaForm, formaPago2: e.target.value })}
                displayEmpty
                sx={{ flex: 1 }}
                required
                error={facturaIntento && !facturaForm.formaPago2}
              >
                <MenuItem value="">Forma de pago...</MenuItem>
                <MenuItem value="efectivo">Efectivo ($)</MenuItem>
                <MenuItem value="pago movil">Pago móvil (Bs)</MenuItem>
                <MenuItem value="zelle">Zelle ($)</MenuItem>
                <MenuItem value="transferencia" disabled>Transferencia</MenuItem>
                <MenuItem value="credito" disabled>Crédito</MenuItem>
              </Select>
              <TextField
                label="Monto"
                name="monto2"
                size="small"
                type="number"
                value={facturaForm.monto2}
                onChange={e => setFacturaForm({ ...facturaForm, monto2: e.target.value })}
                sx={{ flex: 1 }}
                required
                error={facturaIntento && !facturaForm.monto2}
                helperText={facturaIntento && !facturaForm.monto2 ? 'Campo obligatorio' : ''}
              />
            </Box>
            <TextField
              label="Referencia / Observaciones"
              name="referencia2"
              size="small"
              value={facturaForm.referencia2}
              onChange={e => setFacturaForm({ ...facturaForm, referencia2: e.target.value })}
              fullWidth
              sx={{ mb: 2 }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onClose} variant="outlined" color="primary" size="small" disabled={loading}>Cerrar</Button>
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={handleRegister}
          disabled={loading || !form.precio}
          startIcon={loading ? <CircularProgress color="inherit" size={18} /> : null}
        >
          {loading ? "Registrando..." : "Registrar pago"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
