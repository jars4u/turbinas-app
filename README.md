# turbinasmcbo-app

Sistema de gestión de servicios de turbinas y administración contable para talleres.

## Funcionalidades principales

- **Dashboard**: Visualización de turbinas en servicio, registro y edición de vehículos, filtrado y orden por estado, vista responsive tipo tabla en móviles y cards en escritorio.
- **Gestión de clientes**: Autocompletado de nombre y teléfono al registrar servicios, historial de clientes por servicios previos.
- **Caja Chica**: Registro de ingresos y egresos, cálculo automático de saldo y fondo, reposición de movimientos, visualización y edición responsive.
- **Ingresos y Egresos**: Registro manual, conversión automática de montos entre USD y Bs según tasa BCV, tablas con scroll horizontal en móviles, edición y eliminación de registros.
- **Resumen Contable**: Visualización de ingresos, egresos y saldo por día, uso de tasa histórica, tablas responsive y agrupación por método de pago.
- **Cierre Diario**: Registro y almacenamiento automático de cierre de caja con tasa BCV histórica.
- **Gestión de usuarios**: Creación, edición y eliminación de usuarios, asignación de roles de administrador, gestión de permisos.
- **Configuración**: Panel administrativo para borrar todos los datos, gestión de estados de servicios y configuración de caja chica.
- **Historial de vehículos**: Consulta de servicios realizados, búsqueda y filtrado por fecha y cliente.
- **Responsive Design**: Todos los módulos adaptados para móviles y escritorio, con tablas y formularios optimizados.

## Scripts principales
- `npm start`: Inicia el servidor de desarrollo.
- `npm run build`: Compila la app para producción.
- `npm test`: Ejecuta los tests.

## Estructura de carpetas
- `src/components/`: Componentes reutilizables (VehicleCard, CajaChica, Ingresos, Egresos, ResumenContable, AppHeader, etc.)
- `src/pages/`: Páginas principales (Dashboard, Configuracion, CierreDia, HistorialVehiculos, Login, etc.)
- `src/lib/`: Funciones de acceso a Firebase para cada módulo (vehiculos, ingresos, egresos, usuarios, caja chica, cierres diarios, etc.)

## Tecnologías utilizadas
- React + Material UI
- Firebase Firestore
- Dayjs para manejo de fechas

## Personalización
Puedes modificar los componentes en `src/components` y las funciones en `src/lib` para adaptar la funcionalidad a tus necesidades.

## Instalación
1. Clona el repositorio
2. Instala dependencias con `npm install`
3. Configura tu proyecto de Firebase en `src/firebase.js`
4. Inicia el servidor con `npm start`

## Documentación adicional
- [React documentation](https://reactjs.org/)
- [Material UI documentation](https://mui.com/)
- [Firebase documentation](https://firebase.google.com/docs)

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
