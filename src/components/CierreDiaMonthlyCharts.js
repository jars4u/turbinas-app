import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import {
  Box,
  Divider,
  Paper,
  TextField,
  Typography,
  useTheme,
  Skeleton,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

import { obtenerIngresos } from "../lib/ingresosFirebase";
import { obtenerEgresos } from "../lib/egresosFirebase";
import useFactorConversion from "../hooks/useFactorConversion";
import { esMetodoBs, nombreMetodo, normalizarMetodo } from "../lib/metodosPago";

dayjs.locale("es");

const CHART_COLORS = {
  green: "#2E7D32",
  orange: "#FB8C00",
  blue: "#1E88E5",
  purple: "#8E24AA",
  cyan: "#00ACC1",
  grey: "#757575",
};

function isValidNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function pickPositive(...candidates) {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function usdFormatter(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Etiqueta a mostrar en los gráficos: usa el nombre configurado en
// Configuración > Formas de pago para que los métodos nuevos aparezcan igual.
function normalizeMetodo(raw) {
  const clave = normalizarMetodo(raw);
  if (!clave) return "otros";
  return nombreMetodo(clave);
}

function normalizeMetodoKey(name) {
  return normalizarMetodo(name);
}

// Color estable para métodos sin color fijo en la paleta
function colorPorHash(key) {
  const paleta = [
    CHART_COLORS.blue,
    CHART_COLORS.purple,
    CHART_COLORS.cyan,
    CHART_COLORS.orange,
    CHART_COLORS.green,
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 9973;
  return paleta[hash % paleta.length];
}

function getMetodoColor(name, theme) {
  const key = normalizeMetodoKey(name);
  // Paleta fija para evitar confusiones y mantener consistencia visual
  // (incluye naranja como color distintivo)
  if (key === "efectivo") return CHART_COLORS.green;
  if (key === "pago movil") return CHART_COLORS.orange;
  if (key === "transferencia") return CHART_COLORS.blue;
  if (key === "zelle") return CHART_COLORS.purple;
  if (key === "punto" || key === "punto de venta") return CHART_COLORS.cyan;
  if (key === "otros" || !key) return theme.palette.grey?.[600] || CHART_COLORS.grey;
  return colorPorHash(key);
}

function getIngresoUSD(mov, { factorConversionGlobal, tasaBCV }) {
  const formasPago = Array.isArray(mov?.formasPago) ? mov.formasPago : [];
  let totalUSD = 0;
  let bsSinTasa = 0;

  if (formasPago.length === 0) {
    const fallback = pickPositive(mov?.precio, mov?.montoUSD, mov?.monto, mov?.total, mov?.usdEquiv);
    return {
      totalUSD: fallback ? Number(fallback) : 0,
      bsSinTasa: 0,
      byMetodo: {},
    };
  }

  const byMetodo = {};

  for (const fp of formasPago) {
    const metodo = normalizeMetodo(fp?.formaPago);

    // Métodos en divisa: el monto ya viene en USD
    if (!esMetodoBs(fp?.formaPago)) {
      const usd = pickPositive(fp?.monto, fp?.montoUSD, fp?.usdEquiv) || 0;
      totalUSD += usd;
      byMetodo[metodo] = (byMetodo[metodo] || 0) + usd;
      continue;
    }

    // Métodos en bolívares: convertir a USD
    const usdEquiv = pickPositive(fp?.usdEquiv);
    if (usdEquiv) {
      totalUSD += usdEquiv;
      byMetodo[metodo] = (byMetodo[metodo] || 0) + usdEquiv;
      continue;
    }

    const montoBs = pickPositive(fp?.montoBs, fp?.monto) || 0;
    const factor = pickPositive(fp?.factorConversion, factorConversionGlobal, tasaBCV);

    if (montoBs > 0 && factor) {
      const usd = montoBs / factor;
      totalUSD += usd;
      byMetodo[metodo] = (byMetodo[metodo] || 0) + usd;
    } else if (montoBs > 0) {
      bsSinTasa += montoBs;
    }
  }

  return { totalUSD, bsSinTasa, byMetodo };
}

function getEgresoUSD(egreso, { tasaBCV }) {
  const montoUSD = pickPositive(egreso?.montoUSD) || 0;
  const montoBs = pickPositive(egreso?.montoBs) || 0;

  let totalUSD = montoUSD;
  let bsSinTasa = 0;

  if (montoBs > 0) {
    const tasa = pickPositive(egreso?.tasaFactura, tasaBCV);
    if (tasa) totalUSD += montoBs / tasa;
    else bsSinTasa += montoBs;
  }

  // Fallback: factura con items
  if (!montoUSD && !montoBs && Array.isArray(egreso?.items) && egreso.items.length > 0) {
    const totalItems = egreso.items.reduce((acc, it) => {
      const totalItem = isValidNumber(it?.totalItem)
        ? it.totalItem
        : isValidNumber(it?.cantidad) && isValidNumber(it?.precioUnitario)
          ? it.cantidad * it.precioUnitario
          : 0;
      return acc + (Number.isFinite(totalItem) ? totalItem : 0);
    }, 0);

    if ((egreso?.monedaFactura || "USD") === "Bs") {
      const tasa = pickPositive(egreso?.tasaFactura, tasaBCV);
      if (tasa) totalUSD += totalItems / tasa;
      else bsSinTasa += totalItems;
    } else {
      totalUSD += totalItems;
    }
  }

  return { totalUSD, bsSinTasa };
}

function getDateFromFirestore(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  if (typeof fecha?.toDate === "function") return fecha.toDate();
  if (typeof fecha?.seconds === "number") return new Date(fecha.seconds * 1000);
  return null;
}

export default function CierreDiaMonthlyCharts({ tasaBCV }) {
  const theme = useTheme();

  const [mesSeleccionado, setMesSeleccionado] = useState(dayjs());
  const [loading, setLoading] = useState(true);

  const [ingresosAll, setIngresosAll] = useState([]);
  const [egresosAll, setEgresosAll] = useState([]);
  // Factor vigente según la configuración (manual, BCV dólar o BCV euro)
  const { factor: factorConversion } = useFactorConversion();

  useEffect(() => {
    let mounted = true;

    async function cargar() {
      setLoading(true);
      try {
        const [ing, egr] = await Promise.all([
          obtenerIngresos(),
          obtenerEgresos(),
        ]);
        if (!mounted) return;
        setIngresosAll(Array.isArray(ing) ? ing : []);
        setEgresosAll(Array.isArray(egr) ? egr : []);
      } catch (e) {
        if (!mounted) return;
        setIngresosAll([]);
        setEgresosAll([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    cargar();
    return () => {
      mounted = false;
    };
  }, []);

  const monthRange = useMemo(() => {
    const start = mesSeleccionado.startOf("month");
    const end = mesSeleccionado.endOf("month");
    return { start, end };
  }, [mesSeleccionado]);

  const {
    serieDiaria,
    totalIngresosUSD,
    totalEgresosUSD,
    totalNetoUSD,
    bsSinTasaTotal,
    pieMetodos,
    topServicios,
  } = useMemo(() => {
    const start = monthRange.start;
    const end = monthRange.end;

    const ingresosMes = ingresosAll.filter((i) => {
      const d = i?.fechaRaw instanceof Date ? i.fechaRaw : null;
      if (!d) return false;
      const ms = d.getTime();
      return ms >= start.valueOf() && ms <= end.valueOf();
    });

    const egresosMes = egresosAll.filter((e) => {
      const d = getDateFromFirestore(e?.fecha);
      if (!d) return false;
      const ms = d.getTime();
      return ms >= start.valueOf() && ms <= end.valueOf();
    });

    const daysInMonth = start.daysInMonth();

    const ingresosByDay = new Map();
    const egresosByDay = new Map();

    let ingresosTotal = 0;
    let egresosTotal = 0;
    let bsSinTasa = 0;

    const metodos = {};
    const servicios = {};

    for (const mov of ingresosMes) {
      const d = mov?.fechaRaw;
      const day = d instanceof Date ? d.getDate() : null;
      if (!day) continue;

      const { totalUSD, bsSinTasa: bsNo, byMetodo } = getIngresoUSD(mov, {
        factorConversionGlobal: factorConversion,
        tasaBCV,
      });

      ingresosTotal += totalUSD;
      bsSinTasa += bsNo;

      ingresosByDay.set(day, (ingresosByDay.get(day) || 0) + totalUSD);

      Object.entries(byMetodo).forEach(([k, v]) => {
        metodos[k] = (metodos[k] || 0) + (toNumber(v) || 0);
      });

      const servicio = (mov?.servicio || mov?.descripcion || "Sin servicio").toString().trim() || "Sin servicio";
      servicios[servicio] = (servicios[servicio] || 0) + totalUSD;
    }

    for (const eg of egresosMes) {
      const d = getDateFromFirestore(eg?.fecha);
      const day = d instanceof Date ? d.getDate() : null;
      if (!day) continue;

      const { totalUSD, bsSinTasa: bsNo } = getEgresoUSD(eg, { tasaBCV });
      egresosTotal += totalUSD;
      bsSinTasa += bsNo;

      egresosByDay.set(day, (egresosByDay.get(day) || 0) + totalUSD);
    }

    const serie = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      // Excluir fines de semana (0=domingo, 6=sábado)
      const dow = start.date(day).day();
      if (dow === 0 || dow === 6) continue;

      const ingresos = ingresosByDay.get(day) || 0;
      const egresos = egresosByDay.get(day) || 0;
      serie.push({
        dia: String(day).padStart(2, "0"),
        ingresos,
        egresos,
        neto: ingresos - egresos,
      });
    }

    const pie = Object.entries(metodos)
      .map(([name, value]) => ({ name, value }))
      .filter((x) => isValidNumber(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value);

    // Top servicios, compacto para panel izquierdo
    const top = Object.entries(servicios)
      .map(([name, value]) => ({ name, value }))
      .filter((x) => isValidNumber(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .reverse();

    return {
      serieDiaria: serie,
      totalIngresosUSD: ingresosTotal,
      totalEgresosUSD: egresosTotal,
      totalNetoUSD: ingresosTotal - egresosTotal,
      bsSinTasaTotal: bsSinTasa,
      pieMetodos: pie,
      topServicios: top,
    };
  }, [egresosAll, factorConversion, ingresosAll, monthRange, tasaBCV]);

  const palette = useMemo(() => {
    return [
      CHART_COLORS.green,
      CHART_COLORS.orange,
      CHART_COLORS.blue,
      CHART_COLORS.purple,
      CHART_COLORS.cyan,
      CHART_COLORS.grey,
    ];
  }, []);

  const hasData = useMemo(() => {
    return (
      (isValidNumber(totalIngresosUSD) && totalIngresosUSD > 0) ||
      (isValidNumber(totalEgresosUSD) && totalEgresosUSD > 0)
    );
  }, [totalEgresosUSD, totalIngresosUSD]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper" }}
      >
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Gráficas mensuales (USD)
        </Typography>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Mes"
            views={["year", "month"]}
            value={mesSeleccionado}
            onChange={(v) => v && setMesSeleccionado(v)}
            disableFuture
            renderInput={(params) => (
              <TextField {...params} size="small" fullWidth />
            )}
          />
        </LocalizationProvider>

        <Box sx={{ mt: 1, display: "flex", justifyContent: "space-between", alignItems: 'center' }}>
          {loading ? (
            <>
              <Skeleton variant="text" width={120} height={16} />
              <Skeleton variant="text" width={120} height={16} />
            </>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                Ingresos: {usdFormatter(totalIngresosUSD)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Egresos: {usdFormatter(totalEgresosUSD)}
              </Typography>
            </>
          )}
        </Box>
        {loading ? (
          <Skeleton variant="text" width={140} height={16} />
        ) : (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: totalNetoUSD >= 0 ? "success.main" : "error.main",
            }}
          >
            Neto: {usdFormatter(totalNetoUSD)}
          </Typography>
        )}

        {bsSinTasaTotal > 0 && !tasaBCV && (
          <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
            Hay montos en Bs sin tasa para convertir: {bsSinTasaTotal.toLocaleString("de-DE")} Bs.
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        {loading ? (
          <Box sx={{ display: "flex", flexDirection: 'column', gap: 2 }}>
            {/* 1) Serie diaria skeleton */}
            <Box>
              <Skeleton variant="text" width={200} height={16} sx={{ mb: 0.5 }} />
              <Skeleton variant="rounded" width="100%" height={210} />
            </Box>
            {/* 2) Métodos de cobro skeleton */}
            <Box>
              <Skeleton variant="text" width={220} height={16} sx={{ mb: 0.5 }} />
              <Skeleton variant="rounded" width="100%" height={220} />
            </Box>
            {/* 3) Top servicios skeleton */}
            <Box>
              <Skeleton variant="text" width={240} height={16} sx={{ mb: 0.5 }} />
              <Skeleton variant="rounded" width="100%" height={180} />
            </Box>
          </Box>
        ) : !hasData ? (
          <Typography variant="body2" color="text.secondary">
            No hay movimientos para este mes.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* 1) Serie diaria */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Ingresos vs Egresos (por día)
              </Typography>
              <Box sx={{ width: "100%", height: 210 }}>
                <ResponsiveContainer>
                  <ComposedChart data={serieDiaria} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                    <Tooltip formatter={(v) => usdFormatter(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar name="Ingresos" dataKey="ingresos" fill={CHART_COLORS.green} radius={[6, 6, 0, 0]} />
                    <Bar name="Egresos" dataKey="egresos" fill={CHART_COLORS.purple} radius={[6, 6, 0, 0]} />
                    <Line name="Neto" type="monotone" dataKey="neto" stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            {/* 2) Métodos de cobro */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Métodos de cobro (USD)
              </Typography>
              <Box sx={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip formatter={(v) => usdFormatter(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Pie
                      data={pieMetodos}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {pieMetodos.map((entry, idx) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={getMetodoColor(entry.name, theme) || palette[idx % palette.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Box>

            {/* 3) Top servicios */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Top 3 servicios por ingresos (USD)
              </Typography>
              <Box sx={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <BarChart
                    data={topServicios}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    barSize={16}
                    barCategoryGap={24}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(v) => usdFormatter(v)} />
                    <Bar dataKey="value" name="Ingresos" fill={CHART_COLORS.orange}>
                      <LabelList
                        dataKey="value"
                        position="insideRight"
                        formatter={(v) => `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
                        style={{ fontSize: 11, fill: '#FFFFFF', fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
        Todo se muestra en USD. Los pagos y egresos en Bs se convierten a USD usando
        factor de conversión (cuando existe) y/o la tasa BCV.
      </Typography>
    </Box>
  );
}
