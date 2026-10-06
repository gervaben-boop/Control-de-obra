-- Etapa 2: base central para sincronizar celular y PC

create extension if not exists "pgcrypto";

create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text,
  telefono text,
  rol text,
  created_at timestamptz not null default now()
);

create table if not exists sectores (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  piso text,
  unidad text,
  ambiente text
);

create table if not exists tareas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  sector_id uuid references sectores(id) on delete set null,
  rubro text,
  descripcion text not null,
  responsable_id uuid references usuarios(id) on delete set null,
  prioridad text not null default 'Media',
  estado text not null default 'Pendiente',
  fecha_limite date,
  created_at timestamptz not null default now()
);

create table if not exists fotos (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid references tareas(id) on delete cascade,
  url text not null,
  tipo text,
  created_at timestamptz not null default now()
);

create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid references tareas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  comentario text not null,
  created_at timestamptz not null default now()
);
