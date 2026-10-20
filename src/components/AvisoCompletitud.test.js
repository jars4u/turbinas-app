/* Presentación de totales parciales: lo que queda fuera se distingue del total calculado */
import React from "react";
import { render, screen } from "@testing-library/react";
import AvisoCompletitud, { lineasCompletitud } from "./AvisoCompletitud";
import { resumirCompletitud } from "../lib/finanzas";

const parcial = resumirCompletitud({
  egresosAmbiguos: [{ importeUSDOriginal: 50, importeBsOriginal: 2000 }],
  nominasPendientes: [{ usd: 300 }],
  egresosPendientesConversion: { cantidad: 1, bs: 4500 },
  sinPeriodo: { ingresos: 2 },
  usdEstimado: 25,
});

test("total completo y sin estimaciones: no muestra ningún aviso", () => {
  const { container } = render(<AvisoCompletitud completitud={resumirCompletitud()} />);
  expect(container).toBeEmptyDOMElement();
});

test("total parcial: título explícito y cada exclusión por separado", () => {
  render(<AvisoCompletitud completitud={parcial} />);
  expect(screen.getByText("Totales parciales: no reconciliados")).toBeInTheDocument();
  expect(screen.getByText(/Excluido por ambigüedad/)).toBeInTheDocument();
  expect(screen.getByText(/Pendiente de criterio/)).toBeInTheDocument();
  expect(screen.getByText(/Pendiente de conversión/)).toBeInTheDocument();
  expect(screen.getByText(/Sin período/)).toBeInTheDocument();
  expect(screen.getByText(/Incluye \$25\.00 estimados/)).toBeInTheDocument();
});

test("ambiguos: mínimo en USD y Bs sin clasificar, sin sumarlos como gastos distintos", () => {
  const [ambiguo] = lineasCompletitud(parcial);
  expect(ambiguo.texto).toContain("al menos $50.00 registrados en USD");
  expect(ambiguo.texto).toContain("Bs 2.000,00 sin clasificar");
  // 50 + 2000/40 = 100: interpretación "gastos distintos" que no debe presentarse
  expect(ambiguo.texto).not.toContain("$100");
});

test("pendientes de conversión y criterio con sus importes", () => {
  const textos = lineasCompletitud(parcial).map((l) => l.texto).join(" ");
  expect(textos).toContain("1 nómina(s) por $300.00");
  expect(textos).toContain("1 egreso(s) sin tasa registrada, por Bs 4.500,00. No suman en USD.");
  expect(textos).toContain("2 registro(s) sin fecha verificable");
});

test("modo compacto para paneles laterales", () => {
  render(<AvisoCompletitud completitud={parcial} compacto />);
  expect(screen.getByText("Totales parciales, no reconciliados:")).toBeInTheDocument();
  expect(screen.getAllByText(/:/).length).toBeGreaterThan(1);
});

test("solo estimaciones: aviso informativo, no de total parcial", () => {
  render(<AvisoCompletitud completitud={resumirCompletitud({ usdEstimado: 10 })} />);
  expect(screen.queryByText(/Totales parciales/)).not.toBeInTheDocument();
  expect(screen.getByText(/Incluye \$10\.00 estimados/)).toBeInTheDocument();
});
