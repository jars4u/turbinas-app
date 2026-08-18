import React, { useCallback, useEffect, useState } from "react";
import {
  MODOS_FACTOR,
  ETIQUETAS_MODO_FACTOR,
  guardarConfigFactorConversion,
  sincronizarValorRespaldo,
} from "../lib/factorConversionFirebase";
import { obtenerTasasBCV, tasasBCVEnCache } from "../lib/tasasBCV";
import useFactorConversion from "../hooks/useFactorConversion";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import RefreshIcon from "@mui/icons-material/Refresh";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import EuroIcon from "@mui/icons-material/Euro";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  CircularProgress,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Alert,
} from "@mui/material";

const formatBs = (v) =>
  `Bs. ${Number(v).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatHora = (ts) => {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString("es-VE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    return null;
  }
};

export default function FactorConversionPrecios({ onSave }) {
  const { detalle, cargando, refrescar } = useFactorConversion();
  const [modo, setModo] = useState(MODOS_FACTOR.MANUAL);
  const [tasas, setTasas] = useState(tasasBCVEnCache());
  const [edit, setEdit] = useState(false);
  const [input, setInput] = useState("1");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [refrescando, setRefrescando] = useState(false);

  const factor = detalle && detalle.factor > 0 ? detalle.factor : 1;
  const valorManual = (detalle && detalle.valorManual) || 1;

  // Mantener la vista sincronizada con lo que hay guardado
  useEffect(() => {
    if (!detalle) return;
    setModo(detalle.modo);
    if (!edit) setInput(String(detalle.valorManual || 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle]);

  // Las tasas mostradas se refrescan junto con el factor
  useEffect(() => {
    let activo = true;
    obtenerTasasBCV()
      .then((t) => {
        if (activo) setTasas(t);
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [detalle]);

  const actualizarAhora = useCallback(async () => {
    setRefrescando(true);
    setError("");
    try {
      const [nuevoDetalle, nuevasTasas] = await Promise.all([
        refrescar({ forzar: true }),
        obtenerTasasBCV({ forzar: true }),
      ]);
      setTasas(nuevasTasas);
      if (nuevoDetalle) await sincronizarValorRespaldo(nuevoDetalle);
    } finally {
      setRefrescando(false);
    }
  }, [refrescar]);

  const guardarModo = async (nuevoModo) => {
    if (!nuevoModo || nuevoModo === modo) return;
    const anterior = modo;
    setModo(nuevoModo);
    setEdit(false);
    setGuardando(true);
    setError("");
    try {
      const nuevoDetalle = await guardarConfigFactorConversion({
        modo: nuevoModo,
        valorManual,
      });
      if (onSave) onSave(nuevoDetalle.factor);
    } catch (e) {
      setModo(anterior);
      setError("No se pudo guardar el modo. Verifica tu conexión o permisos.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarManual = async () => {
    const value = parseFloat(input);
    if (isNaN(value) || value <= 0) {
      setError("Debe ser un número mayor a 0");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const nuevoDetalle = await guardarConfigFactorConversion({
        modo: MODOS_FACTOR.MANUAL,
        valorManual: value,
      });
      setEdit(false);
      if (onSave) onSave(nuevoDetalle.factor);
    } catch (e) {
      setError("No se pudo guardar el factor.");
    } finally {
      setGuardando(false);
    }
  };

  const opciones = [
    {
      modo: MODOS_FACTOR.MANUAL,
      icono: <EditIcon fontSize="small" />,
      valor: formatBs(valorManual),
      ayuda: "Valor fijo definido por ti",
    },
    {
      modo: MODOS_FACTOR.BCV_USD,
      icono: <AttachMoneyIcon fontSize="small" />,
      valor: tasas.usd ? formatBs(tasas.usd) : "No disponible",
      ayuda: "Tasa oficial del dólar, actualizada automáticamente",
    },
    {
      modo: MODOS_FACTOR.BCV_EUR,
      icono: <EuroIcon fontSize="small" />,
      valor: tasas.eur ? formatBs(tasas.eur) : "No disponible",
      ayuda: "Tasa oficial del euro, actualizada automáticamente",
    },
  ];

  const usandoRespaldo = detalle && detalle.fuente === "respaldo";
  const horaTasa = formatHora(tasas.actualizado);

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <Typography
        variant="h6"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
        mb={2}
      >
        <PriceChangeIcon fontSize="medium" sx={{ mb: "2px" }} />
        Factor de conversión
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Elige con qué tasa la app convierte los precios de dólares a bolívares.
        Todas las secciones (dashboard, ingresos, reportes y cierre del día) usan
        el factor elegido.
      </Typography>

      <ToggleButtonGroup
        exclusive
        value={modo}
        onChange={(e, val) => guardarModo(val)}
        disabled={guardando || cargando}
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2,
          "& .MuiToggleButtonGroup-grouped": {
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            flex: { xs: "1 1 100%", sm: "1 1 200px" },
            textTransform: "none",
            px: 2,
            py: 1.2,
            alignItems: "flex-start",
          },
        }}
      >
        {opciones.map((op) => (
          <ToggleButton key={op.modo} value={op.modo}>
            <Stack spacing={0.3} alignItems="flex-start" sx={{ width: "100%" }}>
              <Stack direction="row" alignItems="center" spacing={0.8}>
                {op.icono}
                <Typography variant="body2" fontWeight={700}>
                  {ETIQUETAS_MODO_FACTOR[op.modo]}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {op.valor}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {op.ayuda}
              </Typography>
            </Stack>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {usandoRespaldo ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No se pudo consultar la tasa del BCV; se está usando el último valor
          guardado ({formatBs(factor)}).
        </Alert>
      ) : null}

      <Box
        sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}
      >
        <Typography variant="body2" sx={{ minWidth: 120 }}>
          Factor actual:
        </Typography>
        {cargando ? (
          <Box sx={{ width: 120 }}>
            <LinearProgress sx={{ height: 8, borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            <Typography variant="body1" fontWeight={600}>
              {formatBs(factor)}
            </Typography>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={ETIQUETAS_MODO_FACTOR[modo]}
            />
            {modo !== MODOS_FACTOR.MANUAL && horaTasa ? (
              <Typography variant="caption" color="text.secondary">
                Actualizado a las {horaTasa}
              </Typography>
            ) : null}
            {modo !== MODOS_FACTOR.MANUAL ? (
              <Tooltip title="Actualizar tasas ahora">
                <span>
                  <IconButton
                    size="small"
                    onClick={actualizarAhora}
                    disabled={refrescando}
                  >
                    {refrescando ? (
                      <CircularProgress size={16} />
                    ) : (
                      <RefreshIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </>
        )}
      </Box>

      {modo === MODOS_FACTOR.MANUAL && !cargando ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mt: 2,
            flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" sx={{ minWidth: 120 }}>
            Valor manual:
          </Typography>
          {!edit ? (
            <>
              <Typography variant="body1" fontWeight={500}>
                {valorManual}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setInput(String(valorManual));
                  setEdit(true);
                  setError("");
                }}
              >
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
                inputProps={{ min: 0.01, step: 0.01 }}
                sx={{ width: 120 }}
                disabled={guardando}
              />
              <Button
                variant="contained"
                size="small"
                onClick={guardarManual}
                disabled={guardando}
              >
                {guardando ? (
                  <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
                ) : null}
                Guardar
              </Button>
              <Button
                variant="text"
                size="small"
                color="error"
                onClick={() => {
                  setEdit(false);
                  setError("");
                }}
                disabled={guardando}
              >
                Cancelar
              </Button>
            </>
          )}
        </Box>
      ) : null}

      {/* Ejemplos visuales de conversión */}
      <Divider sx={{ my: 3 }} />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          Ejemplos de conversión
        </Typography>
        <Tooltip title="Los valores se actualizan con el factor">
          <Chip
            label={`Factor: ${factor.toLocaleString("de-DE", {
              maximumFractionDigits: 2,
            })}`}
            color="primary"
            variant="outlined"
            size="small"
          />
        </Tooltip>
      </Stack>

      <Grid container spacing={2}>
        {[
          { nombre: "Servicio", precioUSD: 100 },
          { nombre: "Pasta y sello", precioUSD: 120 },
        ].map(({ nombre, precioUSD }) => {
          const convertido = precioUSD * (Number(factor) || 1);
          const formatUSD = (v) =>
            new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(v);
          return (
            <Grid item xs={12} sm={6} key={nombre}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <CardContent>
                  <Stack spacing={1.2}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {nombre}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={formatUSD(precioUSD)}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                      <Typography variant="caption" color="text.secondary">
                        Precio base
                      </Typography>
                    </Stack>

                    <Divider sx={{ my: 1 }} />

                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1.5}
                    >
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          Conversión
                        </Typography>
                        <Chip
                          label={`x ${factor.toLocaleString("de-DE", {
                            maximumFractionDigits: 2,
                          })}`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ ml: { sm: "auto" } }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Valor convertido:
                        </Typography>
                        <Chip
                          label={formatBs(convertido)}
                          size="small"
                          color="primary"
                        />
                      </Stack>
                    </Stack>

                    <Typography variant="caption" color="text.disabled">
                      Este cálculo es ilustrativo y cambia al modificar el
                      factor.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
