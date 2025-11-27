import GroupIcon from "@mui/icons-material/Group";
import MessageIcon from '@mui/icons-material/Message';
import PlantillaMensajes from "../components/PlantillaMensajes";
import ClientesGestion from "../components/ClientesGestion";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Container,
  Typography,
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Divider,
} from "@mui/material";
import BadgeIcon from '@mui/icons-material/Badge';
import SettingsIcon from "@mui/icons-material/Settings";
import WorkIcon from "@mui/icons-material/Work";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import EstadosServicios from "./EstadosServicios";
import FactorConversionPrecios from "../components/FactorConversionPrecios";
import NominaEmpleados from "../components/NominaEmpleados";
import ConfiguracionCajaChica from "../components/ConfiguracionCajaChica";
import ConfiguracionReporte from "../components/ConfiguracionReporte";
import UsuariosGestion from "../components/UsuariosGestion";


export default function Configuracion() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedSection, setSelectedSection] = useState(() => {
    return localStorage.getItem('configSelectedSection') || 'usuarios';
  });
  const menuItems = [
    { key: 'usuarios', label: 'Usuarios', icon: <BadgeIcon /> },
    { key: 'clientes', label: 'Contactos', icon: <GroupIcon /> },
    { key: 'estados', label: 'Estados de Servicio', icon: <SettingsIcon /> },
    // { key: 'reporte', label: 'Reporte del día', icon: <AssignmentIcon /> },
    { key: 'nomina', label: 'Nómina', icon: <WorkIcon /> },
    { key: 'caja', label: 'Caja Chica', icon: <AccountBalanceWalletIcon /> },
    { key: 'factor', label: 'Factor de Conversión', icon: <PriceChangeIcon /> },
    { key: 'plantillas', label: 'Plantilla de Mensajes', icon: <MessageIcon /> },
  ];

  // Guardar la sección seleccionada en localStorage
  const handleSectionChange = (key) => {
    setSelectedSection(key);
    localStorage.setItem('configSelectedSection', key);
  };
  // Renderiza el contenido según la sección seleccionada
  const renderSection = () => {
    switch (selectedSection) {
      case 'usuarios':
        return <UsuariosGestion />;
      case 'clientes':
        return <ClientesGestion />;
      case 'estados':
        return <EstadosServicios />;
      case 'reporte':
        return <ConfiguracionReporte />;
      case 'nomina':
        return <NominaEmpleados />;
      case 'caja':
        return <ConfiguracionCajaChica />;
      case 'factor':
        return <FactorConversionPrecios />;
      case 'plantillas':
        return <PlantillaMensajes />;
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 6 }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate("/dashboard")}
      >
        Atrás
      </Button>
      <Typography variant="h4" gutterBottom sx={{ mb: { xs: 2, md: 3 } }}>
        <span style={{ fontWeight: 600 }}>Configuración</span>
      </Typography>
      {isAdmin ? (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mt: 4 }}>
          {/* Navegación móvil (tabs horizontales) */}
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              position: 'sticky',
              top: 0,
              zIndex: 10,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 1,
              mb: 2,
            }}
          >
            <Tabs
              value={selectedSection}
              onChange={(e, val) => handleSectionChange(val)}
              variant="scrollable"
              allowScrollButtons="auto"
              aria-label="Secciones de configuración"
              sx={{ minHeight: 48 }}
            >
              {menuItems.map(item => (
                <Tab
                  key={item.key}
                  value={item.key}
                  icon={item.icon}
                  iconPosition="start"
                  label={<span style={{ fontSize: 12 }}>{item.label}</span>}
                  sx={{
                    minHeight: 48,
                    alignItems: 'center',
                    px: 2,
                    '& .MuiTab-iconWrapper': { mr: 1 },
                  }}
                />
              ))}
            </Tabs>
            <Divider sx={{ mt: 0 }} />
          </Box>
          {/* Menú lateral desktop (sin cambios) */}
          <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 220, maxWidth: 260, borderRight: { md: '1px solid #eee' }, pr: { md: 3 }, mb: { xs: 2, md: 0 }, bgcolor: { md: '#f7f7fa' } }}>
            <List>
              {menuItems.map((item) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={selectedSection === item.key}
                    onClick={() => handleSectionChange(item.key)}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
          {/* Área de contenido dinámico */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {renderSection()}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            mt: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <img
            src="/animaciones/User%20Authentication.gif"
            alt="Sin permisos de administrador"
            style={{ maxWidth: 220, marginBottom: 16 }}
          />
          <Typography variant="body1" align="center" px={{ xs: 2, md: 15 }}>
            No tienes permisos de administrador para acceder a la configuración,
            contacta a un administrador o solicita acceso.
          </Typography>
        </Box>
      )}
    </Container>
  );
}
