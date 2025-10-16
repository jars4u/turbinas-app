import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Grid,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AddTaskIcon from "@mui/icons-material/AddTask";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import PendingActionsIcon from "@mui/icons-material/PendingActions";

export default function ReporteDia({ open, onClose, resumen, fecha }) {
  // resumen: { inicio, registrados, entregados, pendientes }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 0 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Resumen de servicios
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fecha}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Cerrar">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 2, bgcolor: "#e3f2fd", display: "flex", alignItems: "center", gap: 2 }}>
              <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight={700} color="primary">
                  {resumen.inicio}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Al inicio del día
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 2, bgcolor: "#fffde7", display: "flex", alignItems: "center", gap: 2 }}>
              <AddTaskIcon color="warning" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight={700} color="warning.main">
                  {resumen.registrados}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Registrados hoy
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 2, bgcolor: "#e8f5e9", display: "flex", alignItems: "center", gap: 2 }}>
              <DoneAllIcon color="success" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight={700} color="success.main">
                  {resumen.entregados}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Entregados hoy
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Paper elevation={3} sx={{ p: 2, borderRadius: 2, bgcolor: "#ffebee", display: "flex", alignItems: "center", gap: 2 }}>
              <PendingActionsIcon color="error" sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" fontWeight={700} color="error.main">
                  {resumen.pendientes}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pendientes al cierre
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}
