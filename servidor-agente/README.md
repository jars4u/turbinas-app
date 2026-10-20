# Servidor del Agente de IA

## Variables de entorno (solo en el servidor)

Proveedor de IA: se usa **Azure OpenAI** si sus tres variables están definidas; si no, la **API directa de OpenAI**. Sin ninguno, el agente responde `modelo_no_configurado` (503).

| Variable | Obligatoria | Función |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | Para Azure | Endpoint del recurso, p. ej. `https://mi-recurso.openai.azure.com`. Solo se aceptan dominios de Azure con HTTPS. |
| `AZURE_OPENAI_API_KEY` | Para Azure | Clave del recurso de Azure OpenAI. |
| `AZURE_OPENAI_DEPLOYMENT` | Para Azure | Nombre del deployment del modelo creado en Azure. |
| `OPENAI_API_KEY` | Para OpenAI directo | Clave de la API de OpenAI. No disponible desde países fuera de su lista de admitidos (p. ej. Venezuela). |
| `OPENAI_MODEL` | No | Modelo de OpenAI directo. Por defecto `gpt-5.4-mini`. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Solo fuera de Google Cloud | JSON de una cuenta de servicio con `roles/datastore.viewer` y `roles/firebaseauth.viewer`, para verificar sesiones y leer `usuarios`, `estadosServicio` y conteos de `vehiculos`. |
| `FIREBASE_PROJECT_ID` | No | ID del proyecto de Firebase si las credenciales no lo indican. |
| `AGENTE_ORIGENES_PERMITIDOS` | Sí, si el frontend está en otro dominio | Orígenes permitidos por CORS, separados por comas. |

Las claves nunca van al frontend ni al repositorio. En el frontend solo se configura `REACT_APP_AGENTE_URL`: la URL de este servidor (no es un secreto).

## Despliegue en Vercel

La función es `api/agente.js` (en la raíz del repositorio) y se ejecuta en la región fijada en `vercel.json` (`iad1`, EE. UU.). En Vercel, Settings → Environment Variables, entorno Production:

| Variable | Valor |
|---|---|
| `OPENAI_API_KEY` | Clave de OpenAI (marcar como Sensitive). |
| `OPENAI_MODEL` | Opcional. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON completo de la cuenta de servicio de solo lectura (marcar como Sensitive). |
| `REACT_APP_AGENTE_URL` | `/api/agente` (se usa al compilar el frontend). |

`AGENTE_ORIGENES_PERMITIDOS` no hace falta si el frontend y la función están en el mismo dominio.

Pruebas (sin llamadas de red): `npm test`
