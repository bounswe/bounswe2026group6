-- Normalize already-seeded demo help request type values after the product
-- transition to canonical request help types.

WITH normalized_demo_help_requests AS (
  SELECT
    request_id,
    ARRAY(
      SELECT DISTINCT mapped_type
      FROM unnest(help_types) AS raw_type
      CROSS JOIN LATERAL (
        SELECT CASE lower(trim(raw_type))
          WHEN 'search_rescue' THEN 'search_rescue'
          WHEN 'search_and_rescue' THEN 'search_rescue'
          WHEN 'sar' THEN 'search_rescue'
          WHEN 'fire_brigade' THEN 'search_rescue'
          WHEN 'rescue' THEN 'search_rescue'
          WHEN 'evacuation_transport' THEN 'shelter'
          WHEN 'security_support' THEN 'shelter'
          WHEN 'other' THEN 'shelter'
          WHEN 'medical' THEN 'first_aid'
          WHEN 'mobility' THEN 'shelter'
          WHEN 'food' THEN 'food_water'
          WHEN 'water' THEN 'food_water'
          WHEN 'food/water' THEN 'food_water'
          WHEN 'supplies' THEN 'food_water'
          WHEN 'basic_supplies' THEN 'food_water'
          ELSE lower(trim(raw_type))
        END AS mapped_type
      ) mapped
      WHERE mapped_type IN ('first_aid', 'food_water', 'shelter', 'search_rescue')
      ORDER BY mapped_type
    ) AS normalized_help_types,
    CASE lower(trim(need_type))
      WHEN 'search_rescue' THEN 'search_rescue'
      WHEN 'search_and_rescue' THEN 'search_rescue'
      WHEN 'sar' THEN 'search_rescue'
      WHEN 'fire_brigade' THEN 'search_rescue'
      WHEN 'rescue' THEN 'search_rescue'
      WHEN 'evacuation_transport' THEN 'shelter'
      WHEN 'security_support' THEN 'shelter'
      WHEN 'other' THEN 'shelter'
      WHEN 'medical' THEN 'first_aid'
      WHEN 'mobility' THEN 'shelter'
      WHEN 'food' THEN 'food_water'
      WHEN 'water' THEN 'food_water'
      WHEN 'food/water' THEN 'food_water'
      WHEN 'supplies' THEN 'food_water'
      WHEN 'basic_supplies' THEN 'food_water'
      ELSE lower(trim(need_type))
    END AS normalized_need_type
  FROM help_requests
  WHERE request_id LIKE 'demo_%'
     OR description ILIKE '[DEMO]%'
)
UPDATE help_requests hr
SET
  help_types = CASE
    WHEN cardinality(nd.normalized_help_types) > 0 THEN nd.normalized_help_types
    ELSE ARRAY['shelter']::text[]
  END,
  need_type = CASE
    WHEN nd.normalized_need_type IN ('first_aid', 'food_water', 'shelter', 'search_rescue')
      THEN nd.normalized_need_type
    WHEN cardinality(nd.normalized_help_types) > 0
      THEN nd.normalized_help_types[1]
    ELSE 'shelter'
  END
FROM normalized_demo_help_requests nd
WHERE hr.request_id = nd.request_id;

UPDATE volunteers
SET
  skills = ARRAY(
    SELECT DISTINCT mapped_skill
    FROM unnest(skills) AS raw_skill
    CROSS JOIN LATERAL (
      SELECT CASE lower(trim(raw_skill))
        WHEN 'search_and_rescue' THEN 'search_rescue'
        WHEN 'sar' THEN 'search_rescue'
        WHEN 'fire_brigade' THEN 'search_rescue'
        WHEN 'rescue' THEN 'search_rescue'
        ELSE lower(trim(raw_skill))
      END AS mapped_skill
    ) mapped
    ORDER BY mapped_skill
  ),
  need_types = ARRAY(
    SELECT DISTINCT mapped_need_type
    FROM unnest(need_types) AS raw_need_type
    CROSS JOIN LATERAL (
      SELECT CASE lower(trim(raw_need_type))
        WHEN 'search_and_rescue' THEN 'search_rescue'
        WHEN 'sar' THEN 'search_rescue'
        WHEN 'fire_brigade' THEN 'search_rescue'
        WHEN 'rescue' THEN 'search_rescue'
        WHEN 'evacuation_transport' THEN 'shelter'
        WHEN 'security_support' THEN 'shelter'
        WHEN 'other' THEN 'shelter'
        WHEN 'medical' THEN 'first_aid'
        WHEN 'mobility' THEN 'shelter'
        WHEN 'food' THEN 'food_water'
        WHEN 'water' THEN 'food_water'
        WHEN 'food/water' THEN 'food_water'
        WHEN 'supplies' THEN 'food_water'
        WHEN 'basic_supplies' THEN 'food_water'
        ELSE lower(trim(raw_need_type))
      END AS mapped_need_type
    ) mapped
    WHERE mapped_need_type IN ('first_aid', 'food_water', 'shelter', 'search_rescue')
    ORDER BY mapped_need_type
  )
WHERE volunteer_id LIKE 'demo_%'
  AND (skills && ARRAY['search_and_rescue', 'sar', 'fire_brigade', 'rescue']
    OR need_types && ARRAY[
      'search_and_rescue',
      'sar',
      'fire_brigade',
      'rescue',
      'evacuation_transport',
      'security_support',
      'other',
      'medical',
      'mobility',
      'food',
      'water',
      'food/water',
      'supplies',
      'basic_supplies'
    ]);

UPDATE expertise
SET expertise_area = replace(
  replace(
    replace(
      replace(expertise_area, 'search_and_rescue', 'search_rescue'),
      'fire_brigade',
      'search_rescue'
    ),
    'evacuation_transport',
    'shelter'
  ),
  'security_support',
  'shelter'
)
WHERE expertise_id LIKE 'demo_%'
  AND (
    expertise_area LIKE '%search_and_rescue%' OR
    expertise_area LIKE '%fire_brigade%' OR
    expertise_area LIKE '%evacuation_transport%' OR
    expertise_area LIKE '%security_support%'
  );
