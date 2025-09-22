import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Divider,
} from "@mui/material";
import { guardarIngreso, obtenerIngresos } from "../lib/ingresosFirebase";

export default function Ingresos({ tasaBCV }) {
  const [ingresoDesc, setIngresoDesc] = useState("");
  const [ingresoMontoUSD, setIngresoMontoUSD] = useState("");
  const [ingresoMontoBs, setIngresoMontoBs] = useState("");
  const [ingresos, setIngresos] = useState([]);

  useEffect(() => {
    obtenerIngresos().then(setIngresos);
  }, []);

  const handleAgregarIngreso = async () => {
    const montoUSD = Number(ingresoMontoUSD);
    const montoBs = Number(ingresoMontoBs);
    if (!ingresoDesc || (!montoUSD && !montoBs)) return;
    const nuevoIngreso = {
      descripcion: ingresoDesc,
      monto: montoUSD || (montoBs / tasaBCV),
      montoBs: montoBs || (montoUSD * tasaBCV),
      fecha: new Date().toLocaleDateString('es-VE'),
    };
    await guardarIngreso(nuevoIngreso);
    setIngresos([nuevoIngreso, ...ingresos]);
    setIngresoDesc("");
    setIngresoMontoUSD("");
    setIngresoMontoBs("");
  };

  return (
  <Box sx={{ maxWidth: 1100, mx: "auto", p: 2 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Registro de Ingresos
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} color="text.secondary" sx={{ mb: 1 }}>
          Ingreso manual
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Descripción"
            size="small"
            value={ingresoDesc}
            onChange={e => setIngresoDesc(e.target.value)}
            sx={{ flex: 2, minWidth: 120 }}
          />
          <TextField
            label="Monto ($)"
            type="number"
            size="small"
            value={ingresoMontoUSD}
            onChange={e => {
              const val = e.target.value;
              setIngresoMontoUSD(val);
              if (val !== "" && !isNaN(Number(val))) {
                setIngresoMontoBs((Number(val) * tasaBCV).toFixed(2));
              } else {
                setIngresoMontoBs("");
              }
            }}
            sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 90 }}
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Monto (Bs)"
            type="number"
            size="small"
            value={ingresoMontoBs}
            onChange={e => {
              const val = e.target.value;
              setIngresoMontoBs(val);
              if (val !== "" && !isNaN(Number(val))) {
                setIngresoMontoUSD((Number(val) / tasaBCV).toFixed(2));
              } else {
                setIngresoMontoUSD("");
              }
            }}
            sx={{ flex: 1, bgcolor: '#f5f5f5', color: 'text.secondary', minWidth: 90 }}
            inputProps={{ min: 0 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAgregarIngreso}
            disabled={!ingresoDesc || (!ingresoMontoUSD && !ingresoMontoBs)}
          >
            Agregar
          </Button>
        </Box>
      </Box>
      <Table component={Paper} size="small" sx={{ mb: 2 }}>
        {/* Fila de total de ingresos al inicio */}
        <TableHead>
          <TableRow>
            <TableCell colSpan={7} sx={{ fontWeight: 700, bgcolor: '#e0f7fa', width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }} className="w-100">
                <span>Total Ingresos</span>
                <span>
                  $ {ingresos.reduce((acc, ing) => acc + (Number(ing.monto) || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  {' '}| Bs. {ingresos.reduce((acc, ing) => acc + (Number(ing.montoBs) || (Number(ing.monto) * tasaBCV) || 0), 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </span>
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Fecha</TableCell>
            <TableCell>Factura</TableCell>
            <TableCell align="right">Monto ($)</TableCell>
            <TableCell align="right">Monto (Bs)</TableCell>
            <TableCell>Forma de Pago</TableCell>
            <TableCell>Ref./Observaciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ingresos.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ color: "text.secondary" }}>
                Sin ingresos
              </TableCell>
            </TableRow>
          ) : (
            ingresos.map((ing, idx) => (
              <TableRow key={idx}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell>{ing.fecha}</TableCell>
                <TableCell>{ing.factura || '-'}</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {Math.abs(ing.monto).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {Math.abs(ing.montoBs || ing.monto * tasaBCV).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>{ing.formaPago || '-'}</TableCell>
                <TableCell>{ing.referencia || '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );
}
