import React, { useEffect, useMemo, useState } from "react";
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

  const toggleOpen = () => setOpen((v) => !v);

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
      {/* FAB flotante */}
      <Box sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1300 }}>
        <Tooltip title={open ? "Cerrar notas" : "Notas"} placement="left">
          <Fab
            size="small"
            color="primary"
            onClick={toggleOpen}
            sx={{ boxShadow: 6 }}
            aria-label="notas"
          >
            {open ? <CloseIcon /> : <StickyNote2Icon />}
          </Fab>
        </Tooltip>
      </Box>

      {/* Panel tipo sticky note */}
      {open && (
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 80,
            width: { xs: 300, sm: 360 },
            borderRadius: 2,
            overflow: "hidden",
            background: stickyColors.bg,
            border: `1px solid ${stickyColors.border}`,
            transform: "rotate(-0.3deg)",
          }}
        >
          {/* Pin decorativo */}
          <Box sx={{ position: "relative" }}>
            <Box
              sx={{
                position: "absolute",
                top: 6,
                left: "50%",
                transform: "translateX(-50%)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                bgcolor: stickyColors.pin,
                boxShadow: 3,
                border: "2px solid rgba(0,0,0,0.12)",
                zIndex: 2,
              }}
            />
          </Box>

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
                Limpiar
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
