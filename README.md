# Sistema de GENET — backend real

Este es el sistema completo con backend real: Node.js + Express + PostgreSQL.
Ya no depende del navegador para guardar datos — todo vive en una base de datos
de verdad, así que varios vendedores pueden usarlo al mismo tiempo sin problema
y el catálogo puede crecer a miles de artículos.

## ¿Qué incluye?

- **Login de administrador** con usuario y contraseña reales (guardados de forma segura, no en texto plano).
- **Catálogo de productos** con búsqueda y paginación desde el servidor (aunque tengas 10.000 artículos, solo se cargan de a 60 por vez).
- **Ventas con control de stock seguro**: si dos vendedores intentan vender el último artículo al mismo tiempo, la base de datos se encarga de que solo uno lo consiga (no hay sobreventa).
- **Historial de ventas** guardado en la base de datos (tabla `ventas`).

## Antes de subirlo: qué necesitás

1. Una cuenta en [Railway](https://railway.app) (ya la tenés).
2. Una cuenta en [GitHub](https://github.com) para subir este código (si no tenés, es gratis y rápido de crear).

## Paso a paso para subirlo a Railway

### 1. Subí este código a un repositorio de GitHub
- Creá un repositorio nuevo en GitHub (puede ser privado).
- Subí todos estos archivos ahí (podés arrastrar los archivos directamente desde la web de GitHub si no usás git por consola, con el botón "Add file → Upload files").

### 2. Creá el proyecto en Railway
- Entrá a Railway → **New Project** → **Deploy from GitHub repo** → elegí el repositorio que acabás de subir.
- Railway va a detectar que es un proyecto Node.js automáticamente (por el `package.json`).

### 3. Agregá la base de datos
- Dentro del mismo proyecto en Railway, hacé clic en **+ New** → **Database** → **Add PostgreSQL**.
- Railway crea la base de datos y genera automáticamente la variable `DATABASE_URL`.

### 4. Conectá la base de datos con tu servicio
- Andá a tu servicio (el que corre el código, no la base de datos) → pestaña **Variables**.
- Agregá una variable llamada `DATABASE_URL` y como valor usá la referencia a la base de datos: Railway te deja seleccionarla de un desplegable (`${{Postgres.DATABASE_URL}}`) — así quedan conectados automáticamente.

### 5. Agregá las demás variables de entorno
En la misma pestaña **Variables** de tu servicio, agregá:

| Variable | Valor sugerido |
|---|---|
| `ADMIN_USER` | el usuario que vas a usar para entrar al panel (ej: `admin`) |
| `ADMIN_PASSWORD` | una contraseña segura tuya (no dejes `admin123` en producción) |
| `JWT_SECRET` | cualquier texto largo y random, por ejemplo 40 caracteres sueltos |

`PORT` no hace falta configurarlo: Railway lo asigna solo y el código ya lo usa.

### 6. Desplegá
- Railway despliega automáticamente en cuanto detecta el push al repositorio.
- Cuando termine, te da una URL pública (algo como `tu-proyecto.up.railway.app`) — esa es la dirección de tu sistema, accesible desde cualquier navegador (celular, notebook, tablet).

### 7. Primer ingreso
- Abrí la URL que te dio Railway.
- Tocá la pestaña **Administración**, ingresá con el usuario y contraseña que configuraste en el paso 5.
- Empezá a cargar productos — van a aparecer al instante en el Punto de Venta para cualquiera que tenga la URL abierta.

## Actualizaciones futuras

Cualquier cambio que necesites (nuevas funciones, ajustes de diseño, etc.) se hace
sobre este mismo código. Cuando lo subas de nuevo a GitHub, Railway lo redespliega
solo.

## Notas de seguridad importantes

- Cambiá `ADMIN_PASSWORD` por una contraseña fuerte antes de usar el sistema con datos reales.
- No compartas la URL de Railway ni las variables de entorno públicamente.
- El punto de venta (búsqueda, carrito, cobrar) es de acceso libre a quien tenga la URL — pensado para que cualquier vendedor lo use sin tener que loguearse cada vez. Si en el futuro querés que cada vendedor tenga su propio usuario (para saber quién vendió qué), decímelo y lo agregamos.
