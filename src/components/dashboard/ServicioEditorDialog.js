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
import ClienteAutocompleteField from "../common/ClienteAutocompleteField";

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
  const isServicioCerrado = !!editId && !!estadoActual?.defaultFacturar;
  const disableEdicion = !!actionLoading || isServicioCerrado;
  const disableEstadoChange = !!actionLoading;
  const isCompactMobile = isXs;

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
          height: { xs: '100dvh', sm: 'auto' },
          maxHeight: { xs: '100dvh', sm: 'none' },
          display: { xs: 'flex', sm: 'block' },
          flexDirection: { xs: 'column', sm: 'unset' },
          overflow: { xs: 'hidden', sm: 'visible' },
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
          px: { xs: 1.25, sm: 3 },
          py: { xs: 1, sm: 2 },
          bgcolor: theme.palette.mode === 'light' ? theme.palette.primary.main : theme.palette.primary.dark,
          color: theme.palette.primary.contrastText,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        })}
      >
        <Typography variant={isCompactMobile ? "body1" : "h6"} fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1, lineHeight: 1.2 }}>
          {editId ? "Información del servicio" : "Registrar servicio"}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {editId && (
            <>
              <Tooltip title="Eliminar servicio">
                <span>
                  <IconButton onClick={onDeleteClick} color="inherit" size="small" disabled={disableEdicion} sx={{ p: { xs: 0.5, sm: 1 } }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title="Cerrar">
            <IconButton aria-label="Cerrar" onClick={onClose} color="inherit" size="small" disabled={actionLoading} sx={{ p: { xs: 0.5, sm: 1 } }}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          minWidth: { xs: "auto", sm: 400 },
          maxWidth: { xs: "100vw", sm: "100%" },
          py: { xs: 0.5, sm: 2 },
          position: "relative",
          display: 'block',
          overflow: 'visible',
          px: { xs: 1, sm: 3 },
          flexShrink: 0,
        }}
      >
        {/* Overlay global gestionado arriba para bloquear toda la interfaz durante guardado */}

        {editId && (
          <Box sx={{ width: "100%", display: "flex", alignItems: 'center', gap: 0.75, my: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">Estado:</Typography>
            <Chip
              label={
                (estadoActual && estadoActual.label) ||
                (vehiculoActual && (vehiculoActual.status || vehiculoActual.estado)) ||
                "Sin estado"
              }
              color={chipColor}
              size="small"
              sx={{ fontSize: { xs: "0.74rem", sm: "0.85rem" }, height: { xs: 22, sm: 26 }, cursor: disableEstadoChange ? "default" : "pointer" }}
              onClick={disableEstadoChange ? undefined : onOpenEstadoModal}
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
          px: { xs: 0.75, sm: 3 },
          py: { xs: 0.5, sm: 2 },
          flex: { xs: '1 1 auto', sm: '0 0 auto' },
          '& .MuiCard-root': {
            borderRadius: { xs: 1.25, sm: 2 },
          },
          '& .MuiCardContent-root': {
            p: { xs: 0.875, sm: 2 },
            '&:last-child': {
              pb: { xs: 0.875, sm: 2 },
            },
          },
          '& .MuiTextField-root .MuiInputBase-root': {
            minHeight: { xs: 38, sm: 'auto' },
          },
          '& .MuiTextField-root .MuiInputBase-input': {
            fontSize: { xs: '0.92rem', sm: '1rem' },
            py: { xs: 0.35, sm: 0.5 },
          },
          '& .MuiInputAdornment-root': {
            fontSize: { xs: '0.82rem', sm: 'inherit' },
          },
          '& .MuiFormHelperText-root': {
            mt: { xs: 0.25, sm: 0.375 },
            fontSize: { xs: '0.68rem', sm: '0.75rem' },
            lineHeight: 1.15,
          },
        }}
      >
        <Stack spacing={{ xs: 0.75, sm: 2 }}>
          {/* Tarjeta: Datos de la turbina */}
          <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'visible' }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 }, overflow: 'visible' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.5, sm: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EngineeringIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: { xs: '0.84rem', sm: '0.875rem' } }}>Datos de la turbina</Typography>
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
                disabled={disableEdicion}
                sx={{ mb: 0.5 }}
                InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
              />
            </CardContent>
          </Card>

          {/* Tarjeta: Datos del servicio */}
          <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.5, sm: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BuildCircleIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: { xs: '0.84rem', sm: '0.875rem' } }}>Datos del servicio</Typography>
                </Box>
              </Box>
              <Stack spacing={{ xs: 0.75, sm: 1.25 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.75, sm: 2 }}>
                  <TextField
                    margin="none"
                    label="Servicio"
                    name="servicio"
                    fullWidth
                    size="small"
                    value={form.servicio}
                    onChange={onChange}
                    disabled={disableEdicion}
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
                      disabled={disableEdicion}
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
                  disabled={disableEdicion}
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.75, sm: 2 }}>
                  {paymentUSDEnabled && (
                    <TextField
                      margin="none"
                      label="Forma de pago"
                      name="paymentUSDMethod"
                      select
                      size="small"
                      value={paymentUSDMethod || ''}
                      onChange={(e) => onPaymentUSDMethodChange && onPaymentUSDMethodChange(e.target.value)}
                      disabled={disableEdicion}
                      SelectProps={{ native: true, displayEmpty: true }}
                      InputLabelProps={{ shrink: true }}
                      InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                      sx={{ flex: 1, minWidth: 120, '& .MuiInputBase-input': { fontSize: '1rem', py: 0.5 } }}
                    >
                      <option value="" disabled hidden>Selecciona una forma</option>
                      <option value="efectivo">Efectivo</option>
                      <option value="binance">Binance ($)</option>
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
                    disabled={disableEdicion}
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
                    disabled={disableEdicion}
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 0.5, sm: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: { xs: '0.84rem', sm: '0.875rem' } }}>Datos del cliente</Typography>
                </Box>
              </Box>
              <>
                <ClienteAutocompleteField
                  clientes={clientes}
                  nombre={form.customerName || ""}
                  telefono={form.customerPhone || ""}
                  disabled={disableEdicion}
                  compact={isCompactMobile}
                  onNombreChange={(value, meta) => {
                    if (typeof onClienteInputChange === 'function') {
                      onClienteInputChange(meta?.event || null, value, meta?.reason || 'input');
                    } else if (typeof onChange === 'function') {
                      onChange({ target: { name: 'customerName', value } });
                    }
                  }}
                  onTelefonoChange={(value, meta) => {
                    if (typeof onCustomerPhoneChange === 'function') {
                      onCustomerPhoneChange({ target: { value } }, meta?.reason);
                    } else if (typeof onChange === 'function') {
                      onChange({ target: { name: 'customerPhone', value } });
                    }
                  }}
                  onClienteSelect={(cliente, meta) => {
                    if (typeof onClienteChange === 'function') {
                      onClienteChange(meta?.event || null, cliente);
                    } else if (typeof onChange === 'function' && cliente?.nombre) {
                      onChange({ target: { name: 'customerName', value: cliente.nombre || '' } });
                    }
                    if (typeof onClienteChange !== 'function' && typeof onChange === 'function' && cliente?.telefono) {
                      const phone = String(cliente.telefono || '');
                      const normalized = phone.startsWith('+58') ? phone : '+58' + phone.replace(/^0+/, '');
                      onChange({ target: { name: 'customerPhone', value: normalized } });
                    }
                  }}
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
          px: { xs: 1, sm: 2 },
          py: { xs: 0.75, sm: 1.5 },
          mb: 0,
          gap: { xs: 0.75, sm: 1 },
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          flexWrap: { xs: "nowrap", sm: "nowrap" },
          flexShrink: 0,
          '& .MuiButton-root': {
            minHeight: { xs: 34, sm: 36 },
            fontSize: { xs: '0.74rem', sm: '0.8125rem' },
            px: { xs: 1, sm: 1.5 },
            lineHeight: 1.15,
          },
        }}
      >
        {isRegistering ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 0.75, sm: 1 }, width: '100%' }}>
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
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 0.75, sm: 1 }, width: '100%' }}>
              <Button onClick={onCancelEditSection} variant="outlined" size="small" color="error" sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }} disabled={actionLoading}>
                Cancelar
              </Button>
              {isEditing && (() => {
                const canSave = !disableEdicion;
                return (
                  <Button
                    onClick={onSave}
                    variant="contained"
                    size="small"
                    color="primary"
                    disabled={!canSave}
                    sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }}
                    startIcon={actionLoading ? <CircularProgress color="inherit" size={18} /> : null}
                  >
                    {actionLoading ? "Guardando..." : "Guardar"}
                  </Button>
                );
              })()}
            </Box>
          ) : (
            editId && (
              <Box
                sx={{
                  display: { xs: 'grid', sm: 'flex' },
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
                  flexDirection: 'row',
                  flexWrap: { xs: 'nowrap', sm: 'nowrap' },
                  gap: { xs: 0.75, sm: 1 },
                  width: '100%'
                }}
              >
                <Button onClick={onClose} variant="outlined" size="small" color="primary" sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }} disabled={actionLoading}>
                  Cancelar
                </Button>
                {isEditing && (() => {
                  const canSave = !disableEdicion;
                  return (
                    <Button
                      onClick={onSave}
                      variant="contained"
                      size="small"
                      color="primary"
                      disabled={!canSave}
                      sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}
                      startIcon={actionLoading ? <CircularProgress color="inherit" size={18} /> : null}
                    >
                      {actionLoading ? "Guardando..." : "Guardar"}
                    </Button>
                  );
                })()}
                <Button
                  variant="outlined"
                  size="small"
                  color="success"
                  endIcon={isCompactMobile ? null : <WhatsAppIcon />}
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
                  disabled={disableEdicion || porCobrarDisabled}
                  title={porCobrarTitle}
                >
                  {isCompactMobile ? "Cobrar" : "Por Cobrar"}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  size="small"
                  startIcon={isCompactMobile ? null : <PointOfSaleIcon />}
                  sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}
                  onClick={onOpenFactura}
                  disabled={disableEdicion || facturarDisabled}
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
