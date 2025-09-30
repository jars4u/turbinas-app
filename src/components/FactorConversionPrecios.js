import React, { useState, useEffect } from "react";
import { obtenerFactorConversion, guardarFactorConversion } from "../lib/factorConversionFirebase";
import PriceChangeIcon from '@mui/icons-material/PriceChange';
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  CircularProgress,
  LinearProgress,
} from "@mui/material";

export default function FactorConversionPrecios({ initialFactor = 1, onSave }) {
  const [factor, setFactor] = useState(initialFactor);
  const [edit, setEdit] = useState(false);
  const [input, setInput] = useState(factor);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFactor() {
      setLoading(true);
      const val = await obtenerFactorConversion();
      setFactor(val);
      setInput(val);
      setLoading(false);
    }
    fetchFactor();
  }, []);

  const handleEdit = () => {
    setInput(factor);
    setEdit(true);
    setError("");
  };

  const handleSave = async () => {
    const value = parseFloat(input);
    if (isNaN(value) || value <= 0) {
      setError("Debe ser un número mayor a 0");
      return;
    }
    setLoading(true);
    await guardarFactorConversion(value);
    setFactor(value);
    setEdit(false);
    setError("");
    setLoading(false);
    if (onSave) onSave(value);
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }} mb={2}>
        <PriceChangeIcon fontSize="medium" sx={{ mb: '2px' }} />
        Factor de conversión
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="body2" sx={{ minWidth: 120 }}>
          Factor actual:
        </Typography>
        {loading ? (
          <Box sx={{ width: 120 }}><LinearProgress sx={{ height: 8, borderRadius: 2 }} /></Box>
        ) : !edit ? (
          <>
            <Typography variant="body1" fontWeight={500}>
              {factor}
            </Typography>
            <Button variant="outlined" size="small" onClick={handleEdit}>
              Editar
            </Button>
          </>
        ) : (
          <>
            <TextField
              size="small"
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              error={!!error}
              helperText={error}
              inputProps={{ min: 0.01, step: 0.01 }}
              sx={{ width: 100 }}
              disabled={loading}
            />
            <Button variant="contained" size="small" onClick={handleSave} disabled={loading}>
              {loading ? (
                <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
              ) : null}
              Guardar
            </Button>
            <Button
              variant="text"
              size="small"
              color="error"
              onClick={() => setEdit(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}
