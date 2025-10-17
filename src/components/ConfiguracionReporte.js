import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Autocomplete,
  TextField,
  Snackbar,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { obtenerEstadosServicio } from "../lib/estadosServicioFirebase";
import { guardarConfiguracionReporte, obtenerConfiguracionReporte } from "../lib/configuracionReporteFirebase";

export default function ConfiguracionReporte() {
  const [estados, setEstados] = useState([]);
  const [config, setConfig] = useState({});
  const [snackOpen, setSnackOpen] = useState(false);

  const secciones = [
    { key: "inicio", label: "Al inicio del día" },
    { key: "registrados", label: "Registrados hoy" },
    { key: "entregados", label: "Entregados hoy" },
    { key: "pendientes", label: "Pendientes al cierre" },
  ];

  useEffect(() => {
    let mounted = true;
    obtenerEstadosServicio().then((data) => {
      if (!mounted) return;
      // data esperado: array de objetos { nombre, ... }
      setEstados(data || []);
    });
    // cargar config desde Firestore
    obtenerConfiguracionReporte().then(cfg => {
      if (!mounted) return;
      setConfig(cfg || {});
    }).catch(e => console.warn('Error obteniendo config reporte', e));
    return () => (mounted = false);
  }, []);

  const handleChange = (sectionKey, values) => {
    setConfig((prev) => ({ ...prev, [sectionKey]: values }));
  };

  const handleSave = () => {
    guardarConfiguracionReporte(config).then(() => setSnackOpen(true)).catch(e => console.error('Error guardando config reporte', e));
  };

  const handleReset = () => {
    const empty = { inicio: [], registrados: [], entregados: [], pendientes: [] };
    setConfig(empty);
    guardarConfiguracionReporte(empty).then(() => setSnackOpen(true)).catch(e => console.error('Error reseteando config reporte', e));
  };

  const opciones = estados.map((e) => e.label || e.nombre || e.id || "");

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AssignmentIcon /> Definición de estados para Reporte del día
      </Typography>
      <Paper sx={{ p: 2, mb: 2 }} elevation={0}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Selecciona qué estados harán que un servicio cuente para cada sección del reporte del día. Puedes elegir varios estados por sección.
        </Typography>
        <Grid container spacing={2}>
          {secciones.map((s) => (
            <Grid item xs={12} md={6} key={s.key}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{s.label}</Typography>
              <Autocomplete
                multiple
                options={opciones}
                value={config[s.key] || []}
                onChange={(e, v) => handleChange(s.key, v)}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Seleccionar estados" />}
                sx={{ background: 'white' }}
              />
            </Grid>
          ))}
        </Grid>
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button variant="contained" color="primary" size="small" onClick={handleSave}>Guardar</Button>
          <Button variant="outlined" color="inherit" size="small" onClick={handleReset}>Restablecer</Button>
        </Box>
      </Paper>
      <Snackbar open={snackOpen} autoHideDuration={2000} onClose={() => setSnackOpen(false)} message="Configuración guardada" />
    </Box>
  );
}
