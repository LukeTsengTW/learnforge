-- Keep persisted width bounds aligned with src/models/drawing.ts.
-- The drawing-raster regression suite checks this SQL/TypeScript contract.
-- CREATE OR REPLACE retains the existing helper identity and execution grants.
create or replace function private.v4_strokes_shape_valid(p_strokes jsonb, p_drawing jsonb) returns boolean language plpgsql immutable
set search_path = '' as $$
declare
  v_stroke jsonb;
  v_point jsonb;
  v_points integer := 0;
  v_width numeric;
  v_height numeric;
begin
  if pg_catalog.jsonb_typeof(p_strokes) is distinct from 'array' or pg_catalog.jsonb_array_length(p_strokes) > 256
    or not private.v4_drawing_config_valid(p_drawing) then
    return false;
  end if;
  v_width := (p_drawing->>'width')::numeric;
  v_height := (p_drawing->>'height')::numeric;
  for v_stroke in select value from pg_catalog.jsonb_array_elements(p_strokes) loop
    if pg_catalog.jsonb_typeof(v_stroke) is distinct from 'object' or private.v4_key_count(v_stroke) <> 4
      or not (v_stroke ?& array['tool', 'color', 'width', 'points'])
      or v_stroke->>'tool' not in ('pen', 'eraser')
      or v_stroke->>'color' not in ('#202b38', '#c03535', '#255bbb')
      or pg_catalog.jsonb_typeof(v_stroke->'color') is distinct from 'string'
      or pg_catalog.jsonb_typeof(v_stroke->'width') is distinct from 'number'
      or (v_stroke->>'width')::numeric < 1 or (v_stroke->>'width')::numeric > 100
      or pg_catalog.jsonb_typeof(v_stroke->'points') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_stroke->'points') = 0 then
      return false;
    end if;
    v_points := v_points + pg_catalog.jsonb_array_length(v_stroke->'points');
    if v_points > 6000 then return false; end if;
    for v_point in select value from pg_catalog.jsonb_array_elements(v_stroke->'points') loop
      if pg_catalog.jsonb_typeof(v_point) is distinct from 'object' or private.v4_key_count(v_point) <> 2
        or pg_catalog.jsonb_typeof(v_point->'x') is distinct from 'number'
        or pg_catalog.jsonb_typeof(v_point->'y') is distinct from 'number'
        or (v_point->>'x')::numeric < 0 or (v_point->>'x')::numeric > v_width
        or (v_point->>'y')::numeric < 0 or (v_point->>'y')::numeric > v_height then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end $$;
