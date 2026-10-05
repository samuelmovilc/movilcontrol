-- =============================================
-- PAPELERÍA APP - SCHEMA MariaDB
-- Ejecutar en el contenedor papeleria_app_mariadb
-- Comando: docker exec -i papeleria_app_mariadb mariadb -u pos_user -p'Pap3l3r!4#S3cur3_2026' papeleria_app < schema.sql
-- =============================================

USE motos_app;

-- CONFIGURACION
CREATE TABLE IF NOT EXISTS configuracion (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre_negocio  VARCHAR(200) NOT NULL DEFAULT 'Tienda de Motos',
  direccion       VARCHAR(300) DEFAULT 'Calle Principal #123',
  telefono        VARCHAR(50)  DEFAULT '555-123-4567',
  logo            LONGTEXT,
  metodos_pago    JSON,
  mensaje_tirilla TEXT,
  stock_critico   INT DEFAULT 10,
  tamano_ticket   VARCHAR(10) DEFAULT '80mm',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id              VARCHAR(50) PRIMARY KEY,
  nombre          VARCHAR(300) NOT NULL,
  imagen          LONGTEXT,
  precio_venta    DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio_compra   DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock           INT NOT NULL DEFAULT 0,
  entradas        INT NOT NULL DEFAULT 0,
  salidas         INT NOT NULL DEFAULT 0,
  fecha_carga     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  folio           VARCHAR(50) UNIQUE NOT NULL,
  fecha           DATE NOT NULL,
  hora            TIME NOT NULL,
  cliente         VARCHAR(200) DEFAULT '222222 - CLIENTE POS',
  observaciones   TEXT,
  metodo_pago     VARCHAR(300),
  metodos_pago    JSON,
  total           DECIMAL(12,2) NOT NULL DEFAULT 0,
  cambio          DECIMAL(12,2) DEFAULT 0,
  estado          ENUM('aceptada','anulada') DEFAULT 'aceptada',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- VENTA_PRODUCTOS
CREATE TABLE IF NOT EXISTS venta_productos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  venta_id        INT NOT NULL,
  producto_id     VARCHAR(50),
  nombre          VARCHAR(300) NOT NULL,
  cantidad        INT NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INDICES
CREATE INDEX IF NOT EXISTS idx_ventas_fecha   ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_estado  ON ventas(estado);
CREATE INDEX IF NOT EXISTS idx_vp_venta       ON venta_productos(venta_id);
CREATE INDEX IF NOT EXISTS idx_prod_nombre    ON productos(nombre);

-- DATOS INICIALES configuracion
INSERT INTO configuracion (nombre_negocio, direccion, telefono, metodos_pago, mensaje_tirilla)
VALUES (
  'Tienda de Motos',
  'Calle Principal #123',
  '555-123-4567',
  '["Efectivo","Tarjeta débito","Tarjeta crédito","Transferencia","Otro"]',
  '¡Gracias por su compra! Visítenos nuevamente.'
);

-- PRODUCTOS EJEMPLO
INSERT INTO productos (id, nombre, precio_venta, precio_compra, stock, entradas) VALUES
('750100000001','Cuaderno Profesional',45.00,30.00,50,50),
('750100000002','Lápiz Nº2',5.00,3.00,100,100),
('750100000003','Pluma Azul',8.00,4.50,80,80),
('750100000004','Borrador Blanco',3.50,2.00,60,60),
('750100000005','Marcador Permanente',12.00,7.00,40,40),
('750100000006','Cinta Adhesiva',10.00,6.50,30,30),
('750100000007','Grapadora',35.00,22.00,15,15),
('750100000008','Resaltador Amarillo',9.00,5.50,45,45),
('750100000009','Folder Manila',2.50,1.50,200,200),
('750100000010','Tijeras',18.00,12.00,25,25)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

CREATE TABLE IF NOT EXISTS catalogos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) UNIQUE NOT NULL,
  configuracion JSON NOT NULL,
  productos JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
