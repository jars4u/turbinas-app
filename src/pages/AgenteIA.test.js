/* Página del agente: acceso por rol, conversación, datos de la app y errores del backend */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AgenteIA from "./AgenteIA";
import { useAuth } from "../context/AuthContext";
import { enviarConversacion, urlAgente, ErrorAgente } from "../lib/agenteCliente";

// El Jest de CRA no resuelve los "exports" de react-router-dom v7: solo se usa useNavigate
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../lib/agenteCliente", () => {
  const real = jest.requireActual("../lib/agenteCliente");
  return { ...real, enviarConversacion: jest.fn(), urlAgente: jest.fn() };
});

const roles = (r) => ({ isAdmin: false, isOwner: false, loadingAuth: false, ...r });
const pintar = () => render(<AgenteIA />);

const escribirYEnviar = (texto) => {
  fireEvent.change(screen.getByLabelText("Mensaje para el agente"), { target: { value: texto } });
  fireEvent.click(screen.getByLabelText("Enviar mensaje"));
};

// Preferencia del sistema "reducir movimiento": la respuesta aparece sin animación
function preferenciaMovimiento(reducir) {
  window.matchMedia = jest.fn().mockImplementation((consulta) => ({
    matches: reducir && consulta.includes("reduce"),
    media: consulta,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
}

beforeEach(() => {
  preferenciaMovimiento(true);
  enviarConversacion.mockReset();
  urlAgente.mockReturnValue("https://agente.ejemplo.test/agente");
});

test("un usuario sin rol owner/admin ve Acceso Denegado y no se invoca el backend", () => {
  useAuth.mockReturnValue(roles({}));
  pintar();
  expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
  expect(screen.queryByLabelText("Mensaje para el agente")).not.toBeInTheDocument();
  expect(enviarConversacion).not.toHaveBeenCalled();
});

test.each([["owner", { isOwner: true }], ["admin", { isAdmin: true }]])("%s accede al chat", (_, r) => {
  useAuth.mockReturnValue(roles(r));
  pintar();
  expect(screen.getByText("Agente de IA")).toBeInTheDocument();
  expect(screen.getByLabelText("Mensaje para el agente")).toBeEnabled();
});

test("muestra la respuesta y los datos de la app separados del texto del modelo", async () => {
  useAuth.mockReturnValue(roles({ isAdmin: true }));
  enviarConversacion.mockResolvedValue({
    texto: "Según los datos, la mayoría están entregados.",
    consultas: [{
      herramienta: "resumen_servicios_por_estado",
      resultado: {
        consultadoEn: "2026-10-20T15:00:00.000Z",
        totalServicios: 10,
        conEstadoNoReconocido: 1,
        porEstado: [
          { nombre: "entregado", etiqueta: "Entregado", cantidad: 6, esEstadoFacturacion: false, dejaDeMostrarse: true },
          { nombre: "pagado", etiqueta: "Pagado", cantidad: 3, esEstadoFacturacion: true, dejaDeMostrarse: false },
          { nombre: "por_cobrar", etiqueta: "Por cobrar (entregado, pendiente de pago)", origen: "sistema", cantidad: 0, esEstadoFacturacion: false, dejaDeMostrarse: false },
        ],
        notas: [],
      },
    }],
  });
  pintar();
  escribirYEnviar("¿Cuántos servicios hay en cada estado?");

  expect(await screen.findByText("Según los datos, la mayoría están entregados.")).toBeInTheDocument();
  expect(screen.getByText("¿Cuántos servicios hay en cada estado?")).toBeInTheDocument();
  expect(screen.getByText("Datos de Turbinas App")).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Servicios por estado" })).toBeInTheDocument();
  expect(screen.getByText("Otros estados no reconocidos")).toBeInTheDocument();
  expect(screen.getByText("Por cobrar (entregado, pendiente de pago)")).toBeInTheDocument();
  expect(screen.getByText(/estado del sistema/)).toBeInTheDocument();
  expect(screen.getByText("10")).toBeInTheDocument();
  expect(enviarConversacion).toHaveBeenCalledWith([{ rol: "usuario", texto: "¿Cuántos servicios hay en cada estado?" }]);
});

test("respuesta general: se indica que no consultó datos", async () => {
  useAuth.mockReturnValue(roles({ isOwner: true }));
  enviarConversacion.mockResolvedValue({ texto: "Una turbina es…", consultas: [] });
  pintar();
  escribirYEnviar("¿Qué es una turbina?");
  expect(await screen.findByText("Respuesta general: no consultó datos de Turbinas App.")).toBeInTheDocument();
});

test("error del backend: mensaje legible y reintento", async () => {
  useAuth.mockReturnValue(roles({ isAdmin: true }));
  enviarConversacion
    .mockRejectedValueOnce(new ErrorAgente("modelo_no_configurado"))
    .mockResolvedValueOnce({ texto: "Ahora sí.", consultas: [] });
  pintar();
  escribirYEnviar("Hola");

  expect(await screen.findByText("El agente todavía no tiene un modelo de IA configurado en el servidor.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("Ahora sí.")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByText(/modelo de IA configurado/)).not.toBeInTheDocument());
  expect(enviarConversacion).toHaveBeenCalledTimes(2);
});

test("sin servidor configurado: aviso y envío deshabilitado", () => {
  useAuth.mockReturnValue(roles({ isAdmin: true }));
  urlAgente.mockReturnValue("");
  pintar();
  expect(screen.getByText("El agente aún no está conectado a un servidor en este entorno.")).toBeInTheDocument();
  expect(screen.getByLabelText("Mensaje para el agente")).toBeDisabled();
  expect(screen.getByLabelText("Enviar mensaje")).toBeDisabled();
});

test("resumen financiero: cifras clave, periodo, aviso de totales parciales y notas desde los datos", async () => {
  useAuth.mockReturnValue(roles({ isOwner: true }));
  enviarConversacion.mockResolvedValue({
    texto: "En lo que va de mes entraron 320.00 USD; 120.00 USD son estimados.",
    consultas: [{
      herramienta: "resumen_financiero",
      resultado: {
        consultadoEn: "2026-10-20T15:00:00.000Z",
        periodo: { desde: "2026-10-01", hasta: "2026-10-20" },
        totalesCompletos: false,
        resumen: [
          { etiqueta: "Ingresos", valor: 320, tipo: "usd" },
          { etiqueta: "· estimados con factor actual", valor: 120, tipo: "usd" },
          { etiqueta: "Neto", valor: 70, tipo: "usd" },
        ],
        notas: ["2 cobro(s) en bolívares no guardaron su conversión: se estimaron 120 USD con el factor actual de la app (45 Bs por USD). Es una estimación."],
      },
    }],
  });
  pintar();
  escribirYEnviar("¿Cuánto dinero en USD ha entrado en lo que va de mes?");
  expect(await screen.findByText("Resumen financiero")).toBeInTheDocument();
  expect(screen.getByText("Del 01/10/2026 al 20/10/2026 (hora de Venezuela)")).toBeInTheDocument();
  expect(screen.getByText("$320.00")).toBeInTheDocument();
  expect(screen.getByText("estimados con factor actual")).toBeInTheDocument();
  expect(screen.getByText("Totales parciales: revisa las notas.")).toBeInTheDocument();
  expect(screen.getByText(/se estimaron 120 USD con el factor actual/)).toBeInTheDocument();
});

test("la respuesta se escribe palabra a palabra y los datos aparecen al terminar", async () => {
  jest.useFakeTimers();
  try {
    preferenciaMovimiento(false);
    useAuth.mockReturnValue(roles({ isAdmin: true }));
    const respuesta = "Hay diez servicios en total y la mayoría ya fueron entregados a sus clientes.";
    enviarConversacion.mockResolvedValue({
      texto: respuesta,
      consultas: [{ herramienta: "x", resultado: { consultadoEn: "2026-10-20T15:00:00.000Z" } }],
    });
    pintar();
    escribirYEnviar("¿Cuántos servicios hay?");

    const cursor = await screen.findByTestId("cursor-escritura");
    // Mientras escribe: texto visible parcial, oculto a lectores de pantalla, que reciben el texto completo
    const visible = cursor.parentElement;
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(visible.textContent.length).toBeLessThan(respuesta.length);
    expect(screen.getByText(respuesta)).toBeInTheDocument();
    expect(screen.queryByText("Datos de Turbinas App")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("cursor-escritura")).not.toBeInTheDocument();
    expect(screen.getByText(respuesta)).not.toHaveAttribute("aria-hidden");
    expect(screen.getByText("Datos de Turbinas App")).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
