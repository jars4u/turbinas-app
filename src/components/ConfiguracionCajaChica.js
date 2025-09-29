import React from "react";
import { Button, Accordion, AccordionSummary, AccordionDetails, TextField, Tooltip } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SavingsIcon from '@mui/icons-material/Savings';
import AddIcon from '@mui/icons-material/Add';
import { Box, Typography, Divider, Paper } from "@mui/material";
import { guardarFondoCajaChica, obtenerFondoCajaChica } from "../lib/configuracionCajaChicaFirebase";

export default function ConfiguracionCajaChica({ isOwner }) {
  const [valorGuardado, setValorGuardado] = React.useState(0);
  const [inputValue, setInputValue] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [guardando, setGuardando] = React.useState(false);
  React.useEffect(() => {
    obtenerFondoCajaChica().then(valor => {
      setValorGuardado(valor);
      setInputValue(Number(valor).toFixed(2));
      setLoading(false);
    });
  }, []);
  const handleOpen = () => {
    alert('Agregar configuración de caja chica');
  };
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SavingsIcon fontSize="small" sx={{ mb: '2px' }} />
          Configuración caja chica
        </Typography>
      </Box>
      <Accordion elevation={0} sx={{ boxShadow: 'none', border: 'none', background: 'transparent', mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, py: 0, minHeight: 36 }}>
          <Typography variant="subtitle2">Mostrar configuraciones de caja chica</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0, py: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography color="text.secondary" sx={{ minWidth: 180 }}>
              Fondo en caja chica (USD):
            </Typography>
            <TextField
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={loading ? '' : inputValue}
              onChange={e => {
                const val = e.target.value;
                // Solo números positivos y máximo 2 decimales
                if (/^\d*(\.\d{0,2})?$/.test(val)) {
                  setInputValue(val);
                }
              }}
              size="small"
              sx={{ width: 120 }}
              disabled={loading || guardando}
              placeholder={loading ? 'Cargando...' : '0.00'}
            />
            <Tooltip title={isOwner ? "Guardar fondo de caja chica" : "Solo el Owner puede modificar el fondo de caja chica"}>
              <span>
                <Button
                  variant="contained"
                  size="small"
                  sx={{ ml: 2 }}
                  disabled={
                    !isOwner || loading || guardando || inputValue === '' || Number(Number(inputValue).toFixed(2)) === Number(Number(valorGuardado).toFixed(2))
                  }
                  onClick={async () => {
                    if (!isOwner) return;
                    setGuardando(true);
                    await guardarFondoCajaChica(inputValue);
                    const nuevoValor = Number(Number(inputValue).toFixed(2));
                    setValorGuardado(nuevoValor);
                    setInputValue(nuevoValor.toFixed(2));
                    setGuardando(false);
                  }}
                >
                  Guardar
                </Button>
              </span>
            </Tooltip>
          </Box>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            Este monto será el total base para el cálculo de la pestaña caja chica en cierre del día.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
