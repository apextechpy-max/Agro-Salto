-- SCRIPT DE MIGRACIÓN PARA SUPABASE (POSTGRESQL)
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Extensiones (opcional)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tablas Base
CREATE TABLE IF NOT EXISTS filiales (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(50),
    activa SMALLINT DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre_completo VARCHAR(100),
    perfil VARCHAR(20) DEFAULT 'USER', -- ADMIN, USER, VETERINARIO
    filial_id INTEGER REFERENCES filiales(id),
    activo SMALLINT DEFAULT 1,
    ultimo_acceso TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    padre_id INTEGER REFERENCES categorias(id),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria_id INTEGER REFERENCES categorias(id),
    unidad_medida VARCHAR(20) DEFAULT 'UNIDAD',
    precio_costo DECIMAL(15,2) DEFAULT 0,
    precio_venta_menor DECIMAL(15,2) DEFAULT 0,
    precio_venta_mayor DECIMAL(15,2) DEFAULT 0,
    iva_tipo VARCHAR(10) DEFAULT '10', -- 0, 5, 10
    stock_minimo DECIMAL(15,2) DEFAULT 0,
    requiere_receta SMALLINT DEFAULT 0,
    tipo_inventario VARCHAR(20) DEFAULT 'AMBOS', -- CLINICA, PETSHOP, AMBOS
    foto_url TEXT,
    activo SMALLINT DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL, -- CLIENTE, PROVEEDOR, AMBOS
    razon_social VARCHAR(200) NOT NULL,
    ruc VARCHAR(50),
    ci VARCHAR(50),
    telefono VARCHAR(50),
    email VARCHAR(100),
    direccion TEXT,
    condicion_iva VARCHAR(50) DEFAULT 'CONTRIBUYENTE',
    condicion_pago VARCHAR(50) DEFAULT 'CONTADO',
    limite_credito DECIMAL(15,2) DEFAULT 0,
    saldo_cuenta DECIMAL(15,2) DEFAULT 0,
    comision_pct DECIMAL(5,2) DEFAULT 0,
    activo SMALLINT DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Stock y Lotes
CREATE TABLE IF NOT EXISTS stock (
    producto_id INTEGER REFERENCES productos(id),
    filial_id INTEGER REFERENCES filiales(id),
    cantidad DECIMAL(15,2) DEFAULT 0,
    PRIMARY KEY (producto_id, filial_id)
);

CREATE TABLE IF NOT EXISTS lotes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id),
    filial_id INTEGER REFERENCES filiales(id),
    numero_lote VARCHAR(100),
    codigo_lote VARCHAR(100) UNIQUE,
    fecha_vto DATE,
    cantidad_ini DECIMAL(15,2),
    cantidad_act DECIMAL(15,2),
    costo_unitario DECIMAL(15,2),
    estado VARCHAR(20) DEFAULT 'ACTIVO', -- ACTIVO, VENCIDO, AGOTADO
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_stock (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL, -- VENTA, COMPRA, TRANSFERENCIA, AJUSTE, BAJA
    producto_id INTEGER REFERENCES productos(id),
    lote_id INTEGER REFERENCES lotes(id),
    filial_origen INTEGER REFERENCES filiales(id),
    filial_destino INTEGER REFERENCES filiales(id),
    cantidad DECIMAL(15,2) NOT NULL,
    costo_unit DECIMAL(15,2),
    observacion TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Compras
CREATE TABLE IF NOT EXISTS compras (
    id SERIAL PRIMARY KEY,
    proveedor_id INTEGER REFERENCES personas(id),
    filial_id INTEGER REFERENCES filiales(id),
    numero_factura VARCHAR(100),
    fecha DATE,
    subtotal DECIMAL(15,2),
    iva_5 DECIMAL(15,2),
    iva_10 DECIMAL(15,2),
    total DECIMAL(15,2),
    estado VARCHAR(20) DEFAULT 'COMPLETADA',
    observacion TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compras_detalle (
    id SERIAL PRIMARY KEY,
    compra_id INTEGER REFERENCES compras(id),
    producto_id INTEGER REFERENCES productos(id),
    lote_id INTEGER REFERENCES lotes(id),
    cantidad DECIMAL(15,2),
    costo_unit DECIMAL(15,2),
    iva_tipo VARCHAR(10),
    subtotal DECIMAL(15,2)
);

-- 5. Ventas
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) DEFAULT 'MINORISTA', -- MINORISTA, MAYORISTA, PRESUPUESTO
    cliente_id INTEGER REFERENCES personas(id),
    filial_id INTEGER REFERENCES filiales(id),
    subtotal DECIMAL(15,2),
    descuento DECIMAL(15,2) DEFAULT 0,
    iva_5 DECIMAL(15,2),
    iva_10 DECIMAL(15,2),
    total DECIMAL(15,2),
    tipo_pago VARCHAR(20) DEFAULT 'CONTADO',
    monto_pagado DECIMAL(15,2),
    vuelto DECIMAL(15,2) DEFAULT 0,
    moneda_pago VARCHAR(10) DEFAULT 'GS',
    estado VARCHAR(20) DEFAULT 'COMPLETADA', -- COMPLETADA, ANULADA, PRE-VENTA, PRESUPUESTO
    vendedor_id INTEGER REFERENCES usuarios(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    observacion TEXT,
    comprobante_pago TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER REFERENCES ventas(id),
    producto_id INTEGER REFERENCES productos(id),
    cantidad DECIMAL(15,2),
    precio_unit DECIMAL(15,2),
    iva_tipo VARCHAR(10),
    descuento DECIMAL(15,2) DEFAULT 0,
    subtotal DECIMAL(15,2)
);

-- 6. Caja
CREATE TABLE IF NOT EXISTS cajas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    filial_id INTEGER REFERENCES filiales(id),
    activa SMALLINT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS aperturas_caja (
    id SERIAL PRIMARY KEY,
    caja_id INTEGER REFERENCES cajas(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    filial_id INTEGER REFERENCES filiales(id),
    monto_inicial DECIMAL(15,2),
    monto_declarado DECIMAL(15,2),
    monto_sistema DECIMAL(15,2),
    diferencia DECIMAL(15,2),
    cambio_usd DECIMAL(15,2),
    cambio_brl DECIMAL(15,2),
    cambio_ars DECIMAL(15,2),
    estado VARCHAR(20) DEFAULT 'ABIERTA',
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimientos_caja (
    id SERIAL PRIMARY KEY,
    apertura_id INTEGER REFERENCES aperturas_caja(id),
    tipo VARCHAR(10) NOT NULL, -- INGRESO, EGRESO
    concepto TEXT,
    ref_tipo VARCHAR(20), -- VENTA, COMPRA, APERTURA, MANUAL
    ref_id INTEGER,
    monto DECIMAL(15,2) NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Cuentas Corrientes
CREATE TABLE IF NOT EXISTS cuentas_corrientes (
    id SERIAL PRIMARY KEY,
    persona_id INTEGER REFERENCES personas(id),
    tipo VARCHAR(20) NOT NULL, -- COBRAR, PAGAR
    concepto TEXT,
    monto_original DECIMAL(15,2),
    saldo DECIMAL(15,2),
    ref_tipo VARCHAR(20),
    ref_id INTEGER,
    estado VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, PARCIAL, PAGADO, ANULADA
    usuario_id INTEGER REFERENCES usuarios(id),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pagos_cc (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER REFERENCES cuentas_corrientes(id),
    monto DECIMAL(15,2) NOT NULL,
    tipo_pago VARCHAR(20),
    usuario_id INTEGER REFERENCES usuarios(id),
    observacion TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Módulo Veterinario
CREATE TABLE IF NOT EXISTS mascotas (
    id SERIAL PRIMARY KEY,
    persona_id INTEGER REFERENCES personas(id),
    nombre VARCHAR(100) NOT NULL,
    especie VARCHAR(50) NOT NULL,
    raza VARCHAR(50),
    color VARCHAR(50),
    sexo VARCHAR(20),
    fecha_nacimiento DATE,
    peso_kg DECIMAL(10,2),
    microchip VARCHAR(100),
    observaciones TEXT,
    activa SMALLINT DEFAULT 1,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultas (
    id SERIAL PRIMARY KEY,
    mascota_id INTEGER REFERENCES mascotas(id),
    veterinario_id INTEGER REFERENCES usuarios(id),
    pre_venta_id INTEGER,
    tipo_consulta VARCHAR(50),
    motivo TEXT,
    diagnostico TEXT,
    tratamiento TEXT,
    peso_kg DECIMAL(10,2),
    temperatura DECIMAL(5,2),
    observaciones TEXT,
    estado VARCHAR(20) DEFAULT 'ABIERTA', -- ABIERTA, FINALIZADA
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultas_progreso (
    id SERIAL PRIMARY KEY,
    consulta_id INTEGER REFERENCES consultas(id),
    diagnostico TEXT,
    tratamiento TEXT,
    peso_kg DECIMAL(10,2),
    temperatura DECIMAL(5,2),
    justificacion TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recetas (
    id SERIAL PRIMARY KEY,
    consulta_id INTEGER REFERENCES consultas(id),
    mascota_id INTEGER REFERENCES mascotas(id),
    veterinario_id INTEGER REFERENCES usuarios(id),
    indicaciones TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recetas_detalle (
    id SERIAL PRIMARY KEY,
    receta_id INTEGER REFERENCES recetas(id),
    producto_id INTEGER REFERENCES productos(id),
    descripcion TEXT,
    cantidad DECIMAL(10,2),
    posologia TEXT
);

CREATE TABLE IF NOT EXISTS internacion (
    id SERIAL PRIMARY KEY,
    consulta_id INTEGER REFERENCES consultas(id),
    mascota_id INTEGER REFERENCES mascotas(id),
    observaciones TEXT,
    constantes TEXT,
    estado VARCHAR(20) DEFAULT 'ACTIVA',
    fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_egreso TIMESTAMP
);

CREATE TABLE IF NOT EXISTS constantes_vitales (
    id SERIAL PRIMARY KEY,
    internacion_id INTEGER REFERENCES internacion(id),
    temperatura DECIMAL(5,2),
    frecuencia_card INTEGER,
    frecuencia_resp INTEGER,
    peso_kg DECIMAL(10,2),
    observacion TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agenda (
    id SERIAL PRIMARY KEY,
    mascota_id INTEGER REFERENCES mascotas(id),
    persona_id INTEGER REFERENCES personas(id),
    titulo VARCHAR(200) NOT NULL,
    tipo_evento VARCHAR(50),
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    color VARCHAR(20),
    veterinario_id INTEGER REFERENCES usuarios(id),
    notas TEXT,
    estado VARCHAR(20) DEFAULT 'PROGRAMADO',
    notificado_wa SMALLINT DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Insertar datos iniciales básicos
INSERT INTO filiales (nombre, direccion, activa) VALUES ('Casa Central', 'Dirección Central', 1);
INSERT INTO usuarios (usuario, password_hash, nombre_completo, perfil, filial_id, activo) 
VALUES ('admin', '$2a$10$9UaHbottCM49odk5EWsZSuzUL8AaDw4YuzWaX10X/dy2z7f4Ddz2O', 'Administrador Principal', 'ADMIN', 1, 1)
ON CONFLICT (usuario) DO UPDATE SET password_hash = EXCLUDED.password_hash;
-- Contraseña por defecto: admin123

INSERT INTO usuarios (usuario, password_hash, nombre_completo, perfil, filial_id, activo)
VALUES ('Caja1', '$2a$10$eqs6TqVnVhPGUbu5ro6O7OvhD8ChHXq7fv3jWZwGxzpEhrx0YgEF2', 'Operador Caja 1', 'CAJERO_1', 1, 1)
ON CONFLICT (usuario) DO UPDATE SET password_hash = EXCLUDED.password_hash;
-- Contraseña por defecto: 12345

INSERT INTO cajas (nombre, filial_id, activa) VALUES ('Caja Principal', 1, 1);
