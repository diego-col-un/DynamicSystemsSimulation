# Simulador de Dinámica de Sistemas

Aplicación web interactiva de un solo archivo (`dinamica_sistemas.html`) que simula dos ejercicios clásicos del libro **"Teoría y Ejercicios Prácticos de Dinámica de Sistemas"** de Juan Martín García, usando integración numérica por el **método de Euler**.

No requiere instalación, servidor ni build: se abre directamente en el navegador.

## Contenido

- HTML + CSS (Tailwind vía CDN) + JavaScript vanilla, todo en un único archivo.
- Gráficos con [Chart.js](https://www.chartjs.org/) (vía CDN, con CDN de respaldo automático).
- Dos ejercicios accesibles por pestañas.

## Requisitos

- Un navegador moderno (Chrome, Firefox, Edge, Safari).
- Conexión a internet la primera vez que se abre, para cargar Tailwind CSS y Chart.js desde CDN (`cdn.tailwindcss.com`, `cdn.jsdelivr.net` y, como respaldo, `cdnjs.cloudflare.com`). Si no hay conexión, la app muestra un mensaje indicándolo en vez de fallar en blanco.

## Cómo usarlo

1. Descarga `dinamica_sistemas.html`.
2. Ábrelo con doble clic o arrastrándolo a una ventana del navegador.
3. Elige la pestaña del ejercicio que quieras explorar.
4. Ajusta condiciones iniciales y parámetros con los sliders o los campos numéricos (están sincronizados entre sí).
5. Usa los botones de control para correr la simulación.

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

## Notas técnicas

- La integración usa el **método de Euler explícito**: `x(t+dt) = x(t) + f(x,t)·dt`.
- Las poblaciones se recortan en 0 para evitar valores negativos por el error de discretización de Euler.
- El historial de cada simulación se limita a 4000 puntos para mantener el rendimiento; al superar ese límite se van descartando los puntos más antiguos.
- Ningún dato se guarda ni se envía a un servidor: todo el cálculo ocurre en el navegador del usuario.

## Créditos

Ejercicios basados en *"Teoría y Ejercicios Prácticos de Dinámica de Sistemas"* de Juan Martín García.