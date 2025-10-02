import React, { useState, useEffect } from "react";
import { obtenerFactorConversion } from "../lib/factorConversionFirebase";
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
  const [precioBs, setPrecioBs] = useState(null);
  const [precioUsdConvertido, setPrecioUsdConvertido] = useState(null);
  
  useEffect(() => {
    async function fetchConversion() {
      if (form.precio) {
        const factor = await obtenerFactorConversion();
        // Obtener tasa BCV
        let tasa = 1;
        try {
          const mod = await import('../lib/tasaBCVFirebase');
          tasa = await mod.obtenerTasaBCV();
        } catch (e) {}
        const precioNum = parseFloat(form.precio);
        if (!isNaN(precioNum) && factor && tasa) {
          setPrecioBs((precioNum * factor).toFixed(2));
          setPrecioUsdConvertido((precioNum * factor / tasa).toFixed(2));
        } else {
          setPrecioBs(null);
          setPrecioUsdConvertido(null);
        }
      } else {
        setPrecioBs(null);
        setPrecioUsdConvertido(null);
      }
    }
    fetchConversion();
  }, [form.precio]);
  useEffect(() => {
    async function fetchConversion() {
      if (form.precio && (facturaForm.formaPago === "pago movil" || facturaForm.formaPago2 === "pago movil")) {
        const factor = await obtenerFactorConversion();
        const precioNum = parseFloat(form.precio);
        if (!isNaN(precioNum) && factor) {
          setPrecioBs((precioNum * factor).toFixed(2));
        }
      } else {
        setPrecioBs(null);
      }
    }
    fetchConversion();
  }, [form.precio, facturaForm.formaPago, facturaForm.formaPago2]);
  useEffect(() => {
    async function fetchConversion() {
      if (form.precio && (facturaForm.formaPago === "pago movil" || facturaForm.formaPago2 === "pago movil")) {
        const factor = await obtenerFactorConversion();
        const precioNum = parseFloat(form.precio);
        if (!isNaN(precioNum) && factor) {
          setPrecioBs((precioNum * factor).toFixed(2));
        }
      } else {
        setPrecioBs(null);
      }
    }
    fetchConversion();
  }, [form.precio, facturaForm.formaPago, facturaForm.formaPago2]);

  const handleRegister = async () => {
    setFacturaIntento(true);
    // Validación mínima: campos obligatorios
    if (!facturaForm.numeroFactura || !facturaForm.formaPago || !facturaForm.monto) return;
    if (agregarFormaPago) {
      if (!facturaForm.formaPago2 || !facturaForm.monto2) return;
    }
    setLoading(true);
    const payload = {
      numeroFactura: facturaForm.numeroFactura ? facturaForm.numeroFactura.toUpperCase() : '',
      formaPago: facturaForm.formaPago ? facturaForm.formaPago.toUpperCase() : '',
      monto: facturaForm.monto,
      referencia: facturaForm.referencia ? facturaForm.referencia.toUpperCase() : ''
    };
    if (
      agregarFormaPago &&
      facturaForm.formaPago2 &&
      facturaForm.monto2 &&
      facturaForm.referencia2 !== undefined
    ) {
      payload.formaPago2 = facturaForm.formaPago2 ? facturaForm.formaPago2.toUpperCase() : '';
      payload.monto2 = facturaForm.monto2;
      payload.referencia2 = facturaForm.referencia2 ? facturaForm.referencia2.toUpperCase() : '';
    }
    console.log('Payload registro pago:', payload);
    await onRegister(payload);
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
            {form.precio ? (
              <>
                <span>
                  {facturaForm.formaPago === "pago movil"
                    ? `$ ${precioUsdConvertido ? Number(precioUsdConvertido).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}`
                    : `$ ${Number(form.precio).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  }
                </span>
                {facturaForm.formaPago === "pago movil" && precioBs && (
                  <span style={{ marginLeft: 12 }}>
                    | Bs {Number(precioBs).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </>
            ) : '—'}
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
