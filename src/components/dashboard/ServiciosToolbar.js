import React from "react";
import { Box, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export default function ServiciosToolbar({ onOpenReporteDia, onRegistrarServicio }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' }, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'center', sm: 'flex-end' } }}>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        sx={{ borderColor: '#bdbdbd', color: '#616161', maxWidth: { xs: 320, sm: "none" } , width: { xs: '100%', sm: 'auto' } }}
        onClick={onOpenReporteDia}
      >
        Reporte del día
      </Button>
      <Button
        variant="outlined"
        color="primary"
        size="small"
        startIcon={<AddIcon />}
        onClick={onRegistrarServicio}
        sx={{
          width: { xs: "100%", sm: "auto" },
          maxWidth: { xs: 320, sm: "none" },
        }}
      >
        Registrar servicio
      </Button>
    </Box>
  );
}
