# Simulador de Dinámica de Sistemas

Aplicación web interactiva de un solo archivo (`index.html`) que simula dos ejercicios clásicos del libro **"Teoría y Ejercicios Prácticos de Dinámica de Sistemas"** de Juan Martín García, usando integración numérica por el **método de Euler**.

La simulación puede abrirse directamente en el navegador. Para consultar a OpenRouter sobre la interpretación de un modelo, se puede levantar el backend opcional escrito en Go.

## Backend Go y análisis con OpenRouter

El backend sirve los archivos estáticos y expone `POST /api/interpret`. La clave de OpenRouter permanece en el servidor y nunca se envía al navegador.

Requisitos: Go 1.22 o superior y una clave de OpenRouter.

En PowerShell:

```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-tu-clave"
$env:OPENROUTER_MODEL = "openrouter/auto" # opcional
go run .
```

Después abre `http://localhost:8080`, ejecuta alguno de los modelos y entra en **Historial y análisis**. El botón **Interpretar con IA** envía las ecuaciones, parámetros, métricas de tendencia y una muestra de la serie temporal al backend.

Comprobación rápida:

```powershell
Invoke-RestMethod http://localhost:8080/api/health
```

Si se abre `index.html` directamente como archivo, la simulación seguirá funcionando, pero la llamada a `/api/interpret` no estará disponible porque no existe un servidor que atienda esa ruta.

## Demo en vivo

### 🚀 [Abrir el simulador](https://dynamic-systems-simulation-63wznjnob.vercel.app/)

