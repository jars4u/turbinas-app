import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import ServicioEditorDialog from "./ServicioEditorDialog";
import EstadoChangeDialog from "./EstadoChangeDialog";
import PaymentModal from "../PaymentModal";
import {
  crearVehiculo,
  actualizarVehiculo,
  eliminarVehiculo,
} from "../../lib/vehiculosFirebase";

// Sanitiza cualquier undefined en null, recursivamente
function sanitizeDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeDeep);
  } else if (obj && typeof obj === "object") {
    const newObj = {};
    Object.keys(obj).forEach((k) => {
      const val = obj[k];
      if (val === undefined) {
        newObj[k] = null;
      } else {
        newObj[k] = sanitizeDeep(val);
      }
    });
    return newObj;
  }
  return obj;
}

/**
 * Editor de servicios del Dashboard: estado del formulario, guardado, pago,
 * cambio de estado y eliminación, junto con sus diálogos.
 *
 * Vive separado del Dashboard para que escribir en el formulario (o abrir y
 * cerrar sus modales) solo re-renderice este componente y no la lista de
 * servicios. El Dashboard lo abre con `ref.current.abrir(vehiculo)`.
 */
const ServicioEditor = forwardRef(function ServicioEditor(
  {
    vehiculos,
    estadosServicio,
    clientes,
    usuarioActivo,
    isObserver,
    isXs,
    factorConversion,
    detalleFactor,
    notificar,
    onCreatingChange,
  },
  ref
) {
  const [actionLoading, setActionLoading] = useState(false);
  const [facturaOpen, setFacturaOpen] = useState(false);
  const [openEstadoModal, setOpenEstadoModal] = useState(false);
  const [vehiculoEstadoModal, setVehiculoEstadoModal] = useState(null);

  const [open, setOpen] = useState(false);
  // Estado para el modal de confirmación de eliminación
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [form, setForm] = useState({
    vehiculo: "",
    placa: "",
    servicio: "",
    precio: "",
    precioBs: "",
    customerName: "",
    customerPhone: "+58",
    observaciones: "",
  });
  const [formOriginal, setFormOriginal] = useState(null);
  const [editSection, setEditSection] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // Si hay precio en $, recalcular Bs cuando cambie el factor vigente.
  // Solo con el formulario cerrado, para no pisar lo que se esté escribiendo.
  useEffect(() => {
    if (!(factorConversion > 0) || open) return;
    setForm((prev) => {
      const p = parseFloat(prev?.precio);
      if (isNaN(p)) return prev;
      const bs = (p * factorConversion).toFixed(2);
      return prev?.precioBs === bs ? prev : { ...prev, precioBs: bs };
    });
  }, [factorConversion, open]);
  // Estado para controlar edición de todas las secciones al registrar
  const isRegistering = editId === null;

  const handleOpen = (vehiculo) => {
    if (isObserver) {
      notificar("Rol observador: no puedes registrar ni editar servicios.");
      return;
    }
    if (vehiculo) {
      const nuevoForm = {
        vehiculo: vehiculo.vehiculo || "",
        placa: vehiculo.placa || "",
        servicio: vehiculo.servicio || "",
        precio: vehiculo.precio || "",
        precioBs: vehiculo.precioBs || "",
        customerName: vehiculo.customerName || "",
        customerPhone: vehiculo.customerPhone || "+58",
        observaciones: vehiculo.observaciones || "",
      };
      setForm(nuevoForm);
      setFormOriginal(nuevoForm); // Guardar original
      setEditId(vehiculo.id);
      setEditSection(null);
      setIsEditing(false);
    } else {
      const nuevoForm = {
        vehiculo: "",
        placa: "",
        servicio: "",
        precio: "",
        precioBs: "",
        customerName: "",
        customerPhone: "+58",
        observaciones: "",
      };
      setForm(nuevoForm);
      setFormOriginal(nuevoForm);
      setEditId(null);
      setEditSection("vehiculo"); // Abrir directamente en modo edición
      setIsEditing(true);
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setForm({
      vehiculo: "",
      placa: "",
      servicio: "",
      precio: "",
      precioBs: "",
      customerName: "",
      customerPhone: "+58",
      observaciones: "",
    });
    setFormOriginal(null);
    setEditId(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const f = parseFloat(factorConversion);
    if (name === "precio") {
      const p = parseFloat(value);
      let nuevoPrecioBs = "";
      if (!isNaN(p) && !isNaN(f) && f > 0) {
        nuevoPrecioBs = (p * f).toFixed(2);
      }
      setForm({ ...form, precio: value, precioBs: nuevoPrecioBs });
    } else if (name === "precioBs") {
      const bs = parseFloat(value);
      let nuevoPrecio = "";
      if (!isNaN(bs) && !isNaN(f) && f > 0) {
        nuevoPrecio = (bs / f).toFixed(2);
      }
      setForm({ ...form, precioBs: value, precio: nuevoPrecio });
    } else {
      setForm({ ...form, [name]: value });
    }
    setIsEditing(true);
  };

  const getDefaultStatus = () => {
    const def = estadosServicio.find((e) => e.defaultEstado);
    return def ? def.nombre : "servicio";
  };

  const handleSave = async () => {
    if (isObserver) {
      notificar("Rol observador: no puedes guardar cambios.");
      return;
    }

    // Bloquear edición si el servicio está cerrado (estado defaultFacturar)
    if (editId) {
      const estadoFacturar = estadosServicio.find((e) => e.defaultFacturar)?.nombre;
      const vehiculoActual = vehiculos.find((v) => v.id === editId);
      const estadoActual = vehiculoActual?.status || vehiculoActual?.estado;
      if (estadoFacturar && estadoActual === estadoFacturar) {
        const labelFacturar = estadosServicio.find((e) => e.defaultFacturar)?.label || estadoFacturar;
        notificar(`Este servicio está cerrado (${labelFacturar}) y no puede editarse.`);
        return;
      }
    }

    // Validación y normalización del teléfono: formato +58 seguido de 10 dígitos, sin ceros iniciales
    let telefono = (form.customerPhone || "").trim();
    telefono = telefono.replace(/[-\s]/g, "");
    if (telefono) {
      // Si no empieza con +58, intentar normalizar de formatos comunes (0412..., 412..., etc)
      if (!telefono.startsWith("+58")) {
        if (telefono.startsWith("58")) {
          telefono = "+" + telefono;
        } else if (telefono.startsWith("0") && telefono.length >= 11) {
          telefono = "+58" + telefono.slice(1); // quita el 0 inicial
        } else if (/^\d{10}$/.test(telefono)) {
          telefono = "+58" + telefono;
        }
      }
      // Asegurar que no haya ceros iniciales en la parte local después de +58
      if (telefono.startsWith("+58")) {
        const local = telefono.slice(3).replace(/[^\d]/g, "");
        telefono = "+58" + local.replace(/^0+/, "");
      }
      // Validar finalmente el patrón requerido
      if (!/^\+58\d{10}$/.test(telefono)) {
        notificar("Teléfono inválido: use +58 y 10 dígitos sin ceros iniciales.");
        return;
      }
    }
    const vehiculoData = {
      vehiculo: form.vehiculo ? form.vehiculo.toUpperCase() : "",
      placa: form.placa ? form.placa.toUpperCase() : "",
      servicio: form.servicio ? form.servicio.toUpperCase() : "",
      arrivalTime: editId
        ? vehiculos.find((v) => v.id === editId)?.arrivalTime
        : Date.now(),
      customerName: form.customerName ? form.customerName.toUpperCase() : "",
      customerPhone: telefono || "",
      observaciones: form.observaciones ? form.observaciones.toUpperCase() : "",
      status: editId
        ? vehiculos.find((v) => v.id === editId)?.status || getDefaultStatus()
        : getDefaultStatus(),
      precio: form.precio === "" ? null : Number(form.precio),
      precioBs: form.precioBs === "" ? null : Number(form.precioBs),
      monto2:
        form.precio !== undefined && form.precio !== "" && form.precio !== null
          ? Number(form.precio)
          : null,
      usuario: usuarioActivo,
      registradoPor: usuarioActivo,
      entregadoPor: editId
        ? vehiculos.find((v) => v.id === editId)?.entregadoPor
        : null,
      fechaEntrega: editId
        ? vehiculos.find((v) => v.id === editId)?.fechaEntrega
        : null,
    };
  setActionLoading(true);
  if (!editId) onCreatingChange(true);
    // Limpiar campos undefined
    Object.keys(vehiculoData).forEach((k) => {
      if (vehiculoData[k] === undefined) vehiculoData[k] = null;
    });
    // Guardar el servicio en el historial del cliente (colección 'clientes').
    // Corre en paralelo con el guardado del vehículo y nunca bloquea el registro.
    const registrarEnCliente = async () => {
      try {
        const nombreCliente = vehiculoData.customerName?.trim().toUpperCase();
        const telefonoCliente = vehiculoData.customerPhone?.trim();
        if (!nombreCliente) return;
        const { getFirestore, collection, getDocs, query, where, addDoc, updateDoc, doc } = await import("firebase/firestore");
        const db = getFirestore();
        const clientesRef = collection(db, "clientes");
        if (telefonoCliente) {
          const q = query(clientesRef, where("nombre", "==", nombreCliente), where("telefono", "==", telefonoCliente));
          const snapshot = await getDocs(q);
          // Nuevo registro de modelo/servicio
          const nuevoModeloServicio = {
            fecha: Date.now(),
            modelo: vehiculoData.vehiculo,
            servicio: vehiculoData.servicio,
            nombre: nombreCliente,
            telefono: telefonoCliente
          };
          if (snapshot.empty) {
            await addDoc(clientesRef, {
              nombre: nombreCliente,
              telefono: telefonoCliente,
              modelosServicios: [nuevoModeloServicio]
            });
          } else {
            // Actualizar el historial del cliente existente
            const clienteDoc = snapshot.docs[0];
            const modelosServiciosPrevios = clienteDoc.data().modelosServicios || [];
            await updateDoc(doc(db, "clientes", clienteDoc.id), {
              modelosServicios: [...modelosServiciosPrevios, nuevoModeloServicio]
            });
          }
        } else if (!editId) {
          // Sin teléfono: al crear, anexar al cliente existente con ese nombre (si lo hay)
          const snapshot = await getDocs(query(clientesRef, where("nombre", "==", nombreCliente)));
          if (!snapshot.empty) {
            const clienteDoc = snapshot.docs[0];
            const actualizados = [
              ...(clienteDoc.data().modelosServicios || []),
              { modelo: vehiculoData.vehiculo || "", servicio: vehiculoData.servicio || "", fecha: vehiculoData.arrivalTime || "" },
            ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            await updateDoc(doc(db, "clientes", clienteDoc.id), { modelosServicios: actualizados });
          }
        }
      } catch (e) {
        // No bloquear el registro si falla el guardado del cliente
      }
    };
    // El listener de vehículos actualiza la lista solo: no se recarga la colección
    try {
      if (editId) {
        await Promise.all([actualizarVehiculo(editId, vehiculoData), registrarEnCliente()]);
      } else {
        // CREACIÓN NUEVA: ocultamos inmediatamente el skeleton de la lista y mantenemos el overlay del modal
        onCreatingChange(false); // oculta skeleton ANTES de que aparezca el nuevo card
        await Promise.all([crearVehiculo(vehiculoData), registrarEnCliente()]);
      }
    } catch (e) {
      onCreatingChange(false);
      setActionLoading(false);
      notificar("Error al guardar el servicio. Intente nuevamente.");
      return;
    }
    setActionLoading(false);
    setOpen(false);
    setEditSection(null);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (isObserver) {
      notificar("Rol observador: no puedes eliminar servicios.");
      return;
    }
    if (!editId) {
      notificar("No se pudo eliminar: servicio no válido.");
      return;
    }

    // Bloquear eliminación si el servicio está cerrado (estado defaultFacturar)
    {
      const estadoFacturar = estadosServicio.find((e) => e.defaultFacturar)?.nombre;
      const vehiculoActual = vehiculos.find((v) => v.id === editId);
      const estadoActual = vehiculoActual?.status || vehiculoActual?.estado;
      if (estadoFacturar && estadoActual === estadoFacturar) {
        const labelFacturar = estadosServicio.find((e) => e.defaultFacturar)?.label || estadoFacturar;
        notificar(`Este servicio está cerrado (${labelFacturar}) y no puede eliminarse.`);
        return;
      }
    }

    setActionLoading(true);
    try {
      await eliminarVehiculo(editId);
      setActionLoading(false);
      handleClose();
      setConfirmDeleteOpen(false);
    } catch (e) {
      setActionLoading(false);
      notificar("Error al eliminar el servicio. Intente nuevamente.");
    }
  };

  // Abrir modal de confirmación
  const handleDeleteClick = () => {
    setConfirmDeleteOpen(true);
  };

  // Cancelar eliminación
  const handleCancelDelete = () => {
    setConfirmDeleteOpen(false);
  };

  useImperativeHandle(ref, () => ({ abrir: (vehiculo) => handleOpen(vehiculo) }));

  return (
    <>
        <ServicioEditorDialog
          open={open}
          isXs={isXs}
          onDialogClose={(event, reason) => {
            if (reason === "backdropClick" || reason === "escapeKeyDown") return;
            handleClose();
          }}
          actionLoading={actionLoading}
          editId={editId}
          onDeleteClick={handleDeleteClick}
          onClose={handleClose}
          estadoActual={(() => {
            const v = vehiculos.find((x) => x.id === editId);
            return estadosServicio.find(
              (e) => e.nombre === (v?.status || v?.estado)
            );
          })()}
          vehiculoActual={vehiculos.find((v) => v.id === editId)}
          chipColor={(() => {
            const v = vehiculos.find((x) => x.id === editId);
            const est = estadosServicio.find(
              (e) => e.nombre === (v?.status || v?.estado)
            );
            const validColors = [
              "default",
              "primary",
              "secondary",
              "error",
              "info",
              "success",
              "warning",
            ];
            return validColors.includes(est?.color) ? est?.color : "default";
          })()}
          onOpenEstadoModal={() => {
            const v = vehiculos.find((x) => x.id === editId);
            setVehiculoEstadoModal(v);
            setOpenEstadoModal(true);
          }}
          confirmDeleteOpen={confirmDeleteOpen}
          onCancelDelete={handleCancelDelete}
          onConfirmDelete={handleDelete}
          form={form}
          onChange={handleChange}
          editSection={editSection}
          setEditSection={setEditSection}
          isRegistering={isRegistering}
          clientes={clientes}
          onClienteInputChange={(e, newInputValue, reason) => {
            if (reason === "input") {
              setForm((prev) => ({ ...prev, customerName: newInputValue }));
              setIsEditing(true);
            }
          }}
          onClienteChange={(e, value) => {
            if (value && value.nombre) {
              setForm((prev) => ({
                ...prev,
                customerName: value.nombre,
                customerPhone: value.telefono,
              }));
              setIsEditing(true);
            }
          }}
          onCustomerPhoneChange={(e) => {
            let value = e.target.value;
            if (!value.startsWith("+58")) {
              value = "+58" + value.replace(/^0+/, "");
            }
            value = value.replace(/^\+58/, "+58");
            const soloNumeros = value.slice(3).replace(/[^\d]/g, "");
            value = "+58" + soloNumeros;
            setForm((prev) => ({ ...prev, customerPhone: value }));
            setIsEditing(true);
          }}
          isEditing={isEditing}
          onSave={handleSave}
          onCancelEditSection={() => {
            if (formOriginal) {
              setForm(formOriginal);
            }
            setEditSection(null);
            setIsEditing(false);
          }}
          onRegisterSave={() => {
            handleSave();
            setOpen(false);
            setEditSection(null);
            setIsEditing(false);
          }}
          onWhatsAppSend={() => {
            if (form.customerPhone) {
              let phone = form.customerPhone.trim();
              phone = phone.replace(/[-\s]/g, "");
              phone = phone.replace(/^\+/, "");
              if (phone.startsWith("58")) {
              } else if (phone.startsWith("0")) {
                phone = "58" + phone.slice(1);
              }
              window.open(`https://wa.me/${phone}`, "_blank");
            }
          }}
          onPorCobrar={async () => {
            const { crearCuentaPorCobrar } = await import("../../lib/cuentasPorCobrarFirebase");
            // La fecha del servicio (creación original) debe preservarse tal
            // cual: no se sustituye por el momento en que se envía a cuentas
            // por cobrar, para no perder la antigüedad real de la deuda.
            const fechaServicioOriginal = editId
              ? vehiculos.find((v) => v.id === editId)?.arrivalTime || Date.now()
              : Date.now();
            await crearCuentaPorCobrar({
              vehiculoId: editId || null,
              vehiculo: form.vehiculo,
              placa: form.placa,
              servicio: form.servicio,
              precio: form.precio,
              precioBs: form.precioBs,
              observaciones: form.observaciones,
              customerName: form.customerName,
              customerPhone: form.customerPhone,
              fechaRegistro: fechaServicioOriginal,
              arrivalTime: fechaServicioOriginal,
            });
            try {
              if (editId) {
                const vehiculoActual = vehiculos.find(v => v.id === editId);
                if (vehiculoActual) {
                  const data = sanitizeDeep({ ...vehiculoActual, status: 'por_cobrar' });
                  await actualizarVehiculo(editId, data);
                } else {
                  await actualizarVehiculo(editId, { status: 'por_cobrar' });
                }
              }
            } catch (e) {
              console.error('Error actualizando estado a por_cobrar:', e);
            }
            notificar('Servicio enviado a cuentas por cobrar');
            setOpen(false);
          }}
          porCobrarDisabled={(() => {
            const estadoFact = estadosServicio.find(e => e.defaultFacturar)?.nombre;
            const vehiculoActual = vehiculos.find(v => v.id === editId);
            const actual = vehiculoActual?.status || vehiculoActual?.estado;
            if (!actual) return false;
            return (estadoFact && actual === estadoFact) || actual === 'por_cobrar';
          })()}
          porCobrarTitle={(() => {
            const estadoFactObj = estadosServicio.find(e => e.defaultFacturar);
            const estadoFact = estadoFactObj?.nombre;
            const vehiculoActual = vehiculos.find(v => v.id === editId);
            const actual = vehiculoActual?.status || vehiculoActual?.estado;
            if (!actual) return undefined;
            if (estadoFact && actual === estadoFact) {
              return `Este servicio ya está en estado "${estadoFactObj?.label || estadoFact}" y no puede ir a Por Cobrar`;
            }
            if (actual === 'por_cobrar') {
              return 'Este servicio ya está en Por Cobrar';
            }
            return undefined;
          })()}
          onOpenFactura={() => setFacturaOpen(true)}
          facturarDisabled={(() => {
            const estadoFact = estadosServicio.find(e => e.defaultFacturar)?.nombre;
            if (!estadoFact) return false;
            const vehiculoActual = vehiculos.find(v => v.id === editId);
            const actual = vehiculoActual?.status || vehiculoActual?.estado;
            return actual === estadoFact;
          })()}
          facturarTitle={(() => {
            const estadoFact = estadosServicio.find(e => e.defaultFacturar)?.label || estadosServicio.find(e => e.defaultFacturar)?.nombre;
            const vehiculoActual = vehiculos.find(v => v.id === editId);
            const actual = vehiculoActual?.status || vehiculoActual?.estado;
            return actual && estadoFact && actual === (estadosServicio.find(e => e.defaultFacturar)?.nombre)
              ? 'Este servicio ya está en el estado final de facturación'
              : undefined;
          })()}
        />
        <PaymentModal
          open={facturaOpen}
          onClose={() => setFacturaOpen(false)}
          form={form}
          onRegister={async (facturaData) => {
            if (isObserver) {
              notificar("Rol observador: no puedes registrar pagos.");
              return;
            }
            // Validar que exista al menos un precio
            if (
              (form.precio === "" || form.precio === null) &&
              (form.precioBs === "" || form.precioBs === null)
            ) {
              notificar(
                "No se ha definido un precio para este servicio. No se puede registrar el pago."
              );
              return;
            }
            let nuevoIngreso = {
              descripcion: `${form.vehiculo} - ${form.servicio}`,
              factura: facturaData.numeroFactura,
              fecha: new Date().toLocaleDateString("es-VE"),
              vehiculoId: editId || null,
              customerName: form.customerName ? String(form.customerName).toUpperCase() : undefined,
              customerPhone: form.customerPhone || undefined,
              montoBs:
                form.precioBs !== undefined &&
                  form.precioBs !== "" &&
                  form.precioBs !== null
                  ? Number(form.precioBs)
                  : null,
              monto2:
                form.precio !== undefined &&
                  form.precio !== "" &&
                  form.precio !== null
                  ? Number(form.precio)
                  : null,
            };
            nuevoIngreso.monto2 =
              form.precio !== undefined &&
                form.precio !== "" &&
                form.precio !== null
                ? Number(form.precio)
                : null;
            if (
              Array.isArray(facturaData.formasPago) &&
              facturaData.formasPago.length > 0
            ) {
              nuevoIngreso.formasPago = facturaData.formasPago;
            } else {
              let monto =
                facturaData.monto !== undefined &&
                  facturaData.monto !== null &&
                  facturaData.monto !== ""
                  ? Number(facturaData.monto)
                  : facturaData.formaPago &&
                    /pago[ _-]?movil/i.test(facturaData.formaPago)
                    ? Number(form.precioBs) || 0
                    : facturaData.formaPago &&
                      (/zelle/i.test(facturaData.formaPago) || /efectivo/i.test(facturaData.formaPago) || /binance/i.test(facturaData.formaPago))
                      ? Number(form.precio) || 0
                      : Number(form.precio) || Number(form.precioBs) || 0;
              nuevoIngreso.monto = monto;
              nuevoIngreso.formaPago = facturaData.formaPago;
              nuevoIngreso.referencia = facturaData.referencia;
            }
            try {
              const { guardarIngreso } = await import("../../lib/ingresosFirebase");
              // Se reutiliza el factor ya cargado; si aún no cargó, guardarIngreso lo resuelve
              await guardarIngreso(nuevoIngreso, { factor: detalleFactor?.factor });
            } catch (e) {
              notificar("Error al registrar el ingreso");
              return;
            }
            if (editId) {
              const estadoFacturar = estadosServicio.find((e) => e.defaultFacturar);
              const statusFacturar = estadoFacturar ? estadoFacturar.nombre : "entregado";
              const vehiculoUpdate = {
                ...form,
                status: statusFacturar,
                entregadoPor: (usuarioActivo ? String(usuarioActivo).split('@')[0] : null),
                fechaEntrega: Date.now(),
                registradoPor:
                  vehiculos.find((v) => v.id === editId)?.registradoPor ||
                  vehiculos.find((v) => v.id === editId)?.usuario ||
                  null,
                precioBs: Number(form.precioBs) || null,
              };
              Object.keys(vehiculoUpdate).forEach((k) => {
                if (vehiculoUpdate[k] === undefined) vehiculoUpdate[k] = null;
              });
              await actualizarVehiculo(editId, vehiculoUpdate);
            }
            notificar("Pago registrado exitosamente");
            setOpen(false);
          }}
        />
          {/* Modal para cambiar estado extraído */}
          <EstadoChangeDialog
            open={openEstadoModal}
            onClose={() => setOpenEstadoModal(false)}
            estados={estadosServicio}
            vehiculo={vehiculoEstadoModal}
            onApplyEstado={async (estado, { ocultar }) => {
              if (isObserver) {
                notificar("Rol observador: no puedes cambiar estados.");
                return;
              }
              if (!vehiculoEstadoModal) return;

              const data = sanitizeDeep({
                ...vehiculoEstadoModal,
                status: estado.nombre,
                ...(ocultar
                  ? {
                      fechaEntrega: Date.now(),
                      entregadoPor: usuarioActivo
                        ? String(usuarioActivo).split("@")[0]
                        : null,
                    }
                  : {}),
              });
              await actualizarVehiculo(vehiculoEstadoModal.id, data);

              // Si se confirmó un estado que oculta el servicio, cerrar también el dialogo
              // de información/edición del servicio (ya no tiene sentido mantenerlo abierto).
              if (ocultar) {
                setOpenEstadoModal(false);
                handleClose();
              }
            }}
          />
    </>
  );
});

export default React.memo(ServicioEditor);
