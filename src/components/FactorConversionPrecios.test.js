import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (...args) => ({ args }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
}));

import FactorConversionPrecios from "./FactorConversionPrecios";

const snap = (data) => ({ exists: () => !!data, data: () => data });

describe("FactorConversionPrecios", () => {
  beforeEach(() => {
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockSetDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(snap({ modo: "manual", valorManual: 300, valor: 300 }));
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => [
        { moneda: "USD", fuente: "oficial", promedio: 773.3125 },
        { moneda: "EUR", fuente: "oficial", promedio: 896.02946062 },
      ],
    });
  });

  test("muestra las tres opciones con sus valores y permite cambiar a BCV Euro", async () => {
    render(<FactorConversionPrecios />);

    // Las tres opciones están disponibles
    expect(await screen.findByText("Factor manual")).toBeInTheDocument();
    expect(screen.getByText("BCV Dólar")).toBeInTheDocument();
    expect(screen.getByText("BCV Euro")).toBeInTheDocument();

    // Modo manual: factor actual = valor manual guardado
    await waitFor(() => {
      expect(screen.getAllByText("Bs. 300,00").length).toBeGreaterThan(0);
    });

    // Las tasas en vivo se pintan en cada opción
    await waitFor(() => {
      expect(screen.getByText("Bs. 773,31")).toBeInTheDocument();
      expect(screen.getByText("Bs. 896,03")).toBeInTheDocument();
    });

    // Cambiar a BCV Euro guarda el modo y el factor efectivo
    fireEvent.click(screen.getByText("BCV Euro"));
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    const guardado = mockSetDoc.mock.calls[0][1];
    expect(guardado.modo).toBe("bcv_eur");
    expect(guardado.valor).toBeCloseTo(896.02946062);
  });
});
