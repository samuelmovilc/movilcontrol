# Plan: Crédito y Cartera, Ingresos/Egresos e Informe (Ventanas y Estilo)

Estado: lógica aprobada por el usuario. Aún NO se ha escrito código ni tocado la base de datos.
Regla: nada se aplica en producción sin un "Sí" explícito del usuario. Primero se prueba en una copia.

## Principios
- Toda venta se hace en el POS. El módulo Cartera NUNCA vende.
- El plan de crédito se cotiza ANTES de la venta, en Cartera, y se guarda ("plan aprobado").
- Total a crédito = precio de contado x (1 + %). El % es variable (2, 5, 10, 15, 20, 30...).
- El cliente paga siempre el mismo total, con o sin inicial.
- Cuota = (total con recargo - inicial) / número de cuotas. La última cuota absorbe el redondeo.
- Frecuencia: semanal, quincenal o mensual.
- Pagos libres (cualquier monto). Cubren primero la cuota más antigua; el sobrante pasa a la siguiente.
- Mora = solo marca roja: la cuota ya pasó su fecha y no está pagada. SIN penalización ni cobros adicionales.
- Sin recordatorios. Un solo cobrador, en el local.
- La Caja actual no se modifica. Se agrega un informe nuevo con filtro de fechas.
- Anular = reverso, nunca borrar datos.

## Módulos
| Módulo | Función |
|---|---|
| Configuración | Clientes (ID, nombre, teléfono, dirección). Método de pago "Crédito" (sin %). Cliente POS por defecto con lista desplegable. |
| Crédito y Cartera | Simulador, guardar planes, hoja de cuotas por crédito (# / Vence / Valor / Pagado / Saldo / Estado), saldos y mora. |
| POS | Vende normal. Con método "Crédito" elige el plan aprobado del cliente (sin mostrar % ni simulación). Descuenta inventario. |
| Ingresos y Egresos | Ingreso: categoría (Cobro de cuotas -> cliente/crédito, monto libre, método), otros ingresos. Egreso: categoría, monto, observaciones. Todo afecta la caja. |
| Informe | Ver sección siguiente. |

## Flujo
1. Cartera: crear plan (cliente, precio contado, %, inicial, cuotas, frecuencia) y guardar. Sin venta, inventario ni caja.
2. POS: vender al cliente con método "Crédito" y elegir el plan. Inventario se descuenta. La inicial entra por su método real.
3. Cartera: el plan pasa a Activo y muestra su hoja de cuotas.
4. Ingresos y Egresos: Cobro de cuotas (monto libre). Baja el saldo, entra a caja.

### Ejemplo: Juan, ventana 100.000 contado, 20% = 120.000, inicial 20.000, 2 cuotas quincenales
| Concepto | Valor |
|---|---|
| Precio contado | 100.000 |
| Recargo 20% | + 20.000 |
| Total a pagar | 120.000 |
| Inicial | - 20.000 |
| Saldo a financiar | 100.000 |

Cuotas: #1 16-nov 50.000, #2 1-dic 50.000.
Otras iniciales (2 cuotas): inicial 0 -> 60.000 c/u; inicial 50.000 -> 35.000 c/u.

Caja del día de la venta: Total vendido 120.000 | Ventas a crédito 100.000 | Pagado hoy (efectivo) 20.000 | Total en caja 20.000.
"Ventas a crédito" es informativo y NO suma al total en caja.

## Informe (con filtro de fechas)
Ejemplo del mes (egresos en efectivo; otro ingreso por transferencia).

1. Ventas por producto
| Producto | Vendido | Costo | Ganancia |
|---|---|---|---|
| Ventana aluminio | 3.000.000 | 1.200.000 | 1.800.000 |
| Vidrio | 1.500.000 | 600.000 | 900.000 |
| Puerta | 500.000 | 200.000 | 300.000 |
| Total | 5.000.000 | 2.000.000 | 3.000.000 |

2. Total ventas: contado 3.000.000 + crédito 2.000.000 = 5.000.000

3. Ingresos: ventas (contado 3.000.000 + cobros de cuotas 500.000) 3.500.000 + otros ingresos 200.000 = 3.700.000

4. Egresos por categoría: Arriendo 500.000 + Energía 150.000 = 650.000

5. Balance por método de pago
| Método | Ingresos | Egresos | Balance |
|---|---|---|---|
| Efectivo | 2.300.000 | 650.000 | 1.650.000 |
| Transferencia | 1.000.000 | 0 | 1.000.000 |
| Tarjeta | 400.000 | 0 | 400.000 |
| Dinero en mano | 3.700.000 | 650.000 | 3.050.000 |
| Crédito (por cobrar) | | | 1.500.000 |
| Total | | | 4.550.000 |

6. Cartera: total 2.000.000 | cobrado 500.000 | pendiente por cobrar 1.500.000

Verificaciones: total vendido = dinero recibido por ventas + pendiente por cobrar; crédito en el balance = pendiente de cartera.

## Base de datos (tablas nuevas, en la base actual de Ventanas y Estilo)
- `creditos`: cliente, venta, precio_contado, porcentaje_recargo, total_credito, inicial, num_cuotas, frecuencia, fecha_inicio, estado (aprobado/activo/pagado/anulado).
- `credito_cuotas`: crédito, número, fecha_vence, valor, pagado.
- `movimientos_caja`: tipo (ingreso/egreso), categoría (texto), monto, método de pago, observaciones, turno, usuario, crédito/cliente opcional.
- `ventas`: un campo de estado de pago (contado/crédito) y referencia al crédito.
- El % se guarda en cada crédito: cambiarlo después no altera los créditos viejos.

## Orden de construcción (probar cada paso en copia de pruebas)
1. Configuración: clientes y método "Crédito".
2. Cartera: simulador y guardado de planes.
3. POS: elegir "Crédito" y el plan del cliente.
4. Ingresos y Egresos (cobro de cuotas, otros ingresos, egresos).
5. Caja impresa e Informe.

## Pendiente por confirmar
- Todos los productos deben tener el costo cargado; si no, la ganancia sale inflada.

## Decisión: precio del producto en ventas a crédito
- El recargo NO se guarda aparte. La venta se registra por el precio del plan (ej. ventana 120.000).
- El precio del producto es editable en el POS.
- NOTA IMPORTANTE (mostrar en el POS): si la venta es a crédito, el precio del producto debe ser el del plan (con recargo).
- Consecuencia: el informe por producto muestra el producto con el precio del plan (ej. Ventana 120.000), y la ganancia incluye el recargo.