[![Ver demo en Vercel](https://img.shields.io/badge/demo-en%20vivo-2DD4BF?style=for-the-badge&logo=vercel&logoColor=white)](https://dynamic-systems-simulation-63wznjnob.vercel.app/)

## Despliegue en Vercel

Al ser un HTML estático sin backend, se puede desplegar sin configuración adicional:

1. Sube el archivo a un repositorio de GitHub, o arrástralo directamente en [vercel.com/new](https://vercel.com/new).
2. Si usas GitHub: en Vercel elige **Import Project**, selecciona el repositorio y despliega — no hace falta build command ni framework preset (elige "Other").
3. Ya está desplegado en la URL que ves arriba en **Demo en vivo**. Cada vez que actualices el archivo y vuelvas a desplegar, Vercel genera una nueva URL de preview o actualiza la de producción, según cómo lo hayas configurado.

## Contenido

- HTML + CSS (Tailwind vía CDN) + JavaScript vanilla, todo en un único archivo.
- Gráficos con [Chart.js](https://www.chartjs.org/) (vía CDN, con CDN de respaldo automático).
- Dos ejercicios accesibles por pestañas.

## Requisitos

- Un navegador moderno (Chrome, Firefox, Edge, Safari).
- Conexión a internet la primera vez que se abre, para cargar Tailwind CSS y Chart.js desde CDN (`cdn.tailwindcss.com`, `cdn.jsdelivr.net` y, como respaldo, `cdnjs.cloudflare.com`). Si no hay conexión, la app muestra un mensaje indicándolo en vez de fallar en blanco.


### Controles de simulación

| Botón | Acción |
|---|---|
| ▶ Iniciar / ⏸ Pausar | Corre la simulación de forma continua, integrando con el paso `dt` configurado. |
| ⏭ Paso a paso (Euler) | Pausa la simulación (si estaba corriendo) y ejecuta un único paso de integración de Euler. Útil para ver cómo se actualizan las ecuaciones iteración a iteración. |
| ↺ Reiniciar | Detiene la simulación y vuelve a las condiciones iniciales definidas en los campos de entrada. |

## Ejercicio 1 · Presa-Depredador (Conejos y Zorros)

**Variables de estado (stocks)**

- `C` — Población de conejos
- `Z` — Población de zorros

**Parámetros**

| Símbolo | Significado |
|---|---|
| `a` | Tasa de natalidad de conejos |
| `b` | Tasa de mortalidad de conejos por depredación |
| `c` | Tasa de natalidad/eficiencia de zorros por alimento |
| `d` | Tasa de mortalidad de zorros |
| `dt` | Paso de integración de Euler |

**Ecuaciones diferenciales**

```
dC/dt = a·C − b·C·Z
dZ/dt = c·C·Z − d·Z
```

**Visualizaciones**

- Evolución temporal: población de conejos y zorros vs. tiempo.
- Plano de fase: Zorros vs. Conejos (trayectoria del sistema).
- Diagrama de bucles causales: bucle reforzador (R) de natalidad de conejos y bucle de equilibrio (B) de mortalidad de zorros por escasez de alimento.
- Caja de ecuaciones con el cálculo de `dC/dt` y `dZ/dt` en cada paso, usando los valores actuales de `C` y `Z`.

## Ejercicio 2 · Modelo Epidemiológico SIR / SIRS

**Variables de estado (stocks)**

- `S` — Susceptibles
- `I` — Infectados
- `R` — Recuperados

**Parámetros**

| Símbolo | Significado |
|---|---|
| `N` | Población total |
| `Beta (β)` | Tasa de transmisión / contacto |
| `Gamma (γ)` | Tasa de recuperación |
| `Delta (δ)` | Tasa de pérdida de inmunidad (solo en modo SIRS) |
| `dt` | Paso de integración de Euler |

Un interruptor permite alternar entre:

- **SIR** (inmunidad permanente): los recuperados no vuelven a ser susceptibles.
- **SIRS** (inmunidad temporal): los recuperados pueden volver a ser susceptibles según `δ`.

**Ecuaciones diferenciales**

SIR:
```
dS/dt = − (β·S·I) / N
dI/dt = (β·S·I) / N − γ·I
dR/dt = γ·I
```

SIRS (con pérdida de inmunidad):
```
dS/dt = − (β·S·I) / N + δ·R
dI/dt = (β·S·I) / N − γ·I
dR/dt = γ·I − δ·R
```

**Visualizaciones**

- Evolución temporal: curvas de S, I y R.
- Indicador numérico de `R₀ = β / γ` (número reproductivo básico), actualizado en vivo al mover los sliders.
- Diagrama de bucles causales: bucle de equilibrio del contagio, con un bucle adicional de retorno cuando el modo SIRS está activo.
- Caja de ecuaciones que cambia según el modo (SIR o SIRS).

## Ejercicio 5.1 · Dinámica de Población y Medio Ambiente (Vensim)

A diferencia de los ejercicios 1 y 2, este ejercicio no está implementado en `index.html`, sino como un **modelo de Vensim** independiente, incluido en el repositorio como [`Poblacion_MedioAmbiente.mdl`](./Poblacion_MedioAmbiente.mdl). Sirve como primer contacto con el software Vensim: instalación, construcción del diagrama de flujos, entrada de ecuaciones y simulación.

**Variable de estado (nivel)**

- `Población` — número de individuos (inicial: 1000)

**Flujos**

- `Nacimientos` = `Población · Tasa de Natalidad` (flujo de entrada)
- `Defunciones` = `Población / Esperanza de Vida` (flujo de salida)

**Parámetros (constantes)**

| Símbolo | Significado | Valor |
|---|---|---|
| `Tasa de Natalidad` | Tasa de natalidad semanal | 0.05 (1/semana) |
| `Esperanza de Vida` | Esperanza de vida media | 100 (semana) |

**Ecuación del nivel**

```
Población(t) = Población(t−dt) + (Nacimientos − Defunciones)·dt
```

**Cómo simularlo**

1. Descarga [Vensim PLE](https://vensim.com/free-download/) (gratuito, uso educativo).
2. Abre `Poblacion_MedioAmbiente.mdl` con **File → Open**.
3. Pulsa **Run (▶)** para simular (horizonte por defecto: 0–100 semanas, `dt` = 1).
4. Selecciona la variable `Población` y usa los iconos de gráfico/tabla de la barra lateral para ver su evolución.

**Comportamiento esperado**

Al no depender la natalidad ni la mortalidad del tamaño de la población, el bucle de realimentación positivo (nacimientos) domina sobre el bucle de equilibrio (defunciones), y la población crece de forma **exponencial** sin límite — pasando de 1000 a más de 5000 individuos hacia la semana 100.

## Notas técnicas

- La integración usa el **método de Euler explícito**: `x(t+dt) = x(t) + f(x,t)·dt`.
- Las poblaciones se recortan en 0 para evitar valores negativos por el error de discretización de Euler.
- El historial de cada simulación se limita a 4000 puntos para mantener el rendimiento; al superar ese límite se van descartando los puntos más antiguos.
- Ningún dato se guarda ni se envía a un servidor: todo el cálculo ocurre en el navegador del usuario.

## Créditos

Ejercicios basados en *"Teoría y Ejercicios Prácticos de Dinámica de Sistemas"* de Juan Martín García.