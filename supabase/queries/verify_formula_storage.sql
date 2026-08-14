-- Verifikasi kolom rumus di sensor_data
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sensor_data'
  and column_name in (
    'formula_name',
    'formula_soil',
    'formula_vpd',
    'formula_score',
    'soil_raw_dry'
  )
order by column_name;

-- Verifikasi tabel chat_messages dan kolom metadata
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'chat_messages';

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'chat_messages'
  and column_name = 'metadata';

-- Cek 5 data sensor terbaru yang membawa rumus Arduino
select
  created_at,
  device_id,
  formula_name,
  formula_soil,
  formula_vpd,
  formula_score,
  soil_raw_dry
from public.sensor_data
where formula_name is not null
   or formula_soil is not null
   or formula_vpd is not null
   or formula_score is not null
   or soil_raw_dry is not null
order by created_at desc
limit 5;

-- Cek 5 chat terakhir beserta metadata snapshot-nya
select
  created_at,
  role,
  user_id,
  content,
  metadata
from public.chat_messages
order by created_at desc
limit 5;

-- Cek apakah metadata chat benar-benar memuat snapshot sensor dan formula
select
  created_at,
  role,
  metadata -> 'sensor_snapshot' ->> 'formula_name' as formula_name,
  metadata -> 'sensor_snapshot' ->> 'formula_soil' as formula_soil,
  metadata -> 'sensor_snapshot' ->> 'formula_vpd' as formula_vpd,
  metadata -> 'sensor_snapshot' ->> 'formula_score' as formula_score,
  metadata -> 'sensor_snapshot' ->> 'soil_raw_dry' as soil_raw_dry
from public.chat_messages
where metadata ? 'sensor_snapshot'
order by created_at desc
limit 10;
