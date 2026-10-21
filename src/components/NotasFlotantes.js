import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Button,
  Stack,
  Divider,
  Fab,
  Tooltip,
  Chip,
  Badge,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import StickyNote2Icon from "@mui/icons-material/StickyNote2";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { useAuth } from "../context/AuthContext";
import {
  escucharNotasPorUsuario,
  crearNota,
  actualizarNota,
  eliminarNota,
} from "../lib/notasFirebase";

const STORAGE_SCRATCH_KEY = "turbinasmcbo_scratch";
const STORAGE_POSICION_KEY = "turbinasmcbo_notas_posicion";
const MARGEN = 8;
const TAMANO_BOTON = 40; // Fab size="small"
const UMBRAL_ARRASTRE = 6; // px: por debajo es un toque, no un arrastre

function limitarAPantalla({ x, y }) {
  const maxX = window.innerWidth - TAMANO_BOTON - MARGEN;
  const maxY = window.innerHeight - TAMANO_BOTON - MARGEN;
  return { x: Math.min(Math.max(MARGEN, x), Math.max(MARGEN, maxX)), y: Math.min(Math.max(MARGEN, y), Math.max(MARGEN, maxY)) };
}

function leerPosicionGuardada() {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_POSICION_KEY));
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return limitarAPantalla(p);
  } catch {}
  return null;
}

/**
 * Botón arrastrable (dedo o ratón). La posición se guarda en este dispositivo;
 * sin posición guardada queda en la esquina inferior derecha de siempre.
 * Un toque sin desplazamiento abre/cierra; un arrastre no.
 */
