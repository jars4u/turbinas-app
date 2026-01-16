import React from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

function isValidNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function formatUSD(value) {
  return isValidNumber(value)
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
}

function formatBs(value, tasaBCV) {
  return tasaBCV && isValidNumber(value)
    ? (value * tasaBCV).toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
}

function chipColorProps(color) {
  const allowed = [
    "default",
    "primary",
    "secondary",
    "error",
    "info",
    "success",
    "warning",
  ];
  return allowed.includes(color) ? { color } : {};
}

export default function TotaleEstado({ totalesPorEstado = [], tasaBCV = null }) {
  const totalUSD = totalesPorEstado.reduce(
    (acc, estado) => acc + (isValidNumber(estado?.total) ? estado.total : 0),
    0
  );

  const totalBs = tasaBCV
    ? totalesPorEstado.reduce(
        (acc, estado) =>
          acc + (isValidNumber(estado?.total) ? estado.total * tasaBCV : 0),
        0
      )
    : null;

  const renderRows = (variant) =>
    totalesPorEstado.map((estado) => (
      <TableRow key={estado.nombre}>
        <TableCell>
          <Chip
            label={estado.label}
            size="small"
            sx={{
              fontWeight: 500,
              fontSize:
                variant === "mobile"
                  ? { xs: "0.75rem", md: "0.95rem" }
                  : "0.95rem",
              height: variant === "mobile" ? { xs: 22, md: 24 } : 24,
              bgcolor: estado.color === "gris" ? "grey.500" : undefined,
              color: estado.color === "gris" ? "#fff" : undefined,
            }}
            {...chipColorProps(estado.color)}
          />
        </TableCell>
        <TableCell align="right">{formatUSD(estado?.total)}</TableCell>
        <TableCell align="right">{formatBs(estado?.total, tasaBCV)}</TableCell>
      </TableRow>
    ));

  const renderTotalRow = () => (
    <TableRow>
      <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
      <TableCell align="right" sx={{ fontWeight: 700 }}>
        {formatUSD(totalUSD)}
      </TableCell>
      <TableCell align="right" sx={{ fontWeight: 700 }}>
        {totalBs === null
          ? "-"
          : totalBs.toLocaleString("de-DE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
      </TableCell>
    </TableRow>
  );

  const FooterNote = () => (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      El total de entregados corresponde al monto cobrado hoy y se reflejará en los
      egresos. El total en proceso y notificado muestra los montos aún no cobrados.
    </Typography>
  );

  return (
    <>
      {/* Responsive: Accordion en móviles, tabla normal en desktop */}
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <Accordion sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1" fontWeight={600}>
              Totales por estado
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Table
              size="small"
              sx={{
                mb: 2,
                minWidth: 360,
                width: "100%",
                overflowX: "auto",
                "& .MuiTableCell-root": { fontSize: { xs: "0.80rem" } },
                "& .MuiChip-label": { fontSize: { xs: "0.75rem" } },
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
                {renderRows("mobile")}
                {renderTotalRow()}
              </TableBody>
            </Table>
            <FooterNote />
          </AccordionDetails>
        </Accordion>
      </Box>

      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <Table component={Paper} size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Total $</TableCell>
              <TableCell align="right">Total Bs</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {renderRows("desktop")}
            {renderTotalRow()}
          </TableBody>
        </Table>
        <FooterNote />
      </Box>
    </>
  );
}
