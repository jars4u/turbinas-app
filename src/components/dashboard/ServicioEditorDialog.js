import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Chip,
  TextField,
  Autocomplete,
  Card,
  CardContent,
  Stack,
  Tooltip,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import EngineeringIcon from "@mui/icons-material/Engineering";
import BuildCircleIcon from "@mui/icons-material/BuildCircle";
import PersonIcon from "@mui/icons-material/Person";
import ConfirmDialog from "../common/ConfirmDialog";

export default function ServicioEditorDialog({
  open,
  isXs,
  onDialogClose,
  actionLoading,
  editId,
  onDeleteClick,
  onClose,
  estadoActual,
  vehiculoActual,
  chipColor,
  onOpenEstadoModal,
  confirmDeleteOpen,
  onCancelDelete,
  onConfirmDelete,
  form,
  onChange,
  editSection,
  setEditSection,
  isRegistering,
  clientes,
  onClienteInputChange,
  onClienteChange,
  onCustomerPhoneChange,
  isEditing,
  onSave,
  onCancelEditSection,
  onRegisterSave,
  onWhatsAppSend,
  onPorCobrar,
  porCobrarDisabled,
  porCobrarTitle,
  onOpenFactura,
  facturarDisabled,
  facturarTitle,
  paymentUSDEnabled,
  paymentUSDMethod,
  onPaymentUSDMethodChange,
  isManualIngreso,
}) {
  // Manejar solo el texto de entrada del Autocomplete para evitar reseteos al actualizar la lista
  const handleClienteInputChange = React.useCallback((event, value, reason) => {
    if (typeof onClienteInputChange === 'function') {
      onClienteInputChange(event, value, reason);
    }
    // Actualizar el nombre solo cuando el usuario escribe o limpia manualmente
    if (typeof onChange === 'function') {
      if (reason === 'input' || reason === 'clear' || reason === 'reset') {
        onChange({ target: { name: 'customerName', value: value || '' } });
      }
    }
  }, [onClienteInputChange, onChange]);

  // Fallback al seleccionar una opción: si no hay handler, actualizar nombre y teléfono básicos
  const handleClienteChange = React.useCallback((event, value) => {
    const valueObj = typeof value === 'string' ? { nombre: value, telefono: '' } : (value || null);
    const nombre = valueObj ? (valueObj.nombre || '') : '';
    const telefonoRaw = valueObj ? (valueObj.telefono || '') : '';
    const telefono = telefonoRaw
      ? (String(telefonoRaw).startsWith('+58') ? telefonoRaw : ('+58' + String(telefonoRaw).replace(/^0+/, '')))
      : '';
    // Notificar al padre si provee handler
    if (typeof onClienteChange === 'function') {
      onClienteChange(event, valueObj);
    }
    // En todos los casos, garantizar que el campo se llene solo con el nombre
    if (typeof onChange === 'function') {
      onChange({ target: { name: 'customerName', value: nombre } });
      if (telefono) {
        onChange({ target: { name: 'customerPhone', value: telefono } });
      }
    }
  }, [onClienteChange, onChange]);

  // Mejorar filtrado (por nombre y teléfono, búsqueda en cualquier posición)
  // Filtrado por prefijo: solo por nombre (acento-insensible)
  const filterOptions = (options, { inputValue }) => {
    const q = normalizeText(inputValue);
    return (options || []).filter((opt) => normalizeText(opt?.nombre).startsWith(q));
  };

  const normalizeText = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Hidratación del texto al re-editar: se controla por inputValue (customerName)
  return (
    <Dialog
      open={open}
      fullScreen={isXs}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      disableScrollLock={false}
      disableEscapeKeyDown={!!actionLoading}
      onClose={(event, reason) => {
        if (actionLoading) return;
        onDialogClose && onDialogClose(event, reason);
      }}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 1 },
          m: { xs: 0, sm: 'auto' },
          bgcolor: "grey.50",
          height: { xs: 'auto', sm: 'auto' },
          display: 'block',
          position: 'relative',
        },
      }}
    >
      {actionLoading && (
        <Box
          aria-busy="true"
          aria-live="polite"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'rgba(255,255,255,0.7)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress color="primary" size={40} />
        </Box>
      )}
      <DialogTitle
        sx={(theme) => ({
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, sm: 2 },
          bgcolor: theme.palette.mode === 'light' ? theme.palette.primary.main : theme.palette.primary.dark,
          color: theme.palette.primary.contrastText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        })}
      >
        <Typography variant={isXs ? "subtitle1" : "h6"} fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {editId ? "Información del servicio" : "Registrar servicio"}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {editId && (
            <>
              <Tooltip title="Eliminar servicio">
                <span>
                  <IconButton onClick={onDeleteClick} color="inherit" size="small" disabled={actionLoading}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title="Cerrar">
            <IconButton aria-label="Cerrar" onClick={onClose} color="inherit" size="small" disabled={actionLoading}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          minWidth: { xs: "auto", sm: 400 },
          maxWidth: { xs: "100vw", sm: "100%" },
          py: { xs: 1, sm: 2 },
          position: "relative",
          display: 'block',
          overflow: 'visible',
          px: { xs: 1, sm: 3 },
        }}
      >
        {/* Overlay global gestionado arriba para bloquear toda la interfaz durante guardado */}

        {editId && (
          <Box sx={{ width: "100%", display: "flex", alignItems: 'center', gap: 1, my: 1 }}>
            <Typography variant="caption" color="text.secondary">Estado:</Typography>
            <Chip
              label={
                (estadoActual && estadoActual.label) ||
                (vehiculoActual && (vehiculoActual.status || vehiculoActual.estado)) ||
                "Sin estado"
              }
              color={chipColor}
              size="small"
              sx={{ fontSize: "0.85rem", height: 26, cursor: "pointer" }}
              onClick={onOpenEstadoModal}
            />
          </Box>
        )}

        <ConfirmDialog
          open={confirmDeleteOpen}
          title="Confirmar eliminación"
          message="¿Estás seguro que deseas eliminar este servicio? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          confirmColor="error"
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      </DialogContent>

      <DialogContent
        sx={{
          minWidth: { xs: "auto", sm: 400 },
          maxWidth: { xs: "100vw", sm: "100%" },
          display: 'block',
          overflow: 'visible',
          px: { xs: 1, sm: 3 },
          py: { xs: 1, sm: 2 },
        }}
      >
        <Stack spacing={{ xs: 1, sm: 2 }}>
          {/* Tarjeta: Datos de la turbina */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EngineeringIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>Datos de la turbina</Typography>
                </Box>
              </Box>
              <TextField
                margin="none"
                label="Modelo"
                name="vehiculo"
                fullWidth
                size="small"
                value={form.vehiculo}
                onChange={onChange}
                sx={{ mb: 0.5 }}
                InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
              />
            </CardContent>
          </Card>

          {/* Tarjeta: Datos del servicio */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildCircleIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>Datos del servicio</Typography>
                </Box>
              </Box>
              <Stack spacing={1.25}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }}>
                  <TextField
                    margin="none"
                    label="Servicio"
                    name="servicio"
                    fullWidth
                    size="small"
                    value={form.servicio}
                    onChange={onChange}
                    InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                    sx={{ flex: 1 }}
                  />
                  {isManualIngreso && (
                    <TextField
                      margin="none"
                      label="N° Factura"
                      name="factura"
                      size="small"
                      value={form.factura || ''}
                      onChange={onChange}
                      InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                      sx={{ flex: 1, minWidth: 160 }}
                    />
                  )}
                </Stack>
                <TextField
                  margin="none"
                  label="Observaciones"
                  name="observaciones"
                  fullWidth
                  size="small"
                  value={form.observaciones}
                  onChange={onChange}
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }}>
                  {paymentUSDEnabled && (
                    <TextField
                      margin="none"
                      label="Forma de pago"
                      name="paymentUSDMethod"
                      select
                      size="small"
                      value={paymentUSDMethod || ''}
                      onChange={(e) => onPaymentUSDMethodChange && onPaymentUSDMethodChange(e.target.value)}
                      SelectProps={{ native: true, displayEmpty: true }}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                      sx={{ flex: 1, minWidth: 120, '& .MuiInputBase-input': { fontSize: '1rem', py: 0.5 } }}
                    >
                      <option value="" disabled hidden>Selecciona una forma</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="pago movil">Pago móvil</option>
                      <option value="zelle">Zelle</option>
                      {/* <option value="transferencia">Transferencia</option>
                      <option value="divisas">Divisas</option>
                      <option value="otro">Otro</option> */}
                    </TextField>
                  )}
                  <TextField
                    margin="none"
                    label="Precio"
                    name="precio"
                    type="number"
                    size="small"
                    value={form.precio}
                    onChange={onChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      sx: { fontSize: '1rem', py: 0.5 },
                    }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    margin="none"
                    label="Precio"
                    name="precioBs"
                    type="number"
                    size="small"
                    value={form.precioBs || ''}
                    onChange={onChange}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">Bs</InputAdornment>,
                      sx: { fontSize: '1rem', py: 0.5 },
                    }}
                    sx={{ flex: 1 }}
                  />
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Tarjeta: Datos del cliente */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700}>Datos del cliente</Typography>
                </Box>
              </Box>
              <>
                <Autocomplete
                  options={clientes || []}
                  getOptionLabel={(opt) => typeof opt === 'string' ? opt : (opt?.nombre ? opt.nombre : "")}
                  inputValue={form.customerName || ""}
                  onInputChange={handleClienteInputChange}
                  onChange={handleClienteChange}
                  filterOptions={filterOptions}
                  freeSolo
                  selectOnFocus
                  blurOnSelect
                  clearOnBlur={false}
                  handleHomeEndKeys
                  sx={{ width: "100%" }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      margin="none"
                      label="Cliente (Nombre)"
                      name="customerName"
                      fullWidth
                      size="small"
                      sx={{ width: "100%" }}
                      InputProps={{
                        ...params.InputProps,
                        sx: { fontSize: "1rem", py: 0.5 },
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2" sx={{ lineHeight: 1.2 }}>{option?.nombre || ''}</Typography>
                        {option?.telefono && (
                          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                            {option.telefono}
                          </Typography>
                        )}
                      </Box>
                    </li>
                  )}
                />
                <TextField
                  margin="none"
                  label="Cliente (Teléfono)"
                  name="customerPhone"
                  fullWidth
                  size="small"
                  value={
                    form.customerPhone
                      ? (form.customerPhone.startsWith("+58")
                        ? form.customerPhone
                        : "+58" + form.customerPhone.replace(/^0+/, ""))
                      : ""
                  }
                  onChange={onCustomerPhoneChange}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                  sx={{ mt: 1.25 }}
                  placeholder="+58-424-xxxxxxx"
                  helperText={
                    form.customerPhone
                      ? (/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))
                        ? "Formato: +58-424-xxxxxxx"
                        : "Debe ser +58 seguido de 10 dígitos (ej: +584246065449)")
                      : ""
                  }
                  error={
                    form.customerPhone
                      ? !/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))
                      : false
                  }
                />
              </>
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "flex-start",
          px: { xs: 2, sm: 2 },
          py: { xs: 1.5, sm: 1.5 },
          mb: 0,
          gap: 1,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          flexWrap: { xs: "nowrap", sm: "nowrap" },
        }}
      >
        {isRegistering ? (
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, width: '100%' }}>
            <Button onClick={onClose} variant="outlined" size="small" color="error" sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={onRegisterSave}
              variant="contained"
              size="small"
              color="primary"
              sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }}
              disabled={actionLoading || !form.vehiculo || !/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))}
            >
              Guardar
            </Button>
          </Box>
        ) : (
          editSection ? (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, width: '100%' }}>
              <Button onClick={onCancelEditSection} variant="outlined" size="small" color="error" sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }} disabled={actionLoading}>
                Cancelar
              </Button>
              {isEditing && (
                <Button
                  onClick={onSave}
                  variant="contained"
                  size="small"
                  color="primary"
                  disabled={
                    actionLoading ||
                    !(form.customerPhone && /^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, "")))
                  }
                  sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }}
                  startIcon={actionLoading ? <CircularProgress color="inherit" size={18} /> : null}
                >
                  {actionLoading ? "Guardando..." : "Guardar"}
                </Button>
              )}
            </Box>
          ) : (
            editId && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                  gap: 1,
                  width: '100%'
                }}
              >
                <Button onClick={onClose} variant="outlined" size="small" color="primary" sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }} disabled={actionLoading}>
                  Cancelar
                </Button>
                {isEditing && (
                  <Button
                    onClick={onSave}
                    variant="contained"
                    size="small"
                    color="primary"
                    disabled={
                      actionLoading ||
                      !(form.customerPhone && /^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, "")))
                    }
                    sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}
                    startIcon={actionLoading ? <CircularProgress color="inherit" size={18} /> : null}
                  >
                    {actionLoading ? "Guardando..." : "Guardar"}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  color="success"
                  endIcon={<WhatsAppIcon />}
                  onClick={onWhatsAppSend}
                  disabled={actionLoading || !form.customerPhone}
                  sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}
                >
                  Enviar
                </Button>
                <Button
                  variant="contained"
                  color="warning"
                  size="small"
                  sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}
                  onClick={onPorCobrar}
                  disabled={actionLoading || porCobrarDisabled}
                  title={porCobrarTitle}
                >
                  Por Cobrar
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={<PointOfSaleIcon />}
                  sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}
                  onClick={onOpenFactura}
                  disabled={actionLoading || facturarDisabled}
                  title={facturarTitle}
                >
                  Facturar
                </Button>
              </Box>
            )
          )
        )}
      </DialogActions>
    </Dialog>
  );
}
