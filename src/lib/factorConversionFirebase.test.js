/* Resolución del factor de conversión según el modo elegido */
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();

jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  doc: (...args) => ({ args }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
}));

const snap = (data) => ({ exists: () => !!data, data: () => data });

describe("factor de conversión por modo", () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetDoc.mockReset();
    mockSetDoc.mockReset();
    mockSetDoc.mockResolvedValue(undefined);
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => [
        { moneda: "USD", fuente: "oficial", promedio: 773.3125 },
        { moneda: "EUR", fuente: "oficial", promedio: 896.02946062 },
        { moneda: "USD", fuente: "paralelo", promedio: 877.9 },
      ],
    });
  });

  test("documento antiguo (solo valor) se comporta como manual", async () => {
    mockGetDoc.mockResolvedValue(snap({ valor: 300 }));
    const { obtenerFactorConversion } = require("./factorConversionFirebase");
    expect(await obtenerFactorConversion()).toBe(300);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("modo BCV dólar usa la tasa oficial en vivo", async () => {
    mockGetDoc.mockResolvedValue(snap({ modo: "bcv_usd", valorManual: 300, valor: 700 }));
    const { obtenerDetalleFactorConversion } = require("./factorConversionFirebase");
    const d = await obtenerDetalleFactorConversion();
    expect(d.factor).toBeCloseTo(773.3125);
    expect(d.fuente).toBe("bcv");
  });

  test("modo BCV euro usa la tasa del euro", async () => {
    mockGetDoc.mockResolvedValue(snap({ modo: "bcv_eur", valorManual: 300, valor: 700 }));
    const { obtenerFactorConversion } = require("./factorConversionFirebase");
    expect(await obtenerFactorConversion()).toBeCloseTo(896.02946062);
  });

  test("si la API falla cae al valor guardado en Firestore", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("sin red"));
    mockGetDoc.mockImplementation(({ args }) => {
      const id = args[args.length - 1];
      if (id === "tasaBCV") return Promise.resolve(snap({ valor: 750, valorEUR: 880 }));
      return Promise.resolve(snap({ modo: "bcv_usd", valorManual: 300, valor: 700 }));
    });
    const { obtenerDetalleFactorConversion } = require("./factorConversionFirebase");
    const d = await obtenerDetalleFactorConversion();
    expect(d.factor).toBe(750);
    expect(d.fuente).toBe("firestore");
  });

  test("sin API ni respaldo usa el último valor conocido", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("sin red"));
    mockGetDoc.mockImplementation(({ args }) => {
      const id = args[args.length - 1];
      if (id === "tasaBCV") return Promise.resolve(snap(null));
      return Promise.resolve(snap({ modo: "bcv_eur", valorManual: 300, valor: 700 }));
    });
    const { obtenerDetalleFactorConversion } = require("./factorConversionFirebase");
    const d = await obtenerDetalleFactorConversion();
    expect(d.factor).toBe(700);
    expect(d.fuente).toBe("respaldo");
  });

  test("guardar el modo persiste modo, valor manual y factor efectivo", async () => {
    mockGetDoc.mockResolvedValue(snap({ modo: "manual", valorManual: 300, valor: 300 }));
    const { guardarConfigFactorConversion } = require("./factorConversionFirebase");
    const d = await guardarConfigFactorConversion({ modo: "bcv_eur" });
    expect(d.factor).toBeCloseTo(896.02946062);
    const guardado = mockSetDoc.mock.calls[0][1];
    expect(guardado.modo).toBe("bcv_eur");
    expect(guardado.valorManual).toBe(300);
    expect(guardado.valor).toBeCloseTo(896.02946062);
  });

  test("la caché evita consultar la API en cada lectura", async () => {
    mockGetDoc.mockResolvedValue(snap({ modo: "bcv_usd", valorManual: 300, valor: 700 }));
    const { obtenerFactorConversion } = require("./factorConversionFirebase");
    await obtenerFactorConversion();
    await obtenerFactorConversion();
    await obtenerFactorConversion();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
