# Location And Map Contracts (Web)

This document defines shared web-side contracts for location/map features.
It is intentionally infrastructure-focused and does not define page-level UI behavior.

## Base Location Endpoints

- `GET /api/location/tree?countryCode=TR`
  - Response shape:
    - `countryCode: string`
    - `tree: LocationTreeCountry`
    - `meta: { cityCount, districtCount, neighborhoodCount }`
- `GET /api/location/search?q=...&countryCode=TR&limit=10`
  - Response shape:
    - `items: LocationSearchItem[]`
- `GET /api/location/reverse?lat=...&lon=...`
  - Response shape:
    - `item: LocationSearchItem`

Web client helpers:

- `web/src/lib/location.ts`

## Gathering Areas (Overpass-backed) Contract

- `GET /api/gathering-areas/nearby?lat=...&lon=...&radius=...&limit=...`
  - Response shape:
    - `center: { lat, lon }`
    - `radius: number`
    - `source: string`
    - `meta: { requestedLimit, returnedCount }`
    - `collection: FeatureCollection`

Feature contract notes:

- GeoJSON ordering uses `[longitude, latitude]`.
- Feature geometry type is `Point`.
- `properties` includes map-ready metadata:
  - `id`, `osmType`, `name`, `category`, `distanceMeters`, `rawTags`.

Web shared contracts and helper:

- `web/src/types/location.ts`
- `web/src/lib/gatheringAreas.ts`

## Scope Guard

This contract layer is reusable infrastructure.
Gathering areas screen/page rendering behavior is handled in a separate feature issue.
