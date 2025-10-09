import React from "react";
import { Button, TextField } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SavingsIcon from '@mui/icons-material/Savings';
import { Box, Typography } from "@mui/material";
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
  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SavingsIcon fontSize="small" sx={{ mb: '2px' }} />
          Configuración caja chica
        </Typography>
      </Box>
      {/* Mostrar configuración de caja chica */}
          <Box
            sx={{
              display: { xs: 'block', sm: 'flex' },
              alignItems: { sm: 'center' },
              gap: 2,
              mb: 2,
            }}
          >
            <Typography
              color="text.secondary"
              sx={{
                minWidth: { xs: 0, sm: 180 },
                width: { xs: '100%', sm: 'auto' },
                display: { xs: 'block', sm: 'inline-block' },
                mb: { xs: 1, sm: 0 },
              }}
            >
              Fondo en caja chica (USD):
            </Typography>
            <TextField
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={loading ? '' : inputValue}
              onChange={e => {
                const val = e.target.value;
                if (/^\d*(\.\d{0,2})?$/.test(val)) {
                  setInputValue(val);
                }
              }}
              size="small"
              sx={{ width: 120 }}
              disabled={loading || guardando || !isOwner}
              placeholder={loading ? 'Cargando...' : '0.00'}
            />
            <Button
              variant="contained"
              size="small"
              sx={{ ml: 2, mt: { xs: 1, sm: 0 } }}
              disabled={
                loading || guardando || inputValue === '' || Number(Number(inputValue).toFixed(2)) === Number(Number(valorGuardado).toFixed(2)) || !isOwner
              }
              onClick={async () => {
                setGuardando(true);
                await guardarFondoCajaChica(inputValue);
                const nuevoValor = Number(Number(inputValue).toFixed(2));
                setValorGuardado(nuevoValor);
                setInputValue(nuevoValor.toFixed(2));
                setGuardando(false);
              }}
              title={isOwner ? '' : 'Solo el Owner puede modificar el fondo de caja chica'}
            >
              Guardar
            </Button>
          </Box>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            Este monto será el total base para el cálculo de la pestaña caja chica en cierre del día.
            {!isOwner && (
              <Box sx={{ color: 'error.main', fontWeight: 500, mt: 1 }}>
                Solo el usuario Owner puede modificar el fondo de caja chica.
              </Box>
            )}
          </Typography>
      {/* Fin configuración de caja chica */}
    </Box>
  );
}
