import React from "react";
import { Box, Typography, Divider, Container, Button, Tabs, Tab } from "@mui/material";
import TextField from "@mui/material/TextField";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import MovimientosInventario from "../components/MovimientosInventario";
import ResumenInventario from "../components/ResumenInventario";

export default function Inventario() {
    const [tab, setTab] = React.useState(0);
  const navigate = useNavigate();
     const [inventario, setInventario] = React.useState([]);
     const [movimientos, setMovimientos] = React.useState([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [nuevoItem, setNuevoItem] = React.useState({ descripcion: '', cantidad: '' });
  function generarId() {
    return 'A' + (inventario.length + 1).toString().padStart(3, '0');
  }
  function handleAgregarItem() {
    const id = generarId();
    const cantidad = Number(nuevoItem.cantidad) || 0;
    setInventario([...inventario, { id, descripcion: nuevoItem.descripcion, cantidad }]);
    setModalOpen(false);
    setNuevoItem({ descripcion: '', cantidad: '' });
  }

   // Consulta Firestore para obtener movimientos de inventario
   React.useEffect(() => {
     async function fetchMovimientos() {
       try {
         const { db } = await import('../firebase');
         const { collection, getDocs } = await import('firebase/firestore');
         const snapshot = await getDocs(collection(db, 'movimientosInventario'));
         const movs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         setMovimientos(movs);
       } catch (err) {
         console.error('Error al obtener movimientos:', err);
       }
     }
     fetchMovimientos();
   }, []);

   // Calcular inventario actual por item a partir de los movimientos
   React.useEffect(() => {
     // Agrupar movimientos por item
     const resumen = {};
     movimientos.forEach(mov => {
       const id = mov.itemId || mov.item || mov.id;
       if (!resumen[id]) {
         resumen[id] = {
           id,
           descripcion: mov.descripcion || '',
           cantidad: 0
         };
       }
       // Sumar o restar cantidad según tipo de movimiento
       if (mov.movimiento === 'entrada') {
         resumen[id].cantidad += Number(mov.cantidad) || 0;
       } else if (mov.movimiento === 'salida') {
         resumen[id].cantidad -= Number(mov.cantidad) || 0;
       }
       resumen[id].descripcion = mov.descripcion || resumen[id].descripcion;
     });
     setInventario(Object.values(resumen));
   }, [movimientos]);
return (
    <Container maxWidth="xl" sx={{ mt: 4, px: { xs: 1, md: 6 } }}>
        <Button
            variant="text"
            startIcon={<ArrowBackIcon />}
            size="small"
            sx={{ mb: 2 }}
            onClick={() => navigate(-1)}
        >
            Atrás
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Inventory2OutlinedIcon sx={{ fontSize: 28, mr: 1 }} />
            <Typography
                variant="h5"
                fontWeight={700}
                sx={{ fontFamily: "inherit", fontWeight: 900 }}
            >
                Inventario
            </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
            <Tab label="Resumen" />
            <Tab label="Movimientos" />
        </Tabs>
        {tab === 0 && (
          <ResumenInventario
            inventario={inventario}
            modalOpen={modalOpen}
            setModalOpen={setModalOpen}
            nuevoItem={nuevoItem}
            setNuevoItem={setNuevoItem}
            generarId={generarId}
            handleAgregarItem={handleAgregarItem}
          />
        )}
      {tab === 1 && (
        <MovimientosInventario movimientos={movimientos} inventario={inventario} />
      )}
    </Container>
);
}
