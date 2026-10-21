/* Botón de notas arrastrable: un toque abre el panel; un arrastre lo mueve y no lo abre */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NotasFlotantes from "./NotasFlotantes";

jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ usuario: { email: "prueba@ejemplo.com" } }) }));
jest.mock("../lib/notasFirebase", () => ({
  escucharNotasPorUsuario: (_email, alCambiar) => {
    alCambiar([]);
    return () => {};
  },
  crearNota: jest.fn(),
  actualizarNota: jest.fn(),
  eliminarNota: jest.fn(),
}));

const POSICION_KEY = "turbinasmcbo_notas_posicion";

// jsdom no implementa PointerEvent: sin esto los eventos llegan sin coordenadas
beforeAll(() => {
  if (!window.PointerEvent) {
    window.PointerEvent = class PointerEvent extends MouseEvent {
      constructor(tipo, init = {}) {
        super(tipo, init);
        this.pointerId = init.pointerId;
      }
    };
  }
});

beforeEach(() => {
  localStorage.clear();
  window.innerWidth = 400;
  window.innerHeight = 800;
});

const puntero = (tipo, el, x, y) => fireEvent[tipo](el, { pointerId: 1, button: 0, clientX: x, clientY: y });

test("un toque sin desplazamiento abre las notas", () => {
  render(<NotasFlotantes />);
  const boton = screen.getByRole("button", { name: "notas" });
  const contenedor = screen.getByTestId("notas-arrastrable");
  puntero("pointerDown", contenedor, 350, 740);
  puntero("pointerUp", contenedor, 351, 741);
  fireEvent.click(boton);
  expect(screen.getByText("Notas rápidas")).toBeInTheDocument();
});

test("arrastrar mueve el botón, no abre el panel, se limita a la pantalla y recuerda la posición", () => {
  render(<NotasFlotantes />);
  const boton = screen.getByRole("button", { name: "notas" });
  const contenedor = screen.getByTestId("notas-arrastrable");
  puntero("pointerDown", contenedor, 350, 740);
  puntero("pointerMove", contenedor, 200, 300);
  puntero("pointerMove", contenedor, -500, 100);
  puntero("pointerUp", contenedor, -500, 100);
  fireEvent.click(boton); // el click que sigue al arrastre
  expect(screen.queryByText("Notas rápidas")).not.toBeInTheDocument();
  expect(contenedor).toHaveStyle({ left: "8px" });
  const guardada = JSON.parse(localStorage.getItem(POSICION_KEY));
  expect(guardada.x).toBe(8);
  // El siguiente toque sí abre
  fireEvent.click(boton);
  expect(screen.getByText("Notas rápidas")).toBeInTheDocument();
});

test("al volver a cargar usa la posición guardada, recortada si ya no cabe", () => {
  localStorage.setItem(POSICION_KEY, JSON.stringify({ x: 5000, y: 20 }));
  render(<NotasFlotantes />);
  expect(screen.getByTestId("notas-arrastrable")).toHaveStyle({ left: `${400 - 40 - 8}px`, top: "20px" });
});
