# Nexus AI

## Iniciar localmente

1. Revoca cualquier clave de OpenRouter que se haya compartido en un chat o comando; crea una nueva.
2. En la terminal de esta carpeta, introduce la clave cuando `read -s` la solicite. No se muestra ni se guarda en el historial:

   ```sh
   read -s -p "Nueva clave de OpenRouter: " OPENROUTER_API_KEY
   printf '\n'
   export OPENROUTER_API_KEY
   PORT=8001 python3 server.py
   ```

3. Abre <http://127.0.0.1:8001/login.html>.

## Borrador inteligente de fotos

La herramienta para quitar marcas de agua usa Clipdrop Cleanup y está disponible solo en Pro y Premium. Define `CLIPDROP_API_KEY` en el entorno del servidor antes de iniciarlo; nunca pongas esta clave en el frontend ni en archivos versionados. El usuario debe confirmar que la imagen es propia o que cuenta con permiso para modificarla.

```sh
read -s -p "Clave de Clipdrop: " CLIPDROP_API_KEY
printf '\n'
export CLIPDROP_API_KEY
PORT=8001 python3 server.py
```

El proxy solo escucha en `127.0.0.1`. No pongas la clave en `server.py`, `.env`, ni el frontend; no cambies el servidor a `0.0.0.0`. El chat ofrece `Nexus-St`, `Nexus-Pro` y `Nexus-Basic`, alias de modelos `:free` de OpenRouter. La disponibilidad gratuita depende de OpenRouter.

## Cuota e historial

El plan Gratis permite hasta 1.000.000 tokens de entrada y salida por UID de Firebase. El servidor lee el usage reportado por OpenRouter y guarda el contador en `.nexus_usage.sqlite3` para aplicar la cuota. Este contador reside en el disco local: para producción con varias instancias debe migrarse a un servicio compartido y transaccional.

Las conversaciones se guardan bajo `users/{uid}/chatSessions` y vencen cinco días después de la última actividad. La app elimina las caducadas cuando el usuario inicia sesión. Para borrado automático aunque no vuelva a entrar, habilita Firestore TTL para el grupo de colecciones `chatSessions`, campo `expiresAt`.

Despliega las reglas de Firestore y Storage con Firebase CLI: `firebase deploy --only firestore:rules,storage`. La foto de perfil sigue en Storage; mensajes y sesiones del chat no se guardan ahí.

## Personalización del login

El favicon y los fondos del login se guardan en `appConfig/loginBranding` de Firestore; no usan Firebase Storage. El panel visual y toda la página tienen fondos independientes, así que puedes combinar una foto en el panel y un video de página completa. El documento se puede leer antes de iniciar sesión y solo las cuentas administradoras pueden modificarlo. Despliega las reglas actualizadas con `firebase deploy --only firestore:rules` para habilitarlo.

Las imágenes locales se convierten a WebP y los videos locales se recortan a los primeros seis segundos y se convierten a WebM sin audio. El contenido combinado de ambos fondos se limita a 700 KB para respetar el tamaño del documento Firestore. También se aceptan URLs HTTPS de imágenes, videos MP4/WebM y enlaces de YouTube.

## Planes

Las compras se envían con comprobante y el acceso se activa cuando un administrador aprueba el pago; no hay procesador automático.

## API Plus

API Plus está incluida en una suscripción activa Pro o Premium. Desde el botón `Nexus API` junto a Notificaciones se pueden crear hasta cinco claves y revocarlas. Cada clave se muestra una sola vez; SQLite conserva únicamente su hash. Las claves heredan la vigencia, modelos y cuota del plan al momento de crearse, y las solicitudes API comparten el contador de tokens de la cuenta.

- `GET /v1/models` lista los modelos permitidos para la clave.
- `POST /v1/chat/completions` acepta `model` y `messages` y devuelve una respuesta compatible con Chat Completions.
- Envía la clave como `Authorization: Bearer nxf_live_...`; el límite es una solicitud por segundo y 1 MB por cuerpo.

No pongas la clave en JavaScript público ni dentro del paquete de una app móvil: ambas se pueden extraer. Guarda `NEXUS_API_KEY` en tu servidor y llama a Nexus desde allí. El proxy de este proyecto escucha solo en `127.0.0.1`; para internet, colócalo detrás de un reverse proxy con HTTPS y conserva autenticación, límites y almacenamiento persistente.

Para desplegar en internet, mueve el proxy a un backend protegido, verifica Firebase Auth y comparte el contador de cuota entre instancias. No publiques `server.py` como proxy abierto.