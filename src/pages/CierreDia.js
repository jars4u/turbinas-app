import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import React, { Suspense, lazy, useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";

import {
  Container,
  Typography,
  Box,
  Divider,
  Button,
  Skeleton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { guardarTasaBCV, guardarTasaEURBCV } from "../lib/tasaBCVFirebase";
import { obtenerTasasBCV } from "../lib/tasasBCV";
import TasaBCV from "../components/TasaBCV";

import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import ServicioEditorDialog from "../components/dashboard/ServicioEditorDialog";
import { obtenerClientes } from "../lib/clientesFirebase";
import { guardarIngreso } from "../lib/ingresosFirebase";
import { esMetodoBs, normalizarMetodo } from "../lib/metodosPago";
import { useMediaQuery } from "@mui/material";
import { guardarCierreDiario } from "../lib/cierresDiariosFirebase";

import { obtenerVehiculos } from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import AccesoDenegado from "./AccesoDenegado";

// Solo se muestra una pestaña a la vez: cada una se descarga al abrirla.
// Los gráficos (recharts) también van en su propio chunk.
const CajaChica = lazy(() => import("../components/CajaChica"));
const Ingresos = lazy(() => import("../components/Ingresos"));
const Egresos = lazy(() => import("../components/Egresos"));
const GastosDia = lazy(() => import("../components/GastosDia"));
const CuentasPorPagar = lazy(() => import("../components/CuentasPorPagar"));
const CuentasPorCobrar = lazy(() => import("../components/CuentasPorCobrar"));
const CierreDiaMonthlyCharts = lazy(() => import("../components/CierreDiaMonthlyCharts"));
const ResumenContable = lazy(() => import("../components/ResumenContable"));

const SkeletonSeccion = (
  <Box>
    <Skeleton variant="text" width={200} height={20} sx={{ mb: 1 }} />
    <Skeleton variant="rounded" width="100%" height={180} />
  </Box>
);

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
  const [tasaEUR, setTasaEUR] = useState(null);
  const [loadingTasa, setLoadingTasa] = useState(false);
  const [mostrarInputTasa, setMostrarInputTasa] = useState(false);
  const [tasaManual, setTasaManual] = useState("");
  const [tasaEURManual, setTasaEURManual] = useState("");
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

  // Contenido reutilizable para Tasa BCV + Gráficas
  const MonitoreoContent = (
    <>
      <TasaBCV
        tasaBCV={tasaBCV}
        tasaEUR={tasaEUR}
        loadingTasa={loadingTasa}
        mostrarInputTasa={mostrarInputTasa}
        tasaManual={tasaManual}
        setTasaManual={setTasaManual}
        tasaEURManual={tasaEURManual}
        setTasaEURManual={setTasaEURManual}
        setTasaBCV={setTasaBCV}
        setTasaEUR={setTasaEUR}
        setMostrarInputTasa={setMostrarInputTasa}
        puedeGuardar={isAdmin || isOwner}
        guardarTasaBCV={guardarTasaBCV}
        guardarTasaEURBCV={guardarTasaEURBCV}
      />
      <Suspense fallback={SkeletonSeccion}>
        <CierreDiaMonthlyCharts tasaBCV={tasaBCV} />
      </Suspense>
    </>
  );

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

  // --- Tasas del BCV (dólar y euro) ---
  const fetchTasaBCV = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setLoadingTasa(true);
      setMostrarInputTasa(false);
    }

    // Consulta el BCV y, si falla, recurre a lo último guardado en Firestore
    const tasas = await obtenerTasasBCV({ forzar: silencioso });
    const enVivo = tasas.fuente === "bcv";
    const puedeGuardar = isAdmin || isOwner;

    // Dólar: tasa en vivo > tasa manual de la sesión > respaldo guardado
    const usdManual = parseFloat(sessionStorage.getItem("tasaBCVManual"));
    if (enVivo && tasas.usd) {
      setTasaBCV(tasas.usd);
      if (puedeGuardar) guardarTasaBCV(tasas.usd);
    } else if (usdManual > 0) {
      setTasaBCV(usdManual);
    } else if (tasas.usd) {
      setTasaBCV(tasas.usd);
    } else if (!silencioso) {
      setTasaBCV(null);
      setMostrarInputTasa(true);
    }

    // Euro: mismo orden de preferencia
    const eurManual = parseFloat(sessionStorage.getItem("tasaEURManual"));
    if (enVivo && tasas.eur) {
      setTasaEUR(tasas.eur);
      if (puedeGuardar) guardarTasaEURBCV(tasas.eur);
    } else if (eurManual > 0) {
      setTasaEUR(eurManual);
    } else {
      setTasaEUR(tasas.eur || null);
    }

    if (!silencioso) setLoadingTasa(false);
  }, [isAdmin, isOwner]);

  // Mantener las tasas al día mientras la pantalla está abierta
  useEffect(() => {
    const REFRESCO_MS = 5 * 60 * 1000;
    const refrescar = () => fetchTasaBCV(true);
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    const intervalo = setInterval(refrescar, REFRESCO_MS);
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [fetchTasaBCV]);

  if (!isAdmin && !isOwner) {
    return <AccesoDenegado />;
  }
  return (
    <Layout>
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
        {/* 1/3: Monitoreo de datos (móvil: acordeón, desktop: sin cambios) */}
        <Box
          sx={{
            flex: { xs: "1 1 100%", md: "1 1 20%" },
            minWidth: 0,
            maxWidth: { md: "27%" },
            width: { md: "27%" },
          }}
        >
          {isXs ? (
            <Accordion sx={{ my: 1 }} TransitionProps={{ unmountOnExit: true }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" fontWeight={600}>Monitoreo de datos</Typography>
              </AccordionSummary>
              <AccordionDetails>
                {MonitoreoContent}
              </AccordionDetails>
            </Accordion>
          ) : (
            MonitoreoContent
          )}
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
              <Tab label="Gastos del día" />
              <Tab label="Caja Chica" />
              <Tab label="Por Pagar" />
              <Tab label="Por Cobrar" />
            </Tabs>
            <Suspense fallback={<Box sx={{ p: 2 }}>{SkeletonSeccion}</Box>}>
            {tabIndex === 0 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa ? (
                  <Box>
                    <Skeleton variant="text" width={200} height={20} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" width="100%" height={160} />
                  </Box>
                ) : (
                  <ResumenContable tasaBCV={tasaBCV} />
                )}
              </Box>
            )}
            {tabIndex === 6 && (
              <Box sx={{ p: 2 }}>
                <CuentasPorCobrar />
              </Box>
            )}
            {tabIndex === 1 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa || !vehiculos.length ? (
                  <Box>
                    <Skeleton variant="text" width={220} height={20} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" width="100%" height={180} />
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
                  <Box>
                    <Skeleton variant="text" width={200} height={20} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" width="100%" height={180} />
                  </Box>
                ) : (
                  <Egresos tasaBCV={tasaBCV} isOwner={isOwner} />
                )}
              </Box>
            )}
            {tabIndex === 3 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa || !vehiculos.length ? (
                  <Box>
                    <Skeleton variant="text" width={200} height={20} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" width="100%" height={180} />
                  </Box>
                ) : (
                  <GastosDia tasaBCV={tasaBCV} isOwner={isOwner} />
                )}
              </Box>
            )}
            {tabIndex === 4 && (
              <Box sx={{ p: 2 }}>
                {loadingTasa || !vehiculos.length ? (
                  <Box>
                    <Skeleton variant="text" width={200} height={20} sx={{ mb: 1 }} />
                    <Skeleton variant="rounded" width="100%" height={180} />
                  </Box>
                ) : (
                  <CajaChica tasaBCV={tasaBCV} isOwner={isOwner} />
                )}
              </Box>
            )}
            {tabIndex === 5 && (
              <Box sx={{ p: 2 }}>
                {/* Aquí se implementa el componente CuentasPorPagar */}
                <CuentasPorPagar cuentas={[]} />
              </Box>
            )}
            </Suspense>
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
    </Layout>
  );
}

// Handlers del diálogo de ingreso manual
function mapIngresoFromForm(form) {
  const formasPago = [];
  const metodo = normalizarMetodo(form.paymentUSDMethod) || 'efectivo';
  const montoUSD = form.precio !== undefined && form.precio !== null && form.precio !== "" ? Number(form.precio) : undefined;
  const montoBs = form.precioBs !== undefined && form.precioBs !== null && form.precioBs !== "" ? Number(form.precioBs) : undefined;
  if (esMetodoBs(metodo)) {
    const montoParaBs = (montoBs && !isNaN(montoBs) && montoBs > 0) ? montoBs : (montoUSD && !isNaN(montoUSD) && montoUSD > 0 ? montoUSD : undefined);
    if (montoParaBs !== undefined) {
      formasPago.push({ formaPago: metodo, montoBs: Number(montoParaBs) });
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

