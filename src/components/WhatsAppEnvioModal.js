import React, { useState, useEffect } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Select, Box, Typography, Popper, Paper, ClickAwayListener, List, ListItem } from "@mui/material";
import { obtenerClientes } from "../lib/clientesFirebase";
import { obtenerPlantillas } from "../lib/plantillasFirebase";

export default function WhatsAppEnvioModal({ open, onClose, plantillaDefault }) {
    const [clientes, setClientes] = useState([]);
    const [searchCliente, setSearchCliente] = useState("");
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [plantillas, setPlantillas] = useState([]);
    const [clienteId, setClienteId] = useState("");
    const [plantillaId, setPlantillaId] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            const clientesData = await obtenerClientes();
            const plantillasData = await obtenerPlantillas();
            setClientes(clientesData);
            setPlantillas(plantillasData);
            setLoading(false);
            // Selección por defecto
            if (plantillaDefault) {
                setPlantillaId(plantillaDefault.id);
                setMensaje(plantillaDefault.mensaje);
            } else if (plantillasData.length > 0) {
                setPlantillaId(plantillasData[0].id);
                setMensaje(plantillasData[0].mensaje);
            }
        }
        if (open) fetchData();
    }, [open, plantillaDefault, setPlantillaId, setMensaje]);

    useEffect(() => {
        // Actualiza el mensaje al cambiar plantilla
        const plantilla = plantillas.find(p => p.id === plantillaId);
        if (plantilla) setMensaje(plantilla.mensaje);
    }, [plantillaId, plantillas]);

    const handlePlantillaChange = (e) => {
        setPlantillaId(e.target.value);
    };

    const getMensajePersonalizado = () => {
        const cliente = clientes.find(c => c.id === clienteId);
        if (!cliente) return mensaje;
        return mensaje.replace(/\{nombre\}/g, cliente.nombre);
    };

    const handleEnviar = () => {
        const cliente = clientes.find(c => c.id === clienteId);
        if (!cliente) return;
        const mensajeFinal = encodeURIComponent(getMensajePersonalizado());
        let telefono = cliente.telefono.replace(/[^\d]/g, "");
        let url = "";
        if (telefono.startsWith("58") && telefono.length >= 12) {
            url = `https://wa.me/${telefono}?text=${mensajeFinal}`;
        } else if (telefono.length >= 10) {
            url = `https://wa.me/${telefono}?text=${mensajeFinal}`;
        }
        if (url) window.open(url, '_blank');
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Enviar WhatsApp</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Typography>Cargando...</Typography>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <Box sx={{ mb: 2 }}>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={e => {
                                    setAnchorEl(e.currentTarget);
                                    setMenuOpen(true);
                                }}
                                sx={{ justifyContent: 'flex-start' }}
                            >
                                {clienteId ? `${clientes.find(c => c.id === clienteId)?.nombre || "Cliente"}` : "Selecciona un cliente"}
                            </Button>
                            <Popper open={menuOpen} anchorEl={anchorEl} placement="bottom-start" style={{ zIndex: 1300 }}>
                                <Paper sx={{ minWidth: 300 }}>
                                    <ClickAwayListener onClickAway={() => setMenuOpen(false)}>
                                        <Box>
                                            <TextField
                                                size="small"
                                                placeholder="Buscar cliente..."
                                                value={searchCliente}
                                                onChange={e => setSearchCliente(e.target.value)}
                                                sx={{ m: 1, width: '95%' }}
                                                autoFocus
                                            />
                                            <List sx={{ maxHeight: 220, overflowY: 'auto' }}>
                                                {clientes.filter(c =>
                                                    c.nombre.toLowerCase().includes(searchCliente.toLowerCase()) ||
                                                    c.telefono.toLowerCase().includes(searchCliente.toLowerCase())
                                                ).map(c => (
                                                    <ListItem button key={c.id} onClick={() => {
                                                        setClienteId(c.id);
                                                        setMenuOpen(false);
                                                    }}>
                                                        {c.nombre} ({c.telefono})
                                                    </ListItem>
                                                ))}
                                                {clientes.filter(c =>
                                                    c.nombre.toLowerCase().includes(searchCliente.toLowerCase()) ||
                                                    c.telefono.toLowerCase().includes(searchCliente.toLowerCase())
                                                ).length === 0 && (
                                                        <ListItem disabled>No hay resultados</ListItem>
                                                    )}
                                            </List>
                                        </Box>
                                    </ClickAwayListener>
                                </Paper>
                            </Popper>
                        </Box>
                        <Select
                            value={plantillaId}
                            onChange={handlePlantillaChange}
                            displayEmpty
                            fullWidth
                            sx={{ mb: 2 }}
                        >
                            <MenuItem value="" disabled>Selecciona una plantilla</MenuItem>
                            {plantillas.map(p => (
                                <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                            ))}
                        </Select>
                        <TextField
                            label="Mensaje"
                            multiline
                            minRows={3}
                            value={getMensajePersonalizado()}
                            onChange={e => setMensaje(e.target.value)}
                            fullWidth
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">Cancelar</Button>
                <Button
                    variant="contained"
                    color="success"
                    disabled={!clienteId || !plantillaId || !getMensajePersonalizado().trim()}
                    onClick={handleEnviar}
                >Enviar WhatsApp</Button>
            </DialogActions>
        </Dialog>
    );
}
