import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "../components/Layout";
import AccesoDenegado from "./AccesoDenegado";
import { obtenerIngresos } from "../lib/ingresosFirebase";
import { obtenerEgresos } from "../lib/egresosFirebase";
import { obtenerNominas } from "../lib/obtenerNominasFirebase";
import { obtenerVehiculos } from "../lib/vehiculosFirebase";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import useFactorConversion from "../hooks/useFactorConversion";
import { factorParaEstimacion } from "../lib/finanzas";
import AvisoCompletitud, { lineasCompletitud, textoEstimaciones, textoProrrateos } from "../components/AvisoCompletitud";
import {
  buildReportData,
  exportReportToExcel,
  formatDisplayDate,
  formatLocalYMD,
  getDateRangeFromPreset,
  REPORT_PRESETS,
} from "../lib/reportesUtils";

const COLORS = {
  ingresos: "#2e7d32",
  egresos: "#7b1fa2",
  nomina: "#ef6c00",
  servicios: "#1565c0",
};

function formatUsd(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBs(value) {
  return `Bs ${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatUsdBsBreakdown(usdValue, bsValue) {
  return `USD: ${formatUsd(usdValue)} | Bs: ${formatBs(bsValue)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Aviso de totales parciales en el PDF: mismos textos que en pantalla
function buildPdfCompletitud(completitud) {
  const lineas = lineasCompletitud(completitud);
  const estimaciones = textoEstimaciones(completitud);
  const prorrateos = textoProrrateos(completitud);
  if (!completitud || (completitud.completo && !estimaciones && !prorrateos)) return "";
  const items = lineas
    .map((l) => `<li style="margin-bottom:4px;"><strong>${escapeHtml(l.titulo)}:</strong> ${escapeHtml(l.texto)}</li>`)
    .join("");
  return `
      <div style="background:#fff8e1;border:1px solid #f0c36d;border-radius:18px;padding:14px 18px;margin-top:18px;font-size:13px;color:#5d4200;line-height:1.5;">
        ${completitud.completo ? "" : `<div style="font-weight:700;margin-bottom:6px;">Totales parciales: no reconciliados. Incluyen solo los registros contabilizables. Queda fuera:</div><ul style="margin:0;padding-left:20px;">${items}</ul>`}
        ${estimaciones ? `<div style="margin-top:6px;">${escapeHtml(estimaciones)}</div>` : ""}
        ${prorrateos ? `<div style="margin-top:6px;">${escapeHtml(prorrateos)}</div>` : ""}
      </div>`;
}

function getGranularityLabel(granularity) {
  if (granularity === "day") return "Diaria";
  if (granularity === "week") return "Semanal";
  return "Mensual";
}

function buildServiciosTrendSeries(series = []) {
  if (!Array.isArray(series) || series.length === 0) return [];
  if (series.length === 1) {
    return series.map((item) => ({
      ...item,
      serviciosTrend: item.serviciosEntregados,
    }));
  }

  const totalPoints = series.length;
  const sumX = series.reduce((acc, _, index) => acc + index, 0);
  const sumY = series.reduce((acc, item) => acc + Number(item.serviciosEntregados || 0), 0);
  const sumXY = series.reduce(
    (acc, item, index) => acc + index * Number(item.serviciosEntregados || 0),
    0
  );
  const sumXX = series.reduce((acc, _, index) => acc + index * index, 0);
  const denominator = totalPoints * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (totalPoints * sumXY - sumX * sumY) / denominator;
  const intercept = totalPoints === 0 ? 0 : (sumY - slope * sumX) / totalPoints;

  return series.map((item, index) => ({
    ...item,
    serviciosTrend: Math.max(0, slope * index + intercept),
  }));
}

function buildPdfChartSvg(series = []) {
  const chartSeries = buildServiciosTrendSeries(series);
  if (!Array.isArray(chartSeries) || chartSeries.length === 0) {
    return `
      <div style="height:320px;border:1px dashed #d6d3d1;border-radius:20px;display:flex;align-items:center;justify-content:center;color:#6b7280;background:#faf8f4;">
        Sin datos suficientes para generar la gráfica del periodo.
      </div>`;
  }

  const width = 1000;
  const height = 320;
  const marginTop = 20;
  const marginRight = 70;
  const marginBottom = 54;
  const marginLeft = 70;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const usdMax = Math.max(
    1,
    ...chartSeries.flatMap((item) => [
      Number(item.ingresosUSD || 0),
      Number(item.egresosUSD || 0),
      Number(item.nominaUSD || 0),
    ])
  );
  const countMax = Math.max(
    1,
    ...chartSeries.flatMap((item) => [
      Number(item.serviciosEntregados || 0),
      Number(item.serviciosTrend || 0),
    ])
  );
  const baselineY = marginTop + plotHeight;
  const groupWidth = plotWidth / chartSeries.length;
  const barWidth = Math.min(18, groupWidth * 0.18);
  const yTicks = 4;

  const getCountY = (value) => baselineY - (Number(value || 0) / countMax) * plotHeight;

  const gridLines = Array.from({ length: yTicks + 1 }, (_, index) => {
    const ratio = index / yTicks;
    const y = marginTop + plotHeight - ratio * plotHeight;
    const usdValue = (usdMax * ratio).toFixed(0);
    const countValue = (countMax * ratio).toFixed(0);
    return `
      <line x1="${marginLeft}" y1="${y}" x2="${width - marginRight}" y2="${y}" stroke="#e7e5e4" stroke-width="1" />
      <text x="${marginLeft - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="#78716c">$${usdValue}</text>
      <text x="${width - marginRight + 10}" y="${y + 4}" font-size="11" fill="#78716c">${countValue}</text>`;
  }).join("");

  const bars = chartSeries.map((item, index) => {
    const groupStart = marginLeft + index * groupWidth;
    const centerX = groupStart + groupWidth / 2;
    const ingresosHeight = (Number(item.ingresosUSD || 0) / usdMax) * plotHeight;
    const egresosHeight = (Number(item.egresosUSD || 0) / usdMax) * plotHeight;
    const nominaHeight = (Number(item.nominaUSD || 0) / usdMax) * plotHeight;
    const ingresosX = centerX - barWidth * 1.7;
    const egresosX = centerX - barWidth * 0.5;
    const nominaX = centerX + barWidth * 0.7;
    const label = escapeHtml(item.label);

    return `
      <rect x="${ingresosX}" y="${baselineY - ingresosHeight}" width="${barWidth}" height="${ingresosHeight}" rx="4" fill="${COLORS.ingresos}" opacity="0.88" />
      <rect x="${egresosX}" y="${baselineY - egresosHeight}" width="${barWidth}" height="${egresosHeight}" rx="4" fill="${COLORS.egresos}" opacity="0.88" />
      <rect x="${nominaX}" y="${baselineY - nominaHeight}" width="${barWidth}" height="${nominaHeight}" rx="4" fill="${COLORS.nomina}" opacity="0.88" />
      <text x="${centerX}" y="${baselineY + 18}" text-anchor="middle" font-size="10" fill="#57534e">${label}</text>`;
  }).join("");

  const serviciosPoints = chartSeries.map((item, index) => {
    const x = marginLeft + index * groupWidth + groupWidth / 2;
    const y = getCountY(item.serviciosEntregados);
    return `${x},${y}`;
  }).join(" ");

  const trendPoints = chartSeries.map((item, index) => {
    const x = marginLeft + index * groupWidth + groupWidth / 2;
    const y = getCountY(item.serviciosTrend);
    return `${x},${y}`;
  }).join(" ");

  const serviciosDots = chartSeries.map((item, index) => {
    const x = marginLeft + index * groupWidth + groupWidth / 2;
    const y = getCountY(item.serviciosEntregados);
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="${COLORS.servicios}" />`;
  }).join("");

  return `
    <div style="background:#fff;border:1px solid #e3ddd2;border-radius:24px;padding:22px 22px 18px;margin-top:18px;box-shadow:0 12px 30px rgba(15,43,70,0.05);">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:12px;">
        <div>
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:8px;">Gráfica del periodo</div>
          <div style="font-size:24px;font-weight:700;color:#17324a;line-height:1.2;">Ingresos, egresos, nómina y servicios</div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;">
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#57534e;"><span style="width:10px;height:10px;border-radius:3px;background:${COLORS.ingresos};display:inline-block;"></span>Ingresos</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#57534e;"><span style="width:10px;height:10px;border-radius:3px;background:${COLORS.egresos};display:inline-block;"></span>Egresos</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#57534e;"><span style="width:10px;height:10px;border-radius:3px;background:${COLORS.nomina};display:inline-block;"></span>Nómina</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#57534e;"><span style="width:18px;height:0;border-top:3px solid ${COLORS.servicios};display:inline-block;"></span>Servicios</span>
          <span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#57534e;"><span style="width:18px;height:0;border-top:3px dashed #0f2b46;display:inline-block;"></span>Tendencia</span>
        </div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Gráfica de comportamiento del periodo">
        <rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="#fcfbf8" />
        ${gridLines}
        <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${baselineY}" stroke="#a8a29e" stroke-width="1.2" />
        <line x1="${width - marginRight}" y1="${marginTop}" x2="${width - marginRight}" y2="${baselineY}" stroke="#a8a29e" stroke-width="1.2" />
        <line x1="${marginLeft}" y1="${baselineY}" x2="${width - marginRight}" y2="${baselineY}" stroke="#a8a29e" stroke-width="1.2" />
        ${bars}
        <polyline fill="none" stroke="${COLORS.servicios}" stroke-width="3" points="${serviciosPoints}" stroke-linecap="round" stroke-linejoin="round" />
        <polyline fill="none" stroke="#0f2b46" stroke-width="2.5" stroke-dasharray="8 6" points="${trendPoints}" stroke-linecap="round" stroke-linejoin="round" />
        ${serviciosDots}
      </svg>
    </div>`;
}

async function waitForImages(container) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }
          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );
}

function SummaryCard({ title, value, subtitle, parcial = false }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minHeight: 126 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {title}
        {parcial && (
          <Typography component="span" variant="caption" color="warning.main" sx={{ ml: 1, fontWeight: 600 }}>
            · parcial
          </Typography>
        )}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1, mb: 1 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    </Paper>
  );
}

function buildPdfMarkup({ reportData, fontFamily, generatedAt }) {
  const ingresosBreakdown = formatUsdBsBreakdown(reportData?.summary?.ingresosUSDDirect, reportData?.summary?.ingresosBs);
  const egresosBreakdown = formatUsdBsBreakdown(reportData?.summary?.egresosUSDDirect, reportData?.summary?.egresosBs);
  const netoBreakdown = formatUsdBsBreakdown(reportData?.summary?.netoUSDDirect, reportData?.summary?.netoBs);
  const chartSection = buildPdfChartSvg(reportData?.series || []);
  const rows = (reportData?.series || [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${formatUsd(item.ingresosUSD)}</td>
          <td>${formatBs(item.ingresosBs)}</td>
          <td>${formatUsd(item.egresosUSD)}</td>
          <td>${formatBs(item.egresosBs)}</td>
          <td>${item.serviciosEntregados}</td>
          <td>${formatUsd(item.nominaUSD)}</td>
          <td>${formatUsd(item.netoUSD)}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="width:1120px;background:#f6f1e8;padding:40px 36px 32px;font-family:${fontFamily};color:#1f2937;box-sizing:border-box;">
      <div style="background:linear-gradient(135deg,#0f2b46 0%,#1f5f8b 55%,#2e7d32 100%);border-radius:28px;padding:28px 30px;color:#fff;position:relative;overflow:hidden;">
        <div style="position:absolute;right:-40px;top:-30px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;position:relative;z-index:1;">
          <div style="display:flex;align-items:center;gap:16px;">
            <div>
              <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.82;margin-bottom:8px;">Turbinas MCBO</div>
              <div style="font-size:34px;line-height:1.08;font-weight:700;margin-bottom:8px;">Reporte ejecutivo</div>
              <div style="font-size:15px;opacity:0.9;max-width:520px;">Resumen financiero y operativo del periodo seleccionado, con montos en USD consolidados desde los movimientos registrados.</div>
            </div>
          </div>
          <div style="min-width:250px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:20px;padding:16px 18px;backdrop-filter:blur(8px);">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.16em;opacity:0.75;margin-bottom:8px;">Resumen del documento</div>
            <div style="font-size:14px;margin-bottom:8px;"><strong>Rango:</strong> ${escapeHtml(reportData?.range?.label || "-")}</div>
            <div style="font-size:14px;margin-bottom:8px;"><strong>Agrupación:</strong> ${getGranularityLabel(reportData?.granularity)}</div>
            <div style="font-size:14px;"><strong>Generado:</strong> ${escapeHtml(formatDisplayDate(generatedAt))}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-top:22px;">
        <div style="background:#fff;border:1px solid #e3ddd2;border-radius:22px;padding:18px 18px 16px;box-shadow:0 10px 30px rgba(15,43,70,0.06);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:10px;">Servicios entregados</div>
          <div style="font-size:26px;font-weight:700;color:#17324a;line-height:1.1;">${reportData?.summary?.serviciosEntregados || 0}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5;">Vehículos entregados en el periodo</div>
        </div>
        <div style="background:#fff;border:1px solid #e3ddd2;border-radius:22px;padding:18px 18px 16px;box-shadow:0 10px 30px rgba(15,43,70,0.06);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:10px;">Ingresos</div>
          <div style="font-size:26px;font-weight:700;color:#17324a;line-height:1.1;">${formatUsd(reportData?.summary?.ingresosUSD)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5;">${ingresosBreakdown}</div>
        </div>
        <div style="background:#fff;border:1px solid #e3ddd2;border-radius:22px;padding:18px 18px 16px;box-shadow:0 10px 30px rgba(15,43,70,0.06);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:10px;">Egresos</div>
          <div style="font-size:26px;font-weight:700;color:#17324a;line-height:1.1;">${formatUsd(reportData?.summary?.egresosUSD)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5;">${egresosBreakdown}</div>
        </div>
        <div style="background:#fff;border:1px solid #e3ddd2;border-radius:22px;padding:18px 18px 16px;box-shadow:0 10px 30px rgba(15,43,70,0.06);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:10px;">Nómina</div>
          <div style="font-size:26px;font-weight:700;color:#17324a;line-height:1.1;">${formatUsd(reportData?.summary?.nominaUSD)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5;">Nóminas dentro del rango</div>
        </div>
        <div style="background:#fff;border:1px solid #e3ddd2;border-radius:22px;padding:18px 18px 16px;box-shadow:0 10px 30px rgba(15,43,70,0.06);">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:10px;">Neto</div>
          <div style="font-size:26px;font-weight:700;color:#17324a;line-height:1.1;">${formatUsd(reportData?.summary?.netoUSD)}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:8px;line-height:1.5;">${netoBreakdown}</div>
        </div>
      </div>

      ${buildPdfCompletitud(reportData?.summary?.completitud)}

      ${chartSection}

      <div style="background:#fff;border:1px solid #e3ddd2;border-radius:24px;padding:22px 22px 16px;margin-top:18px;box-shadow:0 12px 30px rgba(15,43,70,0.05);">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;">
          <div>
            <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#5f6b77;margin-bottom:8px;">Detalle agrupado</div>
            <div style="font-size:24px;font-weight:700;color:#17324a;line-height:1.2;">Comportamiento del periodo</div>
          </div>
          <div style="font-size:13px;color:#6b7280;">${reportData?.series?.length || 0} ${reportData?.series?.length === 1 ? "periodo" : "periodos"}</div>
        </div>
        <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:12px;overflow:hidden;border-radius:16px;border:1px solid #ebe4d7;">
          <thead>
            <tr>
              <th style="background:#f5efe5;padding:12px 14px;text-align:left;color:#4b5563;font-weight:700;">Periodo</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Ingresos USD</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Ingresos Bs</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Egresos USD</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Egresos Bs</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Servicios</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Nómina USD</th>
              <th style="background:#f5efe5;padding:12px 14px;text-align:right;color:#4b5563;font-weight:700;">Neto USD</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

export default function Reportes({ isAdmin = false, isOwner = false }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const initialRange = useMemo(() => getDateRangeFromPreset("month"), []);
  const [presetKey, setPresetKey] = useState("month");
  const [fechaInicio, setFechaInicio] = useState(formatLocalYMD(initialRange.start));
  const [fechaFin, setFechaFin] = useState(formatLocalYMD(initialRange.end));
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [nominas, setNominas] = useState([]);
  const [estadosServicio, setEstadosServicio] = useState([]);
  // Factor manual actual: solo para estimar pagos en Bs sin conversión registrada
  const { detalle: detalleFactor } = useFactorConversion();
  const factorActual = factorParaEstimacion(detalleFactor);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [ingresosData, egresosData, vehiculosData, nominasData, estadosData] = await Promise.all([
          obtenerIngresos(),
          obtenerEgresos(),
          obtenerVehiculos(),
          obtenerNominas(),
          obtenerEstadosServicio(),
        ]);

        if (!mounted) return;
        setIngresos(Array.isArray(ingresosData) ? ingresosData : []);
        setEgresos(Array.isArray(egresosData) ? egresosData : []);
        setVehiculos(Array.isArray(vehiculosData) ? vehiculosData : []);
        setNominas(Array.isArray(nominasData) ? nominasData : []);
        setEstadosServicio(Array.isArray(estadosData) ? estadosData : []);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || "No se pudo cargar la información del reporte.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const reportData = useMemo(
    () =>
      buildReportData({
        ingresos,
        egresos,
        vehiculos,
        nominas,
        estadosServicio,
        factorActual,
        fechaInicio,
        fechaFin,
        presetKey,
      }),
    [egresos, estadosServicio, factorActual, fechaFin, fechaInicio, ingresos, nominas, presetKey, vehiculos]
  );

  const ingresosSubtitle = formatUsdBsBreakdown(
    reportData.summary.ingresosUSDDirect,
    reportData.summary.ingresosBs
  );
  const egresosSubtitle = formatUsdBsBreakdown(
    reportData.summary.egresosUSDDirect,
    reportData.summary.egresosBs
  );
  const netoSubtitle = formatUsdBsBreakdown(
    reportData.summary.netoUSDDirect,
    reportData.summary.netoBs
  );
  const chartData = useMemo(
    () => buildServiciosTrendSeries(reportData.series),
    [reportData.series]
  );

  const handlePresetClick = (nextPreset) => {
    setPresetKey(nextPreset);
    if (nextPreset === "custom") return;
    const nextRange = getDateRangeFromPreset(nextPreset);
    setFechaInicio(formatLocalYMD(nextRange.start));
    setFechaFin(formatLocalYMD(nextRange.end));
  };

  const handleExportPdf = async () => {
    if (exportingPdf) return;

    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.position = "fixed";
    container.style.left = "-20000px";
    container.style.top = "0";
    container.style.width = "1120px";
    container.style.pointerEvents = "none";
    container.style.zIndex = "-1";

    try {
      setExportingPdf(true);
      container.innerHTML = buildPdfMarkup({
        reportData,
        fontFamily: theme.typography.fontFamily || "'Poppins', Arial, Helvetica, sans-serif",
        generatedAt: new Date(),
      });
      document.body.appendChild(container);

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await waitForImages(container);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

      // Librerías de PDF cargadas solo al exportar (no forman parte del bundle inicial)
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(container.firstElementChild, {
        backgroundColor: "#f6f1e8",
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1120,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const renderWidth = pageWidth - margin * 2;
      const renderHeight = (canvas.height * renderWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png");

      let remainingHeight = renderHeight;
      let position = margin;

      pdf.addImage(imageData, "PNG", margin, position, renderWidth, renderHeight, undefined, "FAST");
      remainingHeight -= pageHeight - margin * 2;

      while (remainingHeight > 0) {
        position = margin - (renderHeight - remainingHeight);
        pdf.addPage();
        pdf.addImage(imageData, "PNG", margin, position, renderWidth, renderHeight, undefined, "FAST");
        remainingHeight -= pageHeight - margin * 2;
      }

      const fileName = `reporte-${reportData.range?.fechaInicio || "inicio"}-${reportData.range?.fechaFin || "fin"}.pdf`;
      pdf.save(fileName);
    } catch (pdfError) {
      console.error("No se pudo generar el PDF del reporte", pdfError);
      window.alert("No se pudo generar el PDF del reporte. Revisa la consola para más detalles.");
    } finally {
      container.remove();
      setExportingPdf(false);
    }
  };

  if (!isAdmin && !isOwner) {
    return <AccesoDenegado />;
  }

  return (
    <Layout headerMaxWidth="lg">
      <Container maxWidth="lg" sx={{ mt: 4, mb: 5 }}>
        <Button
          variant="text"
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ mb: 2 }}
          onClick={() => navigate("/dashboard")}
        >
          Atrás
        </Button>

        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <AssessmentOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>
                Reportes
              </Typography>
            </Stack>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Reporte por rango
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Consulta ingresos, egresos, servicios entregados y nómina para cualquier periodo sin perder claridad.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={() => exportReportToExcel(reportData)}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<PrintOutlinedIcon />}
              onClick={handleExportPdf}
              disabled={exportingPdf}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {exportingPdf ? "Generando PDF..." : "PDF"}
            </Button>
          </Stack>
        </Box>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Filtros rápidos
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {REPORT_PRESETS.map((preset) => (
              <Chip
                key={preset.key}
                label={preset.label}
                clickable
                color={presetKey === preset.key ? "primary" : "default"}
                variant={presetKey === preset.key ? "filled" : "outlined"}
                onClick={() => handlePresetClick(preset.key)}
              />
            ))}
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              gap: 2,
              alignItems: "end",
            }}
          >
            <TextField
              label="Desde"
              type="date"
              value={fechaInicio}
              onChange={(event) => {
                setPresetKey("custom");
                setFechaInicio(event.target.value);
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Hasta"
              type="date"
              value={fechaFin}
              onChange={(event) => {
                setPresetKey("custom");
                setFechaFin(event.target.value);
              }}
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <Alert severity="info" sx={{ py: 0.5 }}>
                Agrupado por {reportData.granularity === "day" ? "día" : reportData.granularity === "week" ? "semanas" : "meses"}
            </Alert>
          </Box>
        </Paper>

        {loading ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={28} />
          </Paper>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
                gap: 2,
                mb: 3,
              }}
            >
              <SummaryCard
                title="Ingresos"
                value={formatUsd(reportData.summary.ingresosUSD)}
                subtitle={ingresosSubtitle}
                parcial={!reportData.summary.completitud.areas.ingresos}
              />
              <SummaryCard
                title="Egresos"
                value={formatUsd(reportData.summary.egresosUSD)}
                subtitle={egresosSubtitle}
                parcial={!reportData.summary.completitud.areas.egresos}
              />
              <SummaryCard
                title="Nómina"
                value={formatUsd(reportData.summary.nominaUSD)}
                subtitle="Nóminas dentro del rango"
                parcial={!reportData.summary.completitud.areas.nomina}
              />
              <SummaryCard
                title="Servicios entregados"
                value={String(reportData.summary.serviciosEntregados)}
                subtitle="Vehículos entregados en el periodo"
                parcial={!reportData.summary.completitud.areas.servicios}
              />
              <SummaryCard
                title="Neto"
                value={formatUsd(reportData.summary.netoUSD)}
                subtitle={reportData.summary.completitud.completo ? netoSubtitle : `${netoSubtitle} · no reconciliado`}
                parcial={!reportData.summary.completitud.completo}
              />
            </Box>

            <AvisoCompletitud completitud={reportData.summary.completitud} sx={{ mb: 3 }} />

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <InsightsOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Comportamiento del periodo
                </Typography>
              </Stack>
              <Box sx={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="usd" tick={{ fontSize: 11 }} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                    <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "Servicios") return [value, name];
                        return [formatUsd(value), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="usd" name="Ingresos" dataKey="ingresosUSD" fill={COLORS.ingresos} radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="usd" name="Egresos" dataKey="egresosUSD" fill={COLORS.egresos} radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="usd" name="Nómina" dataKey="nominaUSD" fill={COLORS.nomina} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="count" name="Servicios" type="monotone" dataKey="serviciosEntregados" stroke={COLORS.servicios} strokeWidth={2.5} dot={false} />
                    <Line yAxisId="count" name="Tendencia servicios" type="monotone" dataKey="serviciosTrend" stroke="#0f2b46" strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Detalle agrupado
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {reportData.series.length} {reportData.series.length === 1 ? "periodo" : "periodos"} entre {formatDisplayDate(reportData.range.start)} y {formatDisplayDate(reportData.range.end)}.
              </Typography>

              {isMobile ? (
                <Stack spacing={1.5}>
                  {reportData.series.map((item) => (
                    <Paper key={item.key} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2">Ingresos USD: {formatUsd(item.ingresosUSD)}</Typography>
                      <Typography variant="body2">Ingresos Bs: {formatBs(item.ingresosBs)}</Typography>
                      <Typography variant="body2">Egresos USD: {formatUsd(item.egresosUSD)}</Typography>
                      <Typography variant="body2">Egresos Bs: {formatBs(item.egresosBs)}</Typography>
                      <Typography variant="body2">Nómina USD: {formatUsd(item.nominaUSD)}</Typography>
                      <Typography variant="body2">Servicios: {item.serviciosEntregados}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, mt: 1 }}>
                        Neto USD: {formatUsd(item.netoUSD)}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                      <TableCell>Periodo</TableCell>
                      <TableCell align="right">Ingresos USD</TableCell>
                      <TableCell align="right">Ingresos Bs</TableCell>
                      <TableCell align="right">Egresos USD</TableCell>
                      <TableCell align="right">Egresos Bs</TableCell>
                      <TableCell align="right">Servicios</TableCell>
                      <TableCell align="right">Nómina USD</TableCell>
                      <TableCell align="right">Neto USD</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportData.series.map((item) => (
                      <TableRow key={item.key} hover>
                        <TableCell>{item.label}</TableCell>
                        <TableCell align="right">{formatUsd(item.ingresosUSD)}</TableCell>
                        <TableCell align="right">{formatBs(item.ingresosBs)}</TableCell>
                        <TableCell align="right">{formatUsd(item.egresosUSD)}</TableCell>
                        <TableCell align="right">{formatBs(item.egresosBs)}</TableCell>
                        <TableCell align="right">{item.serviciosEntregados}</TableCell>
                        <TableCell align="right">{formatUsd(item.nominaUSD)}</TableCell>
                        <TableCell align="right">{formatUsd(item.netoUSD)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </>
        )}
      </Container>
    </Layout>
  );
}