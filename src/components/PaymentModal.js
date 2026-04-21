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
  CircularProgress,
  Checkbox,
  FormControlLabel,
  FormControl,
  FormHelperText,
  Divider,
  useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';

const PAYMENT_METHOD_OPTIONS = [
  { value: 'efectivo', label: 'Efectivo ($)' },
  { value: 'binance', label: 'Binance ($)' },
  { value: 'pago movil', label: 'Pago móvil (Bs)' },
  { value: 'zelle', label: 'Zelle ($)' },
  { value: 'transferencia', label: 'Transferencia', disabled: true },
  { value: 'credito', label: 'Crédito', disabled: true },
];


export default function PaymentModal({ open, onClose, form, onRegister }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [salidaInventario, setSalidaInventario] = useState(form.salidaInventario || false);
  const [loading, setLoading] = useState(false);
  const [facturaForm, setFacturaForm] = useState({
    numeroFactura: "",
    formaPago: "",
    monto: "",
    referencia: "",
    formaPago2: "",
    monto2: "",
    referencia2: "",
    formaPago3: "",
    monto3: "",
    referencia3: ""
  });
  const [agregarFormaPago, setAgregarFormaPago] = useState(false);
  const [agregarTerceraFormaPago, setAgregarTerceraFormaPago] = useState(false);
  const [facturaIntento, setFacturaIntento] = useState(false);
  // ...variables y efectos eliminados, ya no se usan para mostrar el precio

  const buildFormaPago = (formaPago, monto, referencia) => ({
    formaPago: formaPago ? formaPago.toUpperCase() : '',
    monto,
    referencia: referencia ? referencia.toUpperCase() : '',
    salidaInventario,
  });

  const handleFacturaFieldChange = (field) => (event) => {
    setFacturaForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleRegister = async () => {
    setFacturaIntento(true);
    // Validación mínima: campos obligatorios
    if (!facturaForm.numeroFactura || !facturaForm.formaPago || !facturaForm.monto) return;
    if (agregarFormaPago && (!facturaForm.formaPago2 || !facturaForm.monto2)) return;
    if (agregarTerceraFormaPago && (!facturaForm.formaPago3 || !facturaForm.monto3)) return;
    setLoading(true);
    let formasPago = [];
    // Primera forma de pago
    formasPago.push(buildFormaPago(facturaForm.formaPago, facturaForm.monto, facturaForm.referencia));
    // Segunda forma de pago si corresponde
    if (agregarFormaPago && facturaForm.formaPago2 && facturaForm.monto2) {
      formasPago.push(buildFormaPago(facturaForm.formaPago2, facturaForm.monto2, facturaForm.referencia2));
    }
    // Tercera forma de pago si corresponde
    if (agregarTerceraFormaPago && facturaForm.formaPago3 && facturaForm.monto3) {
      formasPago.push(buildFormaPago(facturaForm.formaPago3, facturaForm.monto3, facturaForm.referencia3));
    }
    const payload = {
      numeroFactura: facturaForm.numeroFactura ? facturaForm.numeroFactura.toUpperCase() : '',
      formasPago,
    };
    console.log('Payload registro pago:', payload);
    await onRegister(payload);
    setLoading(false);
    setFacturaForm({ numeroFactura: "", formaPago: "", monto: "", referencia: "", formaPago2: "", monto2: "", referencia2: "", formaPago3: "", monto3: "", referencia3: "" });
    setFacturaIntento(false);
    setAgregarFormaPago(false);
    setAgregarTerceraFormaPago(false);
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
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}>
        <ReceiptOutlinedIcon color="default" fontSize="medium" />
        Facturación
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 1.5,
          px: { xs: 2, sm: 3 },
          maxHeight: { xs: 'calc(100dvh - 140px)', sm: 'unset' },
          overflowY: { xs: 'auto', sm: 'visible' }
        }}
      >
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Modelo</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>{form.vehiculo}</Typography>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Servicio</Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>{form.servicio}</Typography>
          <Typography variant="subtitle2" color="primary" fontWeight={600}>Precio</Typography>
          <Typography variant="body1" sx={{ mb: (form.precio || form.precioBs) ? 0.5 : 0 }}>
            {(form.precio || form.precioBs) ? (
              <>
                {form.precio && (
                  <span>
                    $ {Number(form.precio).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
                {form.precioBs && (
                  <span style={{ marginLeft: 12 }}>
                    | Bs {Number(form.precioBs).toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </>
            ) : '—'}
          </Typography>
          {!(form.precio || form.precioBs) && (
            <Typography variant="subtitle2" color="warning.main" fontSize={13} sx={{ mb: 1 }}>
              No se ha definido un precio para este servicio. No se puede registrar el pago.
            </Typography>
          )}
        </Box>
        <FormControlLabel
          sx={{ mb: 2 }}
          control={<Checkbox checked={salidaInventario} onChange={e => setSalidaInventario(e.target.checked)} />}
          label="Salida de inventario"
        />
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ mb: 2 }}>
          <TextField
            label="No. de factura"
            name="numeroFactura"
            size="small"
            value={facturaForm.numeroFactura}
            onChange={handleFacturaFieldChange('numeroFactura')}
            fullWidth
            required
            error={facturaIntento && !facturaForm.numeroFactura}
            helperText={facturaIntento && !facturaForm.numeroFactura ? 'Campo obligatorio' : ''}
          />
        </Box>
        <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormControl size="small" fullWidth error={facturaIntento && !facturaForm.formaPago}>
            <Select
              name="formaPago"
              value={facturaForm.formaPago}
              onChange={handleFacturaFieldChange('formaPago')}
              displayEmpty
              required
            >
              <MenuItem value="">Forma de pago...</MenuItem>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {facturaIntento && !facturaForm.formaPago && (
              <FormHelperText>Campo obligatorio</FormHelperText>
            )}
          </FormControl>
          <TextField
            label="Monto"
            name="monto"
            size="small"
            type="number"
            inputProps={{ step: "0.01", min: 0 }}
            value={facturaForm.monto}
            onChange={handleFacturaFieldChange('monto')}
            required
            error={facturaIntento && !facturaForm.monto}
            helperText={facturaIntento && !facturaForm.monto ? 'Campo obligatorio' : ''}
            fullWidth
          />
        </Box>
        <TextField
          label="Referencia / Observaciones"
          name="referencia"
          fullWidth
          size="small"
          value={facturaForm.referencia}
          onChange={handleFacturaFieldChange('referencia')}
          sx={{ mb: 2 }}
        />
        <FormControlLabel
          sx={{ mb: 2 }}
          control={
            <Checkbox
              checked={agregarFormaPago}
              onChange={e => {
                const checked = e.target.checked;
                setAgregarFormaPago(checked);
                if (!checked) {
                  setAgregarTerceraFormaPago(false);
                  setFacturaForm((prev) => ({
                    ...prev,
                    formaPago2: '',
                    monto2: '',
                    referencia2: '',
                    formaPago3: '',
                    monto3: '',
                    referencia3: ''
                  }));
                }
              }}
            />
          }
          label="Agregar segunda forma de pago"
        />
        {agregarFormaPago && (
          <>
            <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl size="small" fullWidth error={facturaIntento && !facturaForm.formaPago2}>
                <Select
                  name="formaPago2"
                  value={facturaForm.formaPago2}
                  onChange={handleFacturaFieldChange('formaPago2')}
                  displayEmpty
                  required
                >
                  <MenuItem value="">Forma de pago...</MenuItem>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                {facturaIntento && !facturaForm.formaPago2 && (
                  <FormHelperText>Campo obligatorio</FormHelperText>
                )}
              </FormControl>
              <TextField
                label="Monto"
                name="monto2"
                size="small"
                type="number"
                inputProps={{ step: "0.01", min: 0 }}
                value={facturaForm.monto2}
                onChange={handleFacturaFieldChange('monto2')}
                required
                error={facturaIntento && !facturaForm.monto2}
                helperText={facturaIntento && !facturaForm.monto2 ? 'Campo obligatorio' : ''}
                fullWidth
              />
            </Box>
            <TextField
              label="Referencia / Observaciones"
              name="referencia2"
              size="small"
              value={facturaForm.referencia2}
              onChange={handleFacturaFieldChange('referencia2')}
              fullWidth
              sx={{ mb: 2 }}
            />
            <FormControlLabel
              sx={{ mb: 2 }}
              control={
                <Checkbox
                  checked={agregarTerceraFormaPago}
                  onChange={e => {
                    const checked = e.target.checked;
                    setAgregarTerceraFormaPago(checked);
                    if (!checked) {
                      setFacturaForm((prev) => ({
                        ...prev,
                        formaPago3: '',
                        monto3: '',
                        referencia3: ''
                      }));
                    }
                  }}
                />
              }
              label="Agregar tercera forma de pago"
            />
            {agregarTerceraFormaPago && (
              <>
                <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <FormControl size="small" fullWidth error={facturaIntento && !facturaForm.formaPago3}>
                    <Select
                      name="formaPago3"
                      value={facturaForm.formaPago3}
                      onChange={handleFacturaFieldChange('formaPago3')}
                      displayEmpty
                      required
                    >
                      <MenuItem value="">Forma de pago...</MenuItem>
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {facturaIntento && !facturaForm.formaPago3 && (
                      <FormHelperText>Campo obligatorio</FormHelperText>
                    )}
                  </FormControl>
                  <TextField
                    label="Monto"
                    name="monto3"
                    size="small"
                    type="number"
                    inputProps={{ step: "0.01", min: 0 }}
                    value={facturaForm.monto3}
                    onChange={handleFacturaFieldChange('monto3')}
                    required
                    error={facturaIntento && !facturaForm.monto3}
                    helperText={facturaIntento && !facturaForm.monto3 ? 'Campo obligatorio' : ''}
                    fullWidth
                  />
                </Box>
                <TextField
                  label="Referencia / Observaciones"
                  name="referencia3"
                  size="small"
                  value={facturaForm.referencia3}
                  onChange={handleFacturaFieldChange('referencia3')}
                  fullWidth
                  sx={{ mb: 2 }}
                />
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: { xs: 'stretch', sm: 'flex-end' }, gap: 2, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
        <Button onClick={onClose} variant="outlined" color="primary" size="small" disabled={loading} sx={{ width: { xs: '100%', sm: 'auto' } }}>Cerrar</Button>
        <Button
          variant="contained"
          color="success"
          size="small"
          onClick={handleRegister}
          disabled={loading || !(form.precio || form.precioBs)}
          startIcon={loading ? <CircularProgress color="inherit" size={18} /> : null}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {loading ? "Registrando..." : "Registrar pago"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
