# curation-data-access (delta)

## ADDED Requirements

### Requirement: Corridor reads go through the content_near_route RPC
Route-corridor queries SHALL use a single Postgres RPC, `content_near_route(region, line, radius_m)`, declared SECURITY INVOKER so all rows pass through the existing RLS policies. The RPC SHALL filter with ST_DWithin against the geography columns (default radius 8046.72 m) and return, per row, the published columns explore reads plus `off_line_m` and `along_pos` (position along the rider's line). Geometry SHALL return through the computed `geojson` path (PostgREST serves raw geography as WKB hex).

#### Scenario: Anonymous rider queries a corridor
- **WHEN** the along-route surface calls the RPC with the anon client
- **THEN** only `review_status = 'keep'` rows in accessible regions return, each with off-line distance and along-route position, and `hold`/`kill`/`pending_review` rows are absent

#### Scenario: Untraced road segments
- **WHEN** the RPC runs while road segments have null geometry
- **THEN** those segments are simply absent from corridor results, and they join in milepost order once traced geometry lands

## MODIFIED Requirements

### Requirement: Routes are joined per segment
Curated route geometry SHALL always be assembled by joining `route_segments` in position order; a curated route SHALL never be merged into a single LineString for querying or storage. The rider's own route line is not a curated composition: it legitimately exists as one LineString, held client-side and passed to the corridor RPC as a single geometry.

#### Scenario: Route rendered on explore
- **WHEN** a curated route displays on the map
- **THEN** its segments load as individual geometries joined over `route_segments` ordered by `position`

#### Scenario: Rider's line queried
- **WHEN** the corridor RPC receives the rider's route
- **THEN** it accepts one LineString, and no attempt is made to decompose or store it as curated segments