function useArrastre() {
  const [posicion, setPosicion] = useState(leerPosicionGuardada);
  const arrastre = useRef(null);
  const huboArrastre = useRef(false);

  useEffect(() => {
    const alRedimensionar = () => setPosicion((p) => (p ? limitarAPantalla(p) : p));
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    arrastre.current = { id: e.pointerId, inicioX: e.clientX, inicioY: e.clientY, dx: e.clientX - rect.left, dy: e.clientY - rect.top, movido: false };
    huboArrastre.current = false;
  };

  const onPointerMove = (e) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    if (!a.movido && Math.hypot(e.clientX - a.inicioX, e.clientY - a.inicioY) < UMBRAL_ARRASTRE) return;
    if (!a.movido) {
      a.movido = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    setPosicion(limitarAPantalla({ x: e.clientX - a.dx, y: e.clientY - a.dy }));
  };

  const terminar = (e) => {
    const a = arrastre.current;
    if (!a || a.id !== e.pointerId) return;
    arrastre.current = null;
    if (a.movido) {
      huboArrastre.current = true;
      setPosicion((p) => {
        try {
          if (p) localStorage.setItem(STORAGE_POSICION_KEY, JSON.stringify(p));
        } catch {}
        return p;
      });
    }
  };

  return {
    posicion,
    // El click que sigue a un arrastre no debe abrir el panel
    consumirArrastre: () => {
      const hubo = huboArrastre.current;
      huboArrastre.current = false;
      return hubo;
    },
    manejadores: { onPointerDown, onPointerMove, onPointerUp: terminar, onPointerCancel: terminar },
  };
}

/** Posición del panel junto al botón: encima si el botón está en la mitad inferior, debajo si no. */
function posicionPanel(posicion) {
  if (!posicion) return { right: 16, bottom: 80 };
  const ancho = Math.min(window.innerWidth >= 600 ? 360 : 300, window.innerWidth - 2 * MARGEN);
  const left = Math.min(Math.max(MARGEN, posicion.x + TAMANO_BOTON - ancho), window.innerWidth - ancho - MARGEN);
  return posicion.y > window.innerHeight / 2
    ? { left, bottom: window.innerHeight - posicion.y + MARGEN, maxHeight: posicion.y - 2 * MARGEN }
    : { left, top: posicion.y + TAMANO_BOTON + MARGEN, maxHeight: window.innerHeight - posicion.y - TAMANO_BOTON - 2 * MARGEN };
}

function NotasFlotantes() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [scratch, setScratch] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const { usuario } = useAuth();

  // Load persisted
  useEffect(() => {
    try {
      const rawScratch = localStorage.getItem(STORAGE_SCRATCH_KEY);
      if (rawScratch) setScratch(rawScratch);
    } catch {}
  }, []);

  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SCRATCH_KEY, scratch);
    } catch {}
  }, [scratch]);

  // Suscripción a Firestore por usuario
  useEffect(() => {
    if (!usuario?.email) return;
    setLoading(true);
    const unsub = escucharNotasPorUsuario(
      usuario.email,
      (items) => {
        setNotes(items);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [usuario?.email]);

  const stickyColors = useMemo(
    () => ({
      bg: theme.palette.mode === "dark" ? "#3b3a2e" : "#FFF8B5",
      pin: theme.palette.mode === "dark" ? "#bdb76b" : "#d3b100",
      border: theme.palette.mode === "dark" ? "#5a5843" : "#F0E38A",
    }),
    [theme.palette.mode]
  );

  const { posicion, consumirArrastre, manejadores } = useArrastre();
  const toggleOpen = () => {
    if (consumirArrastre()) return;
    setOpen((v) => !v);
  };

  const addNote = async () => {
    const text = scratch.trim();
    if (!text || !usuario?.email) return;
    await crearNota(usuario.email, text);
    setScratch("");
  };

  const removeNote = async (id) => {
    await eliminarNota(id);
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditingText(note.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const saveEdit = async () => {
    const text = editingText.trim();
    if (!text || !editingId) return;
    await actualizarNota(editingId, text);
    cancelEdit();
  };

  return (
    <>
      {/* FAB flotante (arrastrable) */}
      <Box
        {...manejadores}
        data-testid="notas-arrastrable"
        sx={{
          position: "fixed",
          ...(posicion ? { left: posicion.x, top: posicion.y } : { right: 16, bottom: 45 }),
          zIndex: 1300,
          touchAction: "none", // el dedo mueve el botón, no la página
          userSelect: "none",
        }}
      >
        <Tooltip title={open ? "Cerrar notas" : "Notas (arrastra para mover)"} placement="left">
          <Badge
            badgeContent={notes.length}
            color="error"
            max={9}
            invisible={open || notes.length === 0}
            overlap="circular"
            sx={{ "& .MuiBadge-badge": { zIndex: 1301 } }}
          >
            <Fab
              size="small"
              color="primary"
              onClick={toggleOpen}
              sx={{ boxShadow: 6 }}
              aria-label="notas"
            >
              {open ? <CloseIcon /> : <StickyNote2Icon />}
            </Fab>
          </Badge>
        </Tooltip>
      </Box>

      {/* Panel tipo sticky note */}
      {open && (
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            ...posicionPanel(posicion),
            width: { xs: 300, sm: 360 },
            maxWidth: `calc(100vw - ${2 * MARGEN}px)`,
            zIndex: 1299,
            borderRadius: 2,
            overflow: "auto",
            background: stickyColors.bg,
            border: `1px solid ${stickyColors.border}`,
            transform: "rotate(-0.3deg)",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 1.5,
              pt: 1.5,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <StickyNote2Icon fontSize="small" color="warning" />
              <Typography variant="subtitle2" color="text.primary">
                Notas rápidas
              </Typography>
            </Stack>
            <Chip
              size="small"
              label={`${notes.length}`}
              variant="outlined"
              color="warning"
            />
          </Box>

          {/* Editor */}
          <Box sx={{ p: 1.5, pt: 1 }}>
            <TextField
              value={scratch}
              onChange={(e) => setScratch(e.target.value)}
              placeholder="Escribe aquí... (Ctrl+Enter para guardar)"
              multiline
              minRows={3}
              maxRows={6}
              fullWidth
              variant="outlined"
              size="small"
              sx={{
                bgcolor: theme.palette.mode === "dark" ? "#2f2e25" : "#FFFDE7",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: stickyColors.border,
                },
              }}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === "Enter") {
                  addNote();
                }
              }}
            />

            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<AddIcon />}
                onClick={addNote}
              >
                Guardar nota
              </Button>
              <Button
                variant="text"
                color="inherit"
                size="small"
                onClick={() => setScratch("")}
              >
                <Tooltip title="Limpiar">
                  <IconButton aria-label="limpiar" size="small" color="inherit" onClick={() => setScratch("")}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ opacity: 0.6 }} />

          {/* Listado de notas */}
          <Box sx={{ p: 1.5, pt: 1, maxHeight: 220, overflowY: "auto" }}>
            {loading ? (
              <Typography variant="caption" color="text.secondary">
                Cargando notas...
              </Typography>
            ) : notes.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                No hay notas guardadas.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {notes.map((n) => (
                  <Paper
                    key={n.id}
                    variant="outlined"
                    sx={{
                      p: 1,
                      bgcolor:
                        theme.palette.mode === "dark" ? "#3c3b31" : "#FFFACD",
                      borderColor: stickyColors.border,
                      transform: "rotate(0.2deg)",
                    }}
                  >
                    <Stack direction="row" alignItems="flex-start" spacing={1}>
                      <Box sx={{ flex: 1 }}>
                        {editingId === n.id ? (
                          <>
                            <TextField
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              multiline
                              fullWidth
                              minRows={2}
                              size="small"
                            />
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                              <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                startIcon={<SaveOutlinedIcon />}
                                onClick={saveEdit}
                              >
                                Guardar
                              </Button>
                              <Button
                                variant="text"
                                color="inherit"
                                size="small"
                                startIcon={<CancelOutlinedIcon />}
                                onClick={cancelEdit}
                              >
                                Cancelar
                              </Button>
                            </Stack>
                          </>
                        ) : (
                          <>
                            <Typography
                              variant="body2"
                              sx={{ whiteSpace: "pre-wrap" }}
                            >
                              {n.text}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {n.createdAt?.toDate
                                ? n.createdAt.toDate().toLocaleString()
                                : ""}
                            </Typography>
                          </>
                        )}
                      </Box>
                      {editingId === n.id ? null : (
                        <>
                          <IconButton
                            aria-label="editar"
                            size="small"
                            onClick={() => startEdit(n)}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            aria-label="eliminar"
                            size="small"
                            onClick={() => removeNote(n.id)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>
      )}
    </>
  );
}

export default NotasFlotantes;
