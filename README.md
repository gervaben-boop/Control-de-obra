# Control de Obra V1

Primera versión de una app web para registrar tareas pendientes de obra desde celular o PC.

## Qué funciona ahora

- Crear tareas.
- Obra, piso, unidad, ambiente, rubro, responsable y prioridad.
- Estados: Pendiente → Asignada → Terminada → Verificada.
- Filtros por estado.
- Contadores.
- Persistencia local en el navegador.
- Botón "Crear con IA" usando OpenAI Responses API.

## Requisitos

1. Instalar Node.js LTS.
2. Tener una API key de OpenAI si querés usar la función de IA.

## Cómo iniciar

Abrir una terminal dentro de la carpeta del proyecto:

```bash
npm install
```

Crear un archivo `.env.local`:

```text
OPENAI_API_KEY=tu_clave
```

Después:

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Probar la IA

Ejemplo:

"Piso 8 departamento B, cocina, faltan dos tomacorrientes. Electricidad. Asignar a Juan. Prioridad alta."

La IA completa el formulario y vos lo revisás antes de guardar.

## Importante sobre esta V1

Las tareas se guardan con `localStorage`, por eso todavía NO se sincronizan entre celular y PC.

La carpeta `supabase/schema.sql` ya contiene la estructura de base para la siguiente etapa, donde vamos a agregar:

- Usuarios y login.
- Sincronización celular ↔ PC.
- Fotografías.
- Múltiples obras.
- Responsables.
- Historial.
- Panel de administración.
- QR por sector.
- Planos.
- Integración futura con Revit/Dynamo.

## Seguridad

Nunca colocar `OPENAI_API_KEY` en código que se ejecute en el navegador.
La llamada a OpenAI está en `/app/api/ai-task/route.ts`, del lado servidor.
