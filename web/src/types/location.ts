export type Coordinate = {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    source?: string | null;
    capturedAt?: string | null;
};

export type AdministrativeLocation = {
    countryCode?: string | null;
    country?: string | null;
    city?: string | null;
    district?: string | null;
    neighborhood?: string | null;
    extraAddress?: string | null;
    postalCode?: string | null;
};

export type LocationSearchItem = {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    administrative: AdministrativeLocation;
};

export type LocationTreeNeighborhood = {
    label: string;
    value: string;
};

export type LocationTreeDistrict = {
    label: string;
    neighborhoods: LocationTreeNeighborhood[];
};

export type LocationTreeCity = {
    label: string;
    districts: Record<string, LocationTreeDistrict>;
};

export type LocationTreeCountry = {
    label: string;
    cities: Record<string, LocationTreeCity>;
};

export type LocationTreeMeta = {
    cityCount: number;
    districtCount: number;
    neighborhoodCount: number;
};

export type LocationTreeResponse = {
    countryCode: string;
    tree: LocationTreeCountry;
    meta: LocationTreeMeta;
};

export type LocationSearchResponse = {
    items: LocationSearchItem[];
};

export type LocationReverseResponse = {
    item: LocationSearchItem;
};

export type GeoJsonPointGeometry = {
    type: "Point";
    coordinates: [number, number];
};

export type GatheringAreaFeatureProperties = {
    id: string;
    osmType: string;
    name: string;
    category: string;
    distanceMeters: number;
    rawTags: Record<string, unknown>;
};

export type GatheringAreaFeature = {
    type: "Feature";
    geometry: GeoJsonPointGeometry;
    properties: GatheringAreaFeatureProperties;
};

export type GatheringAreaFeatureCollection = {
    type: "FeatureCollection";
    features: GatheringAreaFeature[];
};

export type NearbyGatheringAreasResponse = {
    center: {
        lat: number;
        lon: number;
    };
    radius: number;
    source: "overpass";
    meta: {
        requestedLimit: number;
        returnedCount: number;
    };
    collection: GatheringAreaFeatureCollection;
};
