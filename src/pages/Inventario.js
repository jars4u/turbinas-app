import React from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  setDoc,
  doc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { Box, Divider, Container, Button, Tabs, Tab, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import ResumenInventario from "../components/ResumenInventario";

export default function Inventario() {
  const [tab, setTab] = React.useState(0);
  const [inventario, setInventario] = React.useState([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [nuevoItem, setNuevoItem] = React.useState({
    descripcion: "",
    cantidad: "",
    modelo: "",
  });
  const [editandoItem, setEditandoItem] = React.useState(null);
  const navigate = useNavigate();

  // Sincronización en tiempo real con Firestore
  React.useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "inventario"),
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setInventario(items);
      },
      (err) => {
        console.error("Error en tiempo real inventario:", err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Generar un ID único (Firestore lo genera, pero para mostrar en el modal)
  function generarId() {
    return "A" + (inventario.length + 1).toString().padStart(3, "0");
  }

  // Abrir modal para agregar
  function abrirModalAgregar() {
    setEditandoItem(null);
    setNuevoItem({ descripcion: "", cantidad: "", modelo: "" });
    setModalOpen(true);
  }

  // Agregar item a Firestore
  async function handleAgregarItem() {
    try {
      const cantidad = Number(nuevoItem.cantidad) || 0;
      // Generar código simple tipo A001, A002...
      const codigo = "A" + (inventario.length + 1).toString().padStart(3, "0");
      const item = {
        modelo: nuevoItem.modelo || "",
        descripcion: nuevoItem.descripcion,
        deposito: nuevoItem.deposito || "",
        cantidad,
        codigo,
      };
      await addDoc(collection(db, "inventario"), item);
      setNuevoItem({ descripcion: "", cantidad: "", modelo: "" }); // Limpiar campos pero mantener modal abierto
    } catch (err) {
      console.error("Error al agregar item:", err);
    }
  }

  // Abrir modal para editar
  function handleEditarItem(item) {
    setEditandoItem(item);
    setNuevoItem({
      modelo: item.modelo || "",
      descripcion: item.descripcion,
      cantidad: item.cantidad,
    });
    setModalOpen(true);
  }

  // Guardar edición en Firestore
  async function handleGuardarEdicion() {
    if (!editandoItem) return;
    try {
      const cantidad = Number(nuevoItem.cantidad) || 0;
      const itemActualizado = {
        modelo: nuevoItem.modelo || "",
        descripcion: nuevoItem.descripcion,
        deposito: nuevoItem.deposito || "",
        cantidad,
        codigo: editandoItem.codigo, // Mantener el código original
      };
      await setDoc(doc(db, "inventario", editandoItem.id), itemActualizado);
      setEditandoItem(null);
      setModalOpen(false);
      setNuevoItem({ descripcion: "", cantidad: "", modelo: "" });
    } catch (err) {
      console.error("Error al editar item:", err);
    }
  }

  // Eliminar item de Firestore
  async function handleEliminarItem(id) {
    try {
      await deleteDoc(doc(db, "inventario", id));
    } catch (err) {
      console.error("Error al eliminar item:", err);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, px: { xs: 1, md: 6 } }}>
      <Button
        variant="text"
        startIcon={<ArrowBackIcon />}
        size="small"
        sx={{ mb: 2 }}
        onClick={() => navigate("/dashboard")}
      >
        Atrás
      </Button>
      <Typography variant="h4" gutterBottom>
        <span style={{ fontWeight: 600 }}>Inventario</span>
      </Typography>{" "}
      <Divider sx={{ mb: 2 }} />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Resumen" />
      </Tabs>
      {tab === 0 && (
        <ResumenInventario
          inventario={inventario}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          abrirModalAgregar={abrirModalAgregar}
          nuevoItem={nuevoItem}
          setNuevoItem={setNuevoItem}
          generarId={generarId}
          handleAgregarItem={handleAgregarItem}
          onEditarItem={handleEditarItem}
          onEliminarItem={handleEliminarItem}
          editandoItem={editandoItem}
          handleGuardarEdicion={handleGuardarEdicion}
        />
      )}
    </Container>
  );
}
