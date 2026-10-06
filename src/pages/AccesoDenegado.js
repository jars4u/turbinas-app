import React from "react";
import { useNavigate } from "react-router-dom";
import { Container, Box, Typography, Button } from "@mui/material";

export default function AccesoDenegado() {
  const navigate = useNavigate();
  return (
    <Container maxWidth="sm">
      <Box mt={8} textAlign="center">
        {/* Video en bucle en lugar del GIF original (~95 KB vs ~4 MB) */}
        <video
          src="/acceso-denegado.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-label="Access Denied"
          style={{ maxWidth: "220px", width: "100%", marginBottom: 24 }}
        />
        <Typography variant="h4" color="error" gutterBottom>
          Acceso Denegado
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={3}>
          No tienes permiso para acceder a esta página. Por favor inicia sesión
          con un usuario autorizado.
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate("/")}
        >
          Volver
        </Button>
      </Box>
    </Container>
  );
}
