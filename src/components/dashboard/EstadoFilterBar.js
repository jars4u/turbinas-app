import React from "react";
import { Box, Typography, Select, MenuItem, Button } from "@mui/material";
import SortIcon from "@mui/icons-material/Sort";

export default function EstadoFilterBar({
  estadosServicio = [],
  vehiculos = [],
  nombreOcultar = null,
  ordenEstado = "",
  onChangeOrdenEstado,
  ordenAsc = true,
  onToggleOrdenAsc,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "center", sm: "center" },
        justifyContent: { xs: "center", sm: "space-between" },
        mb: 2,
        gap: { xs: 2, sm: 0 },
      }}
    >
      <Box
        sx={{
          display: { xs: "none", sm: "flex" },
          flexDirection: { xs: "row", sm: "row" },
          flexWrap: { xs: "wrap", sm: "nowrap" },
          gap: { xs: 1, sm: 4 },
          alignItems: { xs: "center", sm: "center" },
          width: { xs: "100%", sm: "auto" },
          justifyContent: { xs: "center", sm: "flex-start" },
        }}
      >
        {estadosServicio
          .filter((estado) => estado.nombre !== "entregado")
          .map((estado) => (
            <Typography
              key={estado.nombre}
              variant="body2"
              fontWeight={600}
              sx={{
                textAlign: { xs: "center", sm: "left" },
                width: { xs: "auto", sm: "auto" },
                fontSize: { xs: "0.95rem", sm: "1.15rem" },
                px: { xs: 0.5, sm: 0 },
                color:
                  estado.color === "grey"
                    ? "#757575"
                    : (theme) =>
                        theme.palette[estado.color]?.main ||
                        theme.palette.text.primary,
              }}
            >
              {estado.label}:{" "}
              {
                vehiculos.filter((v) => (v.status || v.estado) === estado.nombre).length
              }
            </Typography>
          ))}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 1,
          width: { xs: "100%", sm: "auto" },
          mt: { xs: 1, sm: 0 },
        }}
      >
        <SortIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        <Select
          size="small"
          value={ordenEstado}
          onChange={(e) => onChangeOrdenEstado?.(e.target.value)}
          displayEmpty
          sx={{
            minWidth: 120,
            color: "text.secondary",
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          {estadosServicio.map((estado) => (
            <MenuItem key={estado.nombre} value={estado.nombre}>
              {estado.label}
            </MenuItem>
          ))}
        </Select>
        <Button
          size="small"
          variant="outlined"
          onClick={onToggleOrdenAsc}
          sx={{
            minWidth: 36,
            px: 1,
            color: "text.secondary",
            borderColor: "#b4b4b4ff",
            boxShadow: "none",
            width: { xs: "100%", sm: "auto" },
            mt: { xs: 1, sm: 0 },
            "&:hover": { bgcolor: "#e0e0e0" },
          }}
        >
          {ordenAsc ? "Asc" : "Desc"}
        </Button>
      </Box>
    </Box>
  );
}
