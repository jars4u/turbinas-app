import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Layout from "../components/Layout";
import MensajeAgente from "../components/agente/MensajeAgente";
import AccesoDenegado from "./AccesoDenegado";
import { useAuth } from "../context/AuthContext";
import { LIMITES_AGENTE, enviarConversacion, urlAgente } from "../lib/agenteCliente";

const EJEMPLOS = [
  "¿Cuánto dinero en USD ha entrado en lo que va de mes?",
  "¿Quiénes nos deben y desde cuándo?",
  "¿Qué facturas de proveedores vencen esta semana?",
  "¿Cuál ha sido el mejor mes en ingresos este año?",
  "¿Cuánto tardan los clientes en pagar sus créditos?",
];

function ChatAgente() {
  const navigate = useNavigate();
  const [historial, setHistorial] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // Índice de la respuesta que se está "escribiendo" (solo la última recibida)
  const [animarIndice, setAnimarIndice] = useState(null);
  const finRef = useRef(null);
  const conectado = Boolean(urlAgente());

  useEffect(() => {
    if (finRef.current && typeof finRef.current.scrollIntoView === "function") {
      finRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [historial, enviando, error]);

  // Mientras la respuesta se escribe, mantener a la vista el final del texto
  const seguirEscritura = useCallback(() => {
    if (finRef.current && typeof finRef.current.scrollIntoView === "function") {
      finRef.current.scrollIntoView({ block: "end" });
    }
  }, []);
  const terminarEscritura = useCallback(() => setAnimarIndice(null), []);

  // Envía la conversación tal como está; el último mensaje es del usuario
  const solicitar = async (conversacion) => {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await enviarConversacion(conversacion);
      setHistorial([...conversacion, { rol: "asistente", texto: respuesta.texto, consultas: respuesta.consultas }]);
      setAnimarIndice(conversacion.length);
    } catch (e) {
      setError(e && e.message ? e.message : "Ocurrió un error inesperado con el agente.");
    } finally {
      setEnviando(false);
    }
  };

  const enviar = (contenido) => {
    const limpio = contenido.trim();
    if (!limpio || enviando || !conectado) return;
    const conversacion = [...historial, { rol: "usuario", texto: limpio }];
    setAnimarIndice(null);
    setHistorial(conversacion);
    setTexto("");
    solicitar(conversacion);
  };

  const reintentar = () => {
    if (historial.length > 0 && historial[historial.length - 1].rol === "usuario") solicitar(historial);
  };

  const nuevaConversacion = () => {
    setAnimarIndice(null);
    setHistorial([]);
    setError(null);
    setTexto("");
  };

  return (
    <Container maxWidth="md" sx={{ mt: { xs: 2, md: 4 }, mb: 3, px: { xs: 1.5, md: 3 } }}>
      <Button variant="text" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 2 }} onClick={() => navigate("/dashboard")}>
        Atrás
      </Button>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <SmartToyOutlinedIcon fontSize="small" />
        <Typography variant="h5" fontWeight={600} sx={{ flex: 1 }}>
          Agente de IA
        </Typography>
        {historial.length > 0 && (
          <Button size="small" startIcon={<RestartAltIcon />} onClick={nuevaConversacion} disabled={enviando}>
            Nueva conversación
          </Button>
        )}
      </Box>

      {!conectado && (
        <Alert severity="info" sx={{ mb: 2 }}>
          El agente aún no está conectado a un servidor en este entorno.
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          height: { xs: "calc(100vh - 260px)", md: "calc(100vh - 300px)" },
          minHeight: 380,
        }}
      >
        <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 1.5, sm: 2 } }} aria-live="polite">
          {historial.length === 0 && !enviando && (
            <Box sx={{ textAlign: "center", color: "text.secondary", mt: { xs: 3, sm: 6 }, px: 1 }}>
              <SmartToyOutlinedIcon sx={{ fontSize: 40, color: "primary.main", mb: 1 }} />
              <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                ¿En qué te ayudo hoy?
              </Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Puedo responder preguntas generales y consultar ingresos, egresos, nómina, cuentas por cobrar y por pagar, y servicios del taller.
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}>
                {EJEMPLOS.map((ejemplo) => (
                  <Chip key={ejemplo} label={ejemplo} variant="outlined" onClick={() => setTexto(ejemplo)} disabled={!conectado} />
                ))}
              </Box>
            </Box>
          )}

          {historial.map((mensaje, i) => (
            <MensajeAgente
              key={i}
              mensaje={mensaje}
              animar={i === animarIndice}
              alAvanzar={i === animarIndice ? seguirEscritura : undefined}
              alTerminarAnimacion={i === animarIndice ? terminarEscritura : undefined}
            />
          ))}

          {enviando && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", mb: 1.5 }} role="status">
              <CircularProgress size={16} />
              <Typography variant="body2">Pensando…</Typography>
            </Box>
          )}

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 1.5 }}
              action={
                historial.length > 0 && historial[historial.length - 1].rol === "usuario" ? (
                  <Button color="inherit" size="small" onClick={reintentar}>
                    Reintentar
                  </Button>
                ) : null
              }
            >
              {error}
            </Alert>
          )}
          <div ref={finRef} />
        </Box>

        <Divider />
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
          sx={{ display: "flex", alignItems: "flex-end", gap: 1, p: { xs: 1, sm: 1.5 } }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="Escribe tu pregunta…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            disabled={!conectado}
            inputProps={{ maxLength: LIMITES_AGENTE.caracteresMensaje, "aria-label": "Mensaje para el agente" }}
          />
          <IconButton
            type="submit"
            color="primary"
            aria-label="Enviar mensaje"
            disabled={!conectado || enviando || texto.trim() === ""}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Las cifras marcadas como «Datos de Turbinas App» vienen de la aplicación; el resto del texto es interpretación del modelo.
      </Typography>
    </Container>
  );
}

// Solo owner o admin. El backend vuelve a comprobar el rol en cada solicitud.
export default function AgenteIA() {
  const { isAdmin, isOwner, loadingAuth } = useAuth();
  if (loadingAuth) return null;
  if (!isAdmin && !isOwner) return <AccesoDenegado />;
  return (
    <Layout>
      <ChatAgente />
    </Layout>
  );
}
