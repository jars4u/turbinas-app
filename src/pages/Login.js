import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Paper, Typography, Box, Autocomplete } from "@mui/material";
import { loginUsuario, logoutUsuario, observarUsuario, obtenerUsuarios } from "../lib/usuariosFirebase";


const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = observarUsuario(setUsuarioActual);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Cargar usuarios registrados para el autocomplete
    obtenerUsuarios().then(us => setUsuarios(us.map(u => u.email)));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Usuario y clave requeridos");
      return;
    }
    try {
      await loginUsuario(username, password);
      setError("");
      navigate("/dashboard");
    } catch (err) {
      setError("Credenciales incorrectas o usuario no existe");
    }
  };


  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <Paper elevation={3} sx={{ p: 4, minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', m: 3 }}>
        <img src="/logo.png" alt="Logo" style={{ height: 48, marginBottom: 16 }} />
        <Typography variant="h5" fontWeight={600} mb={2} align="center">
          Iniciar sesión
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <Autocomplete
            options={usuarios}
            freeSolo
            value={username}
            onChange={(e, value) => setUsername(value || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Usuario"
                variant="outlined"
                fullWidth
                margin="normal"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
              />
            )}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Clave"
            variant="outlined"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {error && (
            <Typography color="error" variant="caption">{error}</Typography>
          )}
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
            Acceder
          </Button>
        </form>
        {usuarioActual && (
          <Button
            variant="outlined"
            color="secondary"
            fullWidth
            sx={{ mt: 2 }}
            onClick={async () => {
              await logoutUsuario();
              setUsername("");
              setPassword("");
              setError("");
              navigate("/login");
            }}
          >
            Cerrar sesión
          </Button>
        )}
      </Paper>
    </Box>
  );
};

export default Login;
