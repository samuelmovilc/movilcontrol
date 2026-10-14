-- ════════════════════════════════════════════════════════════════
-- Módulo "Órdenes de Servicio" (sastrería: reparación / diseño de prendas)
-- Fecha: 2026-10-13
--
-- Este script es IDEMPOTENTE: usa CREATE TABLE IF NOT EXISTS y
-- ADD COLUMN IF NOT EXISTS, así que es seguro correrlo más de una vez
-- y en cualquier base de datos de tenant (tenga o no ya estas tablas).
-- Requiere MySQL 8.0.29+ (soporte de "ADD COLUMN IF NOT EXISTS").
--
-- Se debe correr UNA VEZ por cada base de datos de tenant existente
-- (una conexión distinta por cada "db_name" de la tabla `tenants` en
-- la base `saas_master`). El script Node incluido en este mismo
-- folder (apply_ordenes_servicio.js) ya hace ese recorrido automático
-- si tiene acceso directo al servidor de Contabo.
-- ════════════════════════════════════════════════════════════════

-- 1. Catálogo de técnicos / vendedores del taller
CREATE TABLE IF NOT EXISTS tecnicos (
  id VARCHAR(50) PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(50),
  comision_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Encabezado de cada orden de servicio (una visita del cliente con 1+ prendas)
CREATE TABLE IF NOT EXISTS ordenes_servicio (
  id INT AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  cliente_id VARCHAR(50) NOT NULL,
  cliente VARCHAR(150),
  fecha_recibido DATE NOT NULL,
  fecha_entrega_estimada DATE NULL,
  fecha_entregado DATETIME NULL,
  observaciones TEXT,
  estado ENUM('cotizacion','terminada','anulada') NOT NULL DEFAULT 'cotizacion',
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  venta_id INT NULL,
  credito_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Cada prenda dentro de una orden (una orden puede traer varias)
CREATE TABLE IF NOT EXISTS orden_prendas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  tipo_prenda VARCHAR(100) NOT NULL,
  tipo_trabajo ENUM('reparacion','diseno','otro') NOT NULL DEFAULT 'reparacion',
  descripcion TEXT,
  observaciones TEXT,
  precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  tecnico_id VARCHAR(50) NULL,
  comision_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  comision_monto DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado ENUM('en_taller','lista','entregada') NOT NULL DEFAULT 'en_taller',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_servicio(id) ON DELETE CASCADE
);

-- 4. Enlazar órdenes con el sistema de crédito/cartera que ya existe
--    (una orden con saldo pendiente se financia exactamente igual que
--    hoy se financia un producto: mismo creditos/credito_cuotas).
ALTER TABLE creditos ADD COLUMN IF NOT EXISTS orden_servicio_id INT NULL;
ALTER TABLE ventas   ADD COLUMN IF NOT EXISTS orden_servicio_id INT NULL;

-- 5. Enlazar movimientos de caja con técnico y/u orden (sirve tanto para
--    el abono que deja el cliente al entregar la prenda, como para la
--    liquidación semanal de cada técnico) y una fecha editable (para
--    poder registrar egresos o pagos con fecha distinta a "hoy").
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS tecnico_id VARCHAR(50) NULL;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS orden_servicio_id INT NULL;
ALTER TABLE movimientos_caja ADD COLUMN IF NOT EXISTS fecha DATE NULL;
