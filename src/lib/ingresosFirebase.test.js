/* Lectura de ingresos: normalización de fechas sin reinterpretar YYYY-MM-DD (Firestore simulado) */
const mockGetDocs = jest.fn();

jest.mock("firebase/firestore", () => ({
  getFirestore: () => ({}),
  collection: (...args) => ({ args }),
  doc: (...args) => ({ args }),
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

const documento = (id, data) => ({ id, data: () => data });

describe("obtenerIngresos: fechas", () => {
  test("dd/mm/aaaa, aaaa-mm-dd, Timestamp e inválidas", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        documento("a", { fecha: "5/10/2026", formasPago: [] }),
        documento("b", { fecha: "2026-10-06", formasPago: [] }),
        documento("c", { fecha: { toDate: () => new Date(2026, 9, 7, 9, 30) }, formasPago: [] }),
        documento("d", { fecha: "31/02/2026", formasPago: [] }),
        documento("e", { formasPago: [] }),
      ],
    });
    const { obtenerIngresos } = require("./ingresosFirebase");
    const ingresos = await obtenerIngresos();
    const porId = Object.fromEntries(ingresos.map((i) => [i.id, i]));

    expect(porId.a).toMatchObject({ fecha: "05/10/2026", fechaRaw: new Date(2026, 9, 5, 12) });
    // Antes se leía como día 2026 del mes 10 del año 6
    expect(porId.b).toMatchObject({ fecha: "06/10/2026", fechaRaw: new Date(2026, 9, 6, 12) });
    expect(porId.c).toMatchObject({ fecha: "07/10/2026", fechaRaw: new Date(2026, 9, 7, 9, 30) });
    // Fecha imposible o ausente: sin fechaRaw (no se imputa) y se conserva el texto original
    expect(porId.d).toMatchObject({ fecha: "31/02/2026", fechaRaw: null });
    expect(porId.e).toMatchObject({ fecha: "", fechaRaw: null });
    // Orden: más reciente primero; los que no tienen fecha al final
    expect(ingresos.map((i) => i.id)).toEqual(["c", "b", "a", "d", "e"]);
  });
});
