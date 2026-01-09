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
}) {
  return (
    <Dialog
      open={open}
      fullScreen={isXs}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      disableScrollLock={false}
      onClose={onDialogClose}
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 1 },
          m: { xs: 0, sm: 'auto' },
          bgcolor: "grey.50",
          height: { xs: 'auto', sm: 'auto' },
          display: 'block',
        },
      }}
    >
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
                  <IconButton onClick={onDeleteClick} color="inherit" size="small">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title="Cerrar">
            <IconButton aria-label="Cerrar" onClick={onClose} color="inherit" size="small">
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
        {actionLoading && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              bgcolor: "rgba(255,255,255,0.7)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress color="primary" size={40} />
          </Box>
        )}

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
                <TextField
                  margin="none"
                  label="Servicio"
                  name="servicio"
                  fullWidth
                  size="small"
                  value={form.servicio}
                  onChange={onChange}
                  InputProps={{ sx: { fontSize: '1rem', py: 0.5 } }}
                />
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
                  options={clientes}
                  getOptionLabel={(opt) => opt.nombre + (opt.telefono ? ` (${opt.telefono})` : "")}
                  value={null}
                  inputValue={form.customerName}
                  onInputChange={onClienteInputChange}
                  onChange={onClienteChange}
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
                />
                <TextField
                  margin="none"
                  label="Cliente (Teléfono)"
                  name="customerPhone"
                  fullWidth
                  size="small"
                  value={
                    form.customerPhone.startsWith("+58")
                      ? form.customerPhone
                      : "+58" + form.customerPhone.replace(/^0+/, "")
                  }
                  onChange={onCustomerPhoneChange}
                  InputProps={{ sx: { fontSize: "1rem", py: 0.5 } }}
                  sx={{ mt: 1.25 }}
                  placeholder= "+58-424-xxxxxxx"
                  helperText={
                    /^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))
                      ? "Formato: +58-424-xxxxxxx"
                      : "Debe ser +58 seguido de 10 dígitos (ej: +584246065449)"
                  }
                  error={!/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))}
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
            <Button onClick={onClose} variant="outlined" size="small" color="error" sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }}>
              Cancelar
            </Button>
            <Button
              onClick={onRegisterSave}
              variant="contained"
              size="small"
              color="primary"
              sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }}
              disabled={!form.vehiculo || !/^\+58\d{10}$/.test(form.customerPhone.replace(/[-\s]/g, ""))}
            >
              Guardar
            </Button>
          </Box>
        ) : (
          editSection ? (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1, width: '100%' }}>
              <Button onClick={onCancelEditSection} variant="outlined" size="small" color="error" sx={{ flex: 1, minWidth: 120, justifyContent: 'center' }}>
                Cancelar
              </Button>
              {isEditing && (
                <Button
                  onClick={onSave}
                  variant="contained"
                  size="small"
                  color="primary"
                  disabled={actionLoading}
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
                <Button onClick={onClose} variant="outlined" size="small" color="primary" sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: 1 }, minWidth: 110, justifyContent: 'center' }}>
                  Cancelar
                </Button>
                {isEditing && (
                  <Button
                    onClick={onSave}
                    variant="contained"
                    size="small"
                    color="primary"
                    disabled={actionLoading}
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
                  disabled={!form.customerPhone}
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
                  disabled={porCobrarDisabled}
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
                  disabled={facturarDisabled}
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
