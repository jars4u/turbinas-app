import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

import {
  Container,
  Typography,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  TextField,
  Chip,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { guardarTasaBCV, obtenerTasaBCV } from "../lib/tasaBCVFirebase";

import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import CajaChica from "../components/CajaChica";
import Ingresos from "../components/Ingresos";
import Egresos from "../components/Egresos";
import CuentasPorPagar from "../components/CuentasPorPagar";
import CuentasPorCobrar from "../components/CuentasPorCobrar";

import ResumenContable from "../components/ResumenContable";
import ServicioEditorDialog from "../components/dashboard/ServicioEditorDialog";
import { obtenerClientes } from "../lib/clientesFirebase";
import { guardarIngreso } from "../lib/ingresosFirebase";
import { useMediaQuery } from "@mui/material";
import { guardarCierreDiario } from "../lib/cierresDiariosFirebase";

import { obtenerVehiculos } from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import AccesoDenegado from "./AccesoDenegado";

export default function CierreDia() {
  const { isAdmin, isOwner } = useAuth();
  const navigate = useNavigate();
  const [vehiculos, setVehiculos] = useState([]);
  const [estadosServicio, setEstadosServicio] = useState([]);
  const [cierreGuardado, setCierreGuardado] = useState(false);
  // Estado para pestañas
  const [tabIndex, setTabIndex] = useState(0);
  // --- Estado para la tasa BCV ---
  const [tasaBCV, setTasaBCV] = useState(null);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [mostrarInputTasa, setMostrarInputTasa] = useState(false);
  const [tasaManual, setTasaManual] = useState("");
  // Estado para ingresos manuales vía ServicioEditorDialog
  const isXs = useMediaQuery('(max-width:600px)');
  const [ingresoDialogOpen, setIngresoDialogOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const INGRESO_FORM_DEFAULT = {
    vehiculo: "",
    servicio: "",
    observaciones: "Ingreso manual",
    precio: "",
    precioBs: "",
    customerName: "",
    customerPhone: "+580000000000",
    factura: "",
    paymentUSDMethod: "efectivo",
  };
  const [ingresoForm, setIngresoForm] = useState(INGRESO_FORM_DEFAULT);
  const [ingresosKey, setIngresosKey] = useState(0);

  useEffect(() => {
    obtenerVehiculos().then(setVehiculos);
    obtenerEstadosServicio().then(setEstadosServicio);
    fetchTasaBCV();
    obtenerClientes().then(setClientes).catch(() => setClientes([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar cierre automáticamente al final del día
  useEffect(() => {
    async function guardarCierreAutomatico() {
      if (!(isAdmin || isOwner)) return; // Solo admin/owner pueden guardar
      if (vehiculos.length === 0 || estadosServicio.length === 0 || !tasaBCV || cierreGuardado) return;
      // Calcular totales
      const hoy = new Date();
      const fechaStr = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
      const totalIngresosUSD = vehiculos.reduce((acc, v) => acc + (v.precio || 0), 0);
      const totalIngresosBs = totalIngresosUSD * tasaBCV;
      // Egresos: si tienes una fuente, cámbiala aquí
      const totalEgresosUSD = 0;
      const totalEgresosBs = 0;
      const utilidadUSD = totalIngresosUSD - totalEgresosUSD;
      const utilidadBs = utilidadUSD * tasaBCV;
      try {
        await guardarCierreDiario({
          fecha: fechaStr,
          tasa: tasaBCV,
          totalIngresosUSD,
          totalIngresosBs,
          totalEgresosUSD,
          totalEgresosBs,
          utilidadUSD,
          utilidadBs,
          observaciones: "Cierre automático",
        });
        setCierreGuardado(true);
      } catch (err) {
        // Puedes mostrar un error si lo deseas
      }
    }
    // Ejecutar solo si es el final del día (por ejemplo, después de las 23:59)
    const ahora = new Date();
    if (ahora.getHours() === 23 && ahora.getMinutes() >= 55) {
      guardarCierreAutomatico();
    }
  }, [vehiculos, estadosServicio, tasaBCV, cierreGuardado, isAdmin, isOwner]);

  // --- Función para obtener la tasa del BCV ---
  const fetchTasaBCV = useCallback(async () => {
    setLoadingTasa(true);
    setMostrarInputTasa(false);
    try {
      // Primer intento: pydolarve.org
      const response = await fetch(
        "https://pydolarve.org/api/v1/dollar?page=bcv&monitor=usd"
      );
      const data = await response.json();
      if (data && data.price) {
        setTasaBCV(data.price);
        if (isAdmin || isOwner) {
          guardarTasaBCV(data.price); // Guardar en Firestore solo admin/owner
        }
        if (!sessionStorage.getItem("tasaBCVManual")) {
          sessionStorage.removeItem("tasaBCVManual");
        }
      } else {
        throw new Error("No se obtuvo tasa del primer servicio");
      }
    } catch (error) {
      // Segundo intento: ve.dolarapi.com
      try {
        const resp2 = await fetch("https://ve.dolarapi.com/v1/dolares");
        const json2 = await resp2.json();
        const oficialObj = Array.isArray(json2)
          ? json2.find((d) => d.fuente === "oficial")
          : null;
        if (oficialObj && oficialObj.promedio) {
          setTasaBCV(oficialObj.promedio);
          if (isAdmin || isOwner) {
            guardarTasaBCV(oficialObj.promedio); // Guardar en Firestore solo admin/owner
          }
          if (!sessionStorage.getItem("tasaBCVManual")) {
            sessionStorage.removeItem("tasaBCVManual");
          }
        } else {
          // Si no hay tasa, buscar en Firestore
          const stored = sessionStorage.getItem("tasaBCVManual");
          if (stored) {
            setTasaBCV(parseFloat(stored));
            setMostrarInputTasa(false);
          } else {
            const tasaBD = await obtenerTasaBCV();
            if (tasaBD) {
              setTasaBCV(tasaBD);
              setMostrarInputTasa(false);
            } else {
              setTasaBCV(null);
              setMostrarInputTasa(true);
            }
          }
        }
      } catch (error2) {
        // Si falla todo, buscar en Firestore
        const stored = sessionStorage.getItem("tasaBCVManual");
        if (stored) {
          setTasaBCV(parseFloat(stored));
          setMostrarInputTasa(false);
        } else {
          const tasaBD = await obtenerTasaBCV();
          if (tasaBD) {
            setTasaBCV(tasaBD);
            setMostrarInputTasa(false);
          } else {
            setTasaBCV(null);
            setMostrarInputTasa(true);
          }
        }
      }
    }
    setLoadingTasa(false);
  }, [isAdmin, isOwner]);

  // Calcular totales por estado sincronizado
  const totalesPorEstado = estadosServicio
    .map((estado) => {
      const total = vehiculos
        .filter((v) => v.status === estado.nombre)
        .reduce((acc, v) => acc + (v.precio || 0), 0);
      return { ...estado, total };
    })
    .filter((estado) => estado.nombre !== "entregado");

  if (!isAdmin && !isOwner) {
    return <AccesoDenegado />;
  }
  return (
  <>
  <Container maxWidth="xl" sx={{ mt: 4, px: { xs: 1, md: 6 } }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate("/dashboard")}
      >
        Atrás
      </Button>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <PointOfSaleIcon fontSize="small" />
        <Typography variant="h5" fontWeight={600}>
          Cierre del día
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 3,
          alignItems: { xs: 'stretch', md: 'flex-start' },
          width: '100%',
        }}
      >
        {/* 1/3: Tasa BCV */}
        <Box
          sx={{
            flex: { xs: "1 1 100%", md: "1 1 20%" },
            minWidth: 0,
            maxWidth: { md: "27%" },
            width: { md: "27%" },
          }}
        >
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
              <CircularProgress size={24} />
            ) : mostrarInputTasa ? (
              <Box>
                <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                  No se pudo obtener la tasa automáticamente. Ingresa el valor
                  manualmente:
                </Typography>
                <TextField
                  label="Tasa BCV manual"
                  type="number"
                  value={tasaManual}
                  onChange={(e) =>
                    setTasaManual(e.target.value.replace(/[^0-9.]/g, ""))
                  }
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
                  disabled={!tasaManual || !(isAdmin || isOwner)}
                  onClick={async () => {
                    setTasaBCV(parseFloat(tasaManual));
                    sessionStorage.setItem("tasaBCVManual", tasaManual);
                    setMostrarInputTasa(false);
                    if (isAdmin || isOwner) {
                      await guardarTasaBCV(parseFloat(tasaManual)); // Guardar manual en Firestore
                    }
                  }}
                >
                  Usar tasa
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h5" color="primary.main">
                  Bs.{" "}
                  {tasaBCV
                    ? tasaBCV.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "No disponible"}
                </Typography>
                {sessionStorage.getItem("tasaBCVManual") &&
                  tasaBCV ===
                    parseFloat(sessionStorage.getItem("tasaBCVManual")) && (
                    <Typography
                      variant="caption"
                      color="warning.main"
                      sx={{ display: "block", mt: 1 }}
                    >
                      Usando tasa BCV manual ingresada por el usuario durante
                      esta sesión.
                    </Typography>
                  )}
              </>
            )}
            <Typography variant="caption" color="text.secondary">
              Fuente: Banco Central de Venezuela (BCV)
            </Typography>
          </Box>
          {/* Responsive: Accordion en móviles, tabla normal en desktop */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={600}>Totales por estado</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Table
                  size="small"
                  sx={{
                    mb: 2,
                    minWidth: 360,
                    width: '100%',
                    overflowX: 'auto',
                    '& .MuiTableCell-root': { fontSize: { xs: '0.80rem' } },
                    '& .MuiChip-label': { fontSize: { xs: '0.75rem' } },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Estado</TableCell>
                      <TableCell align="right">Total $</TableCell>
                      <TableCell align="right">Total Bs</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {totalesPorEstado.map((estado) => (
                      <TableRow key={estado.nombre}>
                        <TableCell>
                          <Chip
                            label={estado.label}
                            size="small"
                            sx={{
                              fontWeight: 500,
                              fontSize: { xs: '0.75rem', md: '0.95rem' },
                              height: { xs: 22, md: 24 },
                              bgcolor: estado.color === "gris" ? "grey.500" : undefined,
                              color: estado.color === "gris" ? "#fff" : undefined,
                            }}
                            {...(['default','primary','secondary','error','info','success','warning'].includes(estado.color)
                              ? { color: estado.color }
                              : {})}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {typeof estado.total === 'number' && !isNaN(estado.total)
                            ? estado.total.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </TableCell>
                        <TableCell align="right">
                          {tasaBCV && typeof estado.total === 'number' && !isNaN(estado.total)
                            ? (estado.total * tasaBCV).toLocaleString("de-DE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Fila de total */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {(() => {
                          const total = totalesPorEstado.reduce((acc, estado) => acc + (typeof estado.total === 'number' && !isNaN(estado.total) ? estado.total : 0), 0);
                          return typeof total === 'number' && !isNaN(total)
                            ? total.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-";
                        })()}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {(() => {
                          if (!tasaBCV) return "-";
                          const totalBs = totalesPorEstado.reduce((acc, estado) => acc + (typeof estado.total === 'number' && !isNaN(estado.total) ? estado.total * tasaBCV : 0), 0);
                          return typeof totalBs === 'number' && !isNaN(totalBs)
                            ? totalBs.toLocaleString("de-DE", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-";
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  El total de entregados corresponde al monto cobrado hoy y se reflejará en los egresos. El total
                  en proceso y notificado muestra los montos aún no cobrados.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table component={Paper} size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Total $</TableCell>
                  <TableCell align="right">Total Bs</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {totalesPorEstado.map((estado) => (
                  <TableRow key={estado.nombre}>
                    <TableCell>
                      <Chip
                        label={estado.label}
                        size="small"
                        sx={{
                          fontWeight: 500,
                          fontSize: "0.95rem",
                          height: 24,
                          bgcolor: estado.color === "gris" ? "grey.500" : undefined,
                          color: estado.color === "gris" ? "#fff" : undefined,
                        }}
                        {...(['default','primary','secondary','error','info','success','warning'].includes(estado.color)
                          ? { color: estado.color }
                          : {})}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {estado.total.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell align="right">
                      {tasaBCV
                        ? (estado.total * tasaBCV).toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Fila de total */}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {totalesPorEstado
                      .reduce((acc, estado) => acc + estado.total, 0)
                      .toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {tasaBCV
                      ? totalesPorEstado
                          .reduce(
                            (acc, estado) => acc + estado.total * tasaBCV,
                            0
                          )
                          .toLocaleString("de-DE", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                      : "-"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              El total de entregados corresponde al monto cobrado hoy y se reflejará en los egresos. El total
              en proceso y notificado muestra los montos aún no cobrados.
            </Typography>
          </Box>
        </Box>

        {/* 2/3: Tabla y resumen */}
        <Box
          sx={{
            flex: { xs: "1 1 100%", md: "2 1 80%" },
            minWidth: 0,
            maxWidth: { md: "73%" },
            width: { md: "73%" },
          }}
        >
          {/* Pestañas: Resumen, Ingresos, Egresos, Caja Chica */}
          <Box sx={{ width: "100%" }}>
            <Tabs
              value={tabIndex}
              onChange={(e, newValue) => setTabIndex(newValue)}
              indicatorColor="primary"
              textColor="primary"
              variant={typeof window !== 'undefined' && window.innerWidth < 600 ? 'scrollable' : 'fullWidth'}
              scrollButtons={typeof window !== 'undefined' && window.innerWidth < 600 ? 'auto' : false}
              allowScrollButtonsMobile
              sx={{ mb: 2, minWidth: 0, maxWidth: '100%' }}
            >
              <Tab label="Resumen" />
              <Tab label="Ingresos" />
              <Tab label="Egresos" />
              <Tab label="Caja Chica" />
              <Tab label="Por Pagar" />
              <Tab label="Por Cobrar" />
            </Tabs>
            {tabIndex === 0 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: 120,
                    }}
                  >
                    <CircularProgress color="primary" size={40} />
                  </Box>
                ) : (
                  <ResumenContable tasaBCV={tasaBCV} />
                )}
              </Box>
            )}
            {tabIndex === 5 && (
              <Box sx={{ p: 2 }}>
                <CuentasPorCobrar />
              </Box>
            )}
            {tabIndex === 1 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa || !vehiculos.length ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: 120,
                    }}
                  >
                    <CircularProgress color="primary" size={40} />
                  </Box>
                ) : (
                  <Ingresos
                    key={ingresosKey}
                    tasaBCV={tasaBCV}
                    onOpenRegistrarIngreso={() => {
                      setIngresoForm(INGRESO_FORM_DEFAULT);
                      setIngresoDialogOpen(true);
                    }}
                  />
                )}
              </Box>
            )}
            {tabIndex === 2 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa || !vehiculos.length ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: 120,
                    }}
                  >
                    <CircularProgress color="primary" size={40} />
                  </Box>
                ) : (
                  <Egresos tasaBCV={tasaBCV} isOwner={isOwner} />
                )}
              </Box>
            )}
            {tabIndex === 3 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa || !vehiculos.length ? (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      minHeight: 120,
                    }}
                  >
                    <CircularProgress color="primary" size={40} />
                  </Box>
                ) : (
                  <CajaChica tasaBCV={tasaBCV} isOwner={isOwner} />
                )}
              </Box>
            )}
            {tabIndex === 4 && (
              <Box sx={{ p: 2 }}>
                {/* Aquí se implementa el componente CuentasPorPagar */}
                <CuentasPorPagar cuentas={[]} />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </Container>
    <IngresoDialogHost
      open={ingresoDialogOpen}
      isXs={isXs}
      loading={false}
      form={ingresoForm}
      setForm={setIngresoForm}
      clientes={clientes}
      onClose={() => { setIngresoDialogOpen(false); setIngresoForm(INGRESO_FORM_DEFAULT); }}
      onSaved={() => { setIngresoDialogOpen(false); setIngresoForm(INGRESO_FORM_DEFAULT); setIngresosKey((prev) => prev + 1); }}
      paymentUSDEnabled={true}
      paymentUSDMethod={ingresoForm.paymentUSDMethod}
      onPaymentUSDMethodChange={(val) => setIngresoForm((prev) => ({ ...prev, paymentUSDMethod: val }))}
    />
  </>
  );
}

// Handlers del diálogo de ingreso manual
function mapIngresoFromForm(form) {
  const formasPago = [];
  const metodo = (form.paymentUSDMethod || 'efectivo').toString().trim().toLowerCase();
  const montoUSD = form.precio !== undefined && form.precio !== null && form.precio !== "" ? Number(form.precio) : undefined;
  const montoBs = form.precioBs !== undefined && form.precioBs !== null && form.precioBs !== "" ? Number(form.precioBs) : undefined;
  if (metodo === 'pago movil') {
    const montoParaBs = (montoBs && !isNaN(montoBs) && montoBs > 0) ? montoBs : (montoUSD && !isNaN(montoUSD) && montoUSD > 0 ? montoUSD : undefined);
    if (montoParaBs !== undefined) {
      formasPago.push({ formaPago: 'pago movil', montoBs: Number(montoParaBs) });
    }
  } else {
    if (montoUSD && !isNaN(montoUSD) && montoUSD > 0) {
      formasPago.push({ formaPago: metodo, monto: Number(montoUSD) });
    }
  }
  const hoy = new Date();
  const fechaStr = `${String(hoy.getDate()).padStart(2, "0")}/${String(hoy.getMonth() + 1).padStart(2, "0")}/${hoy.getFullYear()}`;
  // Construir payload con los campos del ServicioEditorDialog
  const payloadRaw = {
    fecha: fechaStr,
    vehiculo: form.vehiculo || undefined,
    servicio: form.servicio || undefined,
    observaciones: form.observaciones || undefined,
    factura: form.factura || undefined,
    customerName: form.customerName || undefined,
    customerPhone: form.customerPhone || undefined,
    formasPago: formasPago.length > 0 ? formasPago : undefined,
  };
  return Object.fromEntries(Object.entries(payloadRaw).filter(([_, v]) => v !== undefined && v !== null));
}

// Render del diálogo dentro del componente (usar estado de CierreDia)
// Nota: Colocamos el diálogo tras el componente principal para mantener estructura
export function IngresoDialogHost({
  open,
  isXs,
  loading,
  form,
  setForm,
  clientes,
  onClose,
  onSaved,
  paymentUSDEnabled,
  paymentUSDMethod,
  onPaymentUSDMethodChange,
}) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleClienteInput = (_e, value) => {
    setForm((prev) => ({ ...prev, customerName: value }));
  };
  const handleClienteChange = (_e, opt) => {
    if (!opt) return;
    setForm((prev) => ({ ...prev, customerName: opt.nombre || prev.customerName, customerPhone: opt.telefono ? (opt.telefono.startsWith('+58') ? opt.telefono : '+58' + opt.telefono.replace(/^0+/, '')) : prev.customerPhone }));
  };
  const handlePhoneChange = (e) => {
    const val = e.target.value || '';
    setForm((prev) => ({ ...prev, customerPhone: val }));
  };
  const handleRegisterSave = async () => {
    try {
      // Validación de número de teléfono como en el diálogo original
      const phoneRaw = (form.customerPhone || '').replace(/[-\s]/g, "");
      if (!/^\+58\d{10}$/.test(phoneRaw)) {
        return; // No guardar si el teléfono no cumple el formato
      }
      const payload = mapIngresoFromForm(form);
      await guardarIngreso(payload);
      onSaved?.();
    } catch (e) {
      // Silenciar o notificar según necesidad
    }
  };
  return (
    <ServicioEditorDialog
      open={open}
      isXs={isXs}
      onDialogClose={onClose}
      actionLoading={loading}
      onClose={onClose}
      form={form}
      onChange={handleChange}
      isRegistering={true}
      clientes={clientes}
      onClienteInputChange={handleClienteInput}
      onClienteChange={handleClienteChange}
      onCustomerPhoneChange={handlePhoneChange}
      onRegisterSave={handleRegisterSave}
      paymentUSDEnabled={paymentUSDEnabled}
      paymentUSDMethod={paymentUSDMethod}
      onPaymentUSDMethodChange={onPaymentUSDMethodChange}
      isManualIngreso={true}
    />
  );
}

