"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { GatheringAreasMap } from "@/components/feature/location/GatheringAreasMap";
import { fetchNearbyGatheringAreas } from "@/lib/gatheringAreas";
import { openDirections } from "@/lib/mapDirections";
import { reverseLocation } from "@/lib/location";
import type { GatheringAreaCategoryMeta, GatheringAreaFeature, NearbyGatheringAreasResponse } from "@/types/location";
import type { GatheringAreaMapFeature } from "@/components/feature/location/LeafletGatheringAreasMap";

const DEFAULT_CENTER = {
    latitude: 41.0082,
    longitude: 28.9784,
};

const DEFAULT_RADIUS = 2000;
const DEFAULT_LIMIT = 20;
const SEARCH_RADIUS_KM = DEFAULT_RADIUS / 1000;
const ADDRESS_UNAVAILABLE = "Address unavailable";
const GATHERING_AREAS_CACHE_KEY = "neph.nearbyGatheringAreas.cache.v1";
type FetchState = "idle" | "loading" | "success" | "empty" | "error" | "fallback";

type GatheringAreasCache = {
    response: NearbyGatheringAreasResponse;
    savedAt: string;
};

type CategoryOption = {
    key: string;
    label: string;
};

const FALLBACK_GATHERING_AREA_FEATURES: GatheringAreaFeature[] = [
    {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [28.9784, 41.0082],
        },
        properties: {
            id: "demo-sultanahmet-assembly",
            osmType: "fallback",
            name: "Demo central assembly area",
            category: "assembly_point",
            distanceMeters: 0,
            rawTags: {
                address: "Sultanahmet area, Istanbul",
                description: "Demo fallback area shown when the live gathering-area provider is unavailable.",
            },
        },
    },
    {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [28.9924, 41.0422],
        },
        properties: {
            id: "demo-taksim-support",
            osmType: "fallback",
            name: "Demo community support point",
            category: "shelter",
            distanceMeters: 4100,
            rawTags: {
                address: "Taksim area, Istanbul",
                description: "Demo fallback point for presentation and outage guidance.",
            },
        },
    },
    {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [29.0304, 40.9903],
        },
        properties: {
            id: "demo-kadikoy-assembly",
            osmType: "fallback",
            name: "Demo Kadıköy assembly area",
            category: "assembly_point",
            distanceMeters: 4800,
            rawTags: {
                address: "Kadıköy coastline area, Istanbul",
                description: "Demo fallback area; verify official instructions during a real emergency.",
            },
        },
    },
];

function formatCategoryLabel(category: string) {
    const normalized = (category || "").trim().toLowerCase();

    if (!normalized || normalized === "unknown") {
        return "Gathering area";
    }

    if (normalized === "assembly_point") {
        return "Assembly area";
    }

    if (normalized === "shelter") {
        return "Shelter";
    }

    return normalized
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function normalizeCategoryKey(value: string) {
    return (value || "").trim().toLowerCase() || "other";
}

function buildCategoryLabel(key: string, backendLabel?: string) {
    const explicit = (backendLabel || "").trim();
    if (explicit) {
        return explicit;
    }

    return formatCategoryLabel(key);
}

function deriveCategoryOptions(
    areas: GatheringAreaMapFeature[],
    metadata?: GatheringAreaCategoryMeta[]
) {
    const categoryMap = new Map<string, string>();

    for (const item of metadata || []) {
        const key = normalizeCategoryKey(item.key);
        categoryMap.set(key, buildCategoryLabel(key, item.label));
    }

    for (const area of areas) {
        const key = normalizeCategoryKey(area.category);
        if (!categoryMap.has(key)) {
            categoryMap.set(key, buildCategoryLabel(key, area.categoryLabel));
        }
    }

    return Array.from(categoryMap.entries()).map(([key, label]) => ({ key, label }));
}

function getLegendSwatchColor(categoryKey: string) {
    const normalized = normalizeCategoryKey(categoryKey);
    if (normalized === "assembly_point") return "#e35f4f";
    if (normalized === "shelter") return "#f3b545";
    if (normalized === "hospital") return "#ef4444";
    if (normalized === "police") return "#3b82f6";
    if (normalized === "fire_station") return "#f97316";
    if (normalized === "pharmacy") return "#22c55e";
    return "#4da2ea";
}

function formatDistanceLabel(distanceMeters: number) {
    if (distanceMeters >= 1000) {
        return `${(distanceMeters / 1000).toFixed(1)} km`;
    }

    return `${distanceMeters} m`;
}

function readTagValue(rawTags: Record<string, unknown>, key: string) {
    const value = rawTags[key];
    return typeof value === "string" ? value.trim() : "";
}

function buildAddressFromRawTags(rawTags: Record<string, unknown>) {
    const direct =
        readTagValue(rawTags, "addr:full") ||
        readTagValue(rawTags, "address") ||
        readTagValue(rawTags, "description");

    if (direct) {
        return direct;
    }

    const street = readTagValue(rawTags, "addr:street");
    const houseNumber = readTagValue(rawTags, "addr:housenumber");
    const neighborhood = readTagValue(rawTags, "addr:suburb") || readTagValue(rawTags, "addr:neighbourhood");
    const district = readTagValue(rawTags, "addr:district");
    const city = readTagValue(rawTags, "addr:city") || readTagValue(rawTags, "is_in:city");

    const streetLine = [street, houseNumber].filter(Boolean).join(" ");
    const localityLine = [neighborhood, district, city].filter(Boolean).join(", ");
    const address = [streetLine, localityLine].filter(Boolean).join(", ");

    return address || ADDRESS_UNAVAILABLE;
}

function buildAddressFromReverseLookup(item: {
    displayName?: string;
    administrative?: {
        neighborhood?: string | null;
        district?: string | null;
        city?: string | null;
        extraAddress?: string | null;
        country?: string | null;
    };
}) {
    const displayName = (item.displayName || "").trim();
    if (displayName) {
        return displayName;
    }

    const admin = item.administrative || {};
    const locality = [admin.neighborhood, admin.district, admin.city]
        .map((part) => (part || "").trim())
        .filter(Boolean)
        .join(", ");

    const address = [admin.extraAddress, locality, admin.country]
        .map((part) => (part || "").trim())
        .filter(Boolean)
        .join(", ");

    return address || ADDRESS_UNAVAILABLE;
}

function isAddressUnavailable(address: string) {
    return !address || address === ADDRESS_UNAVAILABLE;
}

function getCoordinateCacheKey(latitude: number, longitude: number) {
    return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function mapFeature(feature: GatheringAreaFeature): GatheringAreaMapFeature | null {
    const [longitude, latitude] = feature.geometry.coordinates;
    const osmType = feature.properties.osmType || "unknown";
    const baseId = feature.properties.id || "unknown";
    const featureKey = `${osmType}:${baseId}`;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    return {
        featureKey,
        id: baseId,
        osmType,
        name: feature.properties.name || "Unnamed gathering area",
        address: buildAddressFromRawTags(feature.properties.rawTags || {}),
        category: feature.properties.category || "unknown",
        categoryLabel: buildCategoryLabel(
            feature.properties.category || "unknown",
            feature.properties.categoryLabel
        ),
        distanceMeters: feature.properties.distanceMeters,
        latitude,
        longitude,
    };
}

function readCachedGatheringAreas(): GatheringAreasCache | null {
    try {
        const raw = window.localStorage.getItem(GATHERING_AREAS_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<GatheringAreasCache>;
        if (!parsed.response || typeof parsed.savedAt !== "string") {
            return null;
        }

        return {
            response: parsed.response,
            savedAt: parsed.savedAt,
        };
    } catch {
        return null;
    }
}

function cacheGatheringAreas(response: NearbyGatheringAreasResponse, savedAt: string) {
    try {
        window.localStorage.setItem(
            GATHERING_AREAS_CACHE_KEY,
            JSON.stringify({ response, savedAt })
        );
    } catch {
        // Cache is best-effort only.
    }
}

function formatLastUpdated(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function describeGatheringAreaFailure(rawMessage: string) {
    if (/could not reach the server/i.test(rawMessage)) {
        return "the live gathering-area service did not respond";
    }

    if (rawMessage === "Internal Server Error") {
        return "the gathering-area service returned an unexpected error";
    }

    return rawMessage || "the gathering-area service did not respond";
}

function mapFeatures(features: GatheringAreaFeature[]) {
    return features
        .map(mapFeature)
        .filter((item): item is GatheringAreaMapFeature => item !== null);
}

function getFallbackMapFeatures() {
    return mapFeatures(FALLBACK_GATHERING_AREA_FEATURES);
}

export default function GatheringAreasPage() {
    const [center, setCenter] = React.useState(DEFAULT_CENTER);
    const [areas, setAreas] = React.useState<GatheringAreaMapFeature[]>([]);
    const [categoryOptions, setCategoryOptions] = React.useState<CategoryOption[]>([]);
    const [selectedCategoryKeys, setSelectedCategoryKeys] = React.useState<string[]>([]);
    const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(true);
    const [fetchState, setFetchState] = React.useState<FetchState>("idle");
    const [resolvingLocation, setResolvingLocation] = React.useState(true);
    const [error, setError] = React.useState("");
    const [locationNote, setLocationNote] = React.useState("Resolving your current location...");
    const [dataNotice, setDataNotice] = React.useState("");
    const [dataNoticeTitle, setDataNoticeTitle] = React.useState("");
    const [directionsMessage, setDirectionsMessage] = React.useState("");
    const [lastUpdated, setLastUpdated] = React.useState("");
    const requestIdRef = React.useRef(0);
    const reverseAddressCacheRef = React.useRef<Map<string, string>>(new Map());

    const filteredAreas = React.useMemo(() => {
        if (!selectedCategoryKeys.length) {
            return areas;
        }
        const selected = new Set(selectedCategoryKeys.map(normalizeCategoryKey));
        return areas.filter((item) => selected.has(normalizeCategoryKey(item.category)));
    }, [areas, selectedCategoryKeys]);

    const hydrateMissingAddresses = React.useCallback(
        async (items: GatheringAreaMapFeature[], requestId: number) => {
            const unresolved = items.filter((item) => isAddressUnavailable(item.address));
            if (!unresolved.length) {
                return;
            }

            const updates = await Promise.all(
                unresolved.map(async (item) => {
                    const cacheKey = getCoordinateCacheKey(item.latitude, item.longitude);
                    const cached = reverseAddressCacheRef.current.get(cacheKey);

                    if (cached) {
                        return { featureKey: item.featureKey, address: cached };
                    }

                    try {
                        const response = await reverseLocation({
                            latitude: item.latitude,
                            longitude: item.longitude,
                        });
                        const address = buildAddressFromReverseLookup(response.item || {});

                        if (isAddressUnavailable(address)) {
                            return null;
                        }

                        reverseAddressCacheRef.current.set(cacheKey, address);
                        return { featureKey: item.featureKey, address };
                    } catch {
                        return null;
                    }
                })
            );

            if (requestId !== requestIdRef.current) {
                return;
            }

            const resolvedAddressByFeature = new Map(
                updates
                    .filter((entry): entry is { featureKey: string; address: string } => Boolean(entry))
                    .map((entry) => [entry.featureKey, entry.address])
            );

            if (!resolvedAddressByFeature.size) {
                return;
            }

            setAreas((current) =>
                current.map((item) => {
                    const resolvedAddress = resolvedAddressByFeature.get(item.featureKey);
                    if (!resolvedAddress || !isAddressUnavailable(item.address)) {
                        return item;
                    }

                    return {
                        ...item,
                        address: resolvedAddress,
                    };
                })
            );
        },
        []
    );

    const handleSelectArea = React.useCallback((featureId: string) => {
        setSelectedAreaId(featureId);
        setIsDetailsOpen(true);
        setDirectionsMessage("");
    }, []);

    const loadNearbyAreas = React.useCallback(
        async (sourceCenter: { latitude: number; longitude: number }) => {
            const currentRequestId = ++requestIdRef.current;

            try {
                setFetchState("loading");
                setError("");
                setDataNotice("");
                setDataNoticeTitle("");

                const response = await fetchNearbyGatheringAreas({
                    latitude: sourceCenter.latitude,
                    longitude: sourceCenter.longitude,
                    radius: DEFAULT_RADIUS,
                    limit: DEFAULT_LIMIT,
                });

                if (currentRequestId !== requestIdRef.current) {
                    return;
                }

                const mapped = mapFeatures(response.collection.features);
                const responseCategoryOptions = deriveCategoryOptions(mapped, response.meta.categories);

                if (response.source === "overpass") {
                    const savedAt = new Date().toISOString();
                    cacheGatheringAreas(response, savedAt);
                    setLastUpdated(savedAt);
                }

                if (response.source === "stale_cache") {
                    setDataNoticeTitle("Using backend cached gathering areas");
                    setDataNotice(
                        `The live provider failed${response.meta.providerErrorCode ? ` (${response.meta.providerErrorCode})` : ""}. Showing the backend's cached result.`
                    );
                    setLastUpdated("");
                } else if (response.source === "fallback") {
                    const fallbackAreas = mapped.length ? mapped : getFallbackMapFeatures();
                    const savedAt = new Date().toISOString();
                    const fallbackReason =
                        response.meta.fallbackReason || "The live gathering-area provider is unavailable.";

                    if (!mapped.length) {
                        setCenter(DEFAULT_CENTER);
                        setLocationNote("Live provider unavailable. Showing demo gathering areas around Istanbul.");
                    } else {
                        setLocationNote("Live provider unavailable. Showing backend fallback gathering areas.");
                    }
                    setAreas(fallbackAreas);
                    const fallbackCategoryOptions = deriveCategoryOptions(fallbackAreas, response.meta.categories);
                    setCategoryOptions(fallbackCategoryOptions);
                    setSelectedCategoryKeys(fallbackCategoryOptions.map((item) => item.key));
                    void hydrateMissingAddresses(fallbackAreas, currentRequestId);
                    setDataNoticeTitle(mapped.length ? "Using backend fallback gathering areas" : "Using demo gathering areas");
                    setDataNotice(
                        mapped.length
                            ? `${fallbackReason} Showing fallback gathering areas so the page remains usable. Retry to refresh live results.`
                            : `${fallbackReason} Showing demo Istanbul areas and guidance so the page remains usable.`
                    );
                    setLastUpdated(savedAt);
                    setFetchState("fallback");
                    setSelectedAreaId(null);
                    return;
                } else {
                    setDataNotice("");
                    setDataNoticeTitle("");
                }

                setAreas(mapped);
                setCategoryOptions(responseCategoryOptions);
                setSelectedCategoryKeys(responseCategoryOptions.map((item) => item.key));
                void hydrateMissingAddresses(mapped, currentRequestId);
                setFetchState(mapped.length ? "success" : "empty");
                setSelectedAreaId((current) => {
                    if (!mapped.length) {
                        return null;
                    }

                    if (current && mapped.some((item) => item.featureKey === current)) {
                        return current;
                    }

                    return null;
                });
            } catch (err) {
                if (currentRequestId !== requestIdRef.current) {
                    return;
                }

                const rawMessage =
                    err instanceof Error
                        ? err.message
                        : "Could not load gathering areas right now.";

                const uiMessage = describeGatheringAreaFailure(rawMessage);

                const cached = readCachedGatheringAreas();
                const cachedAreas = cached
                    ? mapFeatures(cached.response.collection.features)
                    : [];
                const cachedCategoryOptions = cached
                    ? deriveCategoryOptions(cachedAreas, cached.response.meta.categories)
                    : [];

                if (cached && cachedAreas.length) {
                    setCenter({
                        latitude: cached.response.center.lat,
                        longitude: cached.response.center.lon,
                    });
                    setLocationNote("Showing cached gathering areas from your last successful lookup.");
                    setAreas(cachedAreas);
                    setCategoryOptions(cachedCategoryOptions);
                    setSelectedCategoryKeys(cachedCategoryOptions.map((item) => item.key));
                    setSelectedAreaId(null);
                    setError("");
                    setDataNoticeTitle("Using cached gathering areas");
                    setDataNotice(`Live gathering areas could not be refreshed (${uiMessage}). Showing your last saved result.`);
                    setLastUpdated(cached.savedAt);
                    setFetchState("fallback");
                    return;
                }

                const fallbackAreas = getFallbackMapFeatures();
                const savedAt = new Date().toISOString();
                setCenter(DEFAULT_CENTER);
                setLocationNote("Live provider unavailable. Showing demo gathering areas around Istanbul.");
                setAreas(fallbackAreas);
                const fallbackCategoryOptions = deriveCategoryOptions(fallbackAreas);
                setCategoryOptions(fallbackCategoryOptions);
                setSelectedCategoryKeys(fallbackCategoryOptions.map((item) => item.key));
                setSelectedAreaId(null);
                setError("");
                setDataNoticeTitle("Using demo gathering areas");
                setDataNotice(`Live gathering areas could not be refreshed (${uiMessage}). Showing demo Istanbul areas and guidance.`);
                setLastUpdated(savedAt);
                setFetchState(fallbackAreas.length ? "fallback" : "error");
            } finally {
                if (currentRequestId !== requestIdRef.current) {
                    return;
                }
            }
        },
        [hydrateMissingAddresses]
    );

    const resolveCurrentLocationAndLoad = React.useCallback(() => {
        setResolvingLocation(true);

        if (!navigator.geolocation) {
            setLocationNote(
                "Current location is not supported in this browser. Showing nearby areas around Istanbul."
            );
            setCenter(DEFAULT_CENTER);
            setResolvingLocation(false);
            void loadNearbyAreas(DEFAULT_CENTER);
            return;
        }

        setLocationNote("Resolving your current location...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextCenter = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };

                setCenter(nextCenter);
                setLocationNote("Showing gathering areas around your current location.");
                setResolvingLocation(false);
                void loadNearbyAreas(nextCenter);
            },
            () => {
                setLocationNote(
                    "Location permission was denied or unavailable. Showing nearby areas around Istanbul."
                );
                setCenter(DEFAULT_CENTER);
                setResolvingLocation(false);
                void loadNearbyAreas(DEFAULT_CENTER);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        );
    }, [loadNearbyAreas]);

    React.useEffect(() => {
        resolveCurrentLocationAndLoad();
    }, [resolveCurrentLocationAndLoad]);

    React.useEffect(() => {
        if (!selectedAreaId) {
            return;
        }

        const stillVisible = filteredAreas.some((item) => item.featureKey === selectedAreaId);
        if (!stillVisible) {
            setSelectedAreaId(filteredAreas[0]?.featureKey || null);
        }
    }, [filteredAreas, selectedAreaId]);

    const isInitialState = resolvingLocation && fetchState === "idle";
    const isLoading = fetchState === "loading";
    const isError = fetchState === "error";
    const isEmpty = fetchState === "empty";
    const isFallback = fetchState === "fallback";
    const isFilterEmpty = !isLoading && !isError && areas.length > 0 && filteredAreas.length === 0;
    const searchContextLine = isFallback
        ? "Fallback content may not match your exact location; follow official guidance during a real emergency."
        : `Searching within ${SEARCH_RADIUS_KM} km of your current location.`;

    const selectedArea = selectedAreaId
        ? filteredAreas.find((item) => item.featureKey === selectedAreaId) || null
        : null;

    const toggleCategoryFilter = React.useCallback((key: string) => {
        const normalized = normalizeCategoryKey(key);
        setSelectedCategoryKeys((current) => {
            if (current.includes(normalized)) {
                return current.filter((item) => item !== normalized);
            }
            return [...current, normalized];
        });
    }, []);

    const clearCategoryFilters = React.useCallback(() => {
        setSelectedCategoryKeys(categoryOptions.map((item) => item.key));
    }, [categoryOptions]);

    const handleGetDirections = React.useCallback((area: GatheringAreaMapFeature) => {
        const opened = openDirections(area.latitude, area.longitude, area.name || "Gathering area");
        setDirectionsMessage(
            opened ? "" : "Directions are unavailable for this gathering area."
        );
    }, []);

    return (
        <AppShell
            title="Gathering Areas"
            titleClassName="gathering-areas-page-title"
            containerClassName="gathering-areas-page-container"
        >
            <div className="gathering-areas-page-grid">
                <SectionCard className="gathering-areas-main-card">
                    <div className="gathering-areas-map-wrap">
                        <GatheringAreasMap
                            center={center}
                            features={filteredAreas}
                            selectedFeatureId={selectedAreaId}
                            onSelectFeature={handleSelectArea}
                            heightClassName="h-[460px] md:h-[620px]"
                        />

                        <button
                            type="button"
                            aria-label="Retry Results"
                            title="Retry Results"
                            className="gathering-areas-map-retry"
                            onClick={resolveCurrentLocationAndLoad}
                            disabled={isLoading || resolvingLocation}
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <path
                                    d="M20 11.5A8 8 0 1 0 17.66 17M20 11.5V6M20 11.5H14.5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>

                        <button
                            type="button"
                            className="gathering-areas-overlay-toggle"
                            onClick={() => setIsDetailsOpen((current) => !current)}
                        >
                            {isDetailsOpen ? "Hide Area Details" : "Show Area Details"}
                        </button>

                        {isDetailsOpen ? (
                            <aside className="gathering-areas-map-overlay">
                                <p className="gathering-areas-overlay-title">Area Details</p>

                                {selectedArea ? (
                                    <article className="gathering-areas-selected-card">
                                        <p className="gathering-areas-selected-name">{selectedArea.name}</p>
                                        <p className="gathering-areas-selected-meta">
                                            Type: {selectedArea.categoryLabel}
                                        </p>
                                        <p className="gathering-areas-selected-meta">
                                            Distance: {formatDistanceLabel(selectedArea.distanceMeters)}
                                        </p>
                                        <p className="gathering-areas-selected-meta">
                                            Address: {selectedArea.address}
                                        </p>
                                        <PrimaryButton
                                            type="button"
                                            className="mt-1 h-10 w-auto"
                                            onClick={() => handleGetDirections(selectedArea)}
                                        >
                                            Get Directions
                                        </PrimaryButton>
                                        {directionsMessage ? (
                                            <p className="gathering-areas-selected-meta">{directionsMessage}</p>
                                        ) : null}
                                    </article>
                                ) : (
                                    <p className="gathering-areas-empty-detail">
                                        Select a gathering area to view details.
                                    </p>
                                )}

                                <p className="gathering-areas-overlay-title">Nearby Results</p>

                                <div className="gathering-areas-list">
                                    {isLoading ? (
                                        <>
                                            {[0, 1, 2].map((index) => (
                                                <div key={index} className="gathering-areas-item-skeleton">
                                                    <span />
                                                    <span />
                                                </div>
                                            ))}
                                        </>
                                    ) : isError ? (
                                        <p className="gathering-areas-empty-detail">
                                            Could not load nearby results.
                                        </p>
                                    ) : filteredAreas.length ? (
                                        filteredAreas.map((area) => (
                                            <button
                                                key={area.featureKey}
                                                type="button"
                                                className={`gathering-areas-item${selectedArea?.featureKey === area.featureKey ? " is-active" : ""}`}
                                                onClick={() => handleSelectArea(area.featureKey)}
                                            >
                                                <p className="gathering-areas-item-name">{area.name}</p>
                                                <p className="gathering-areas-item-meta">
                                                    {area.categoryLabel} � {formatDistanceLabel(area.distanceMeters)}
                                                </p>
                                            </button>
                                        ))
                                    ) : isFilterEmpty ? (
                                        <p className="gathering-areas-empty-detail">
                                            No results match the selected categories.
                                        </p>
                                    ) : isEmpty ? (
                                        <p className="gathering-areas-empty-detail">
                                            No nearby areas in the current result.
                                        </p>
                                    ) : (
                                        <p className="gathering-areas-empty-detail">
                                            Waiting for location and nearby results...
                                        </p>
                                    )}
                                </div>
                            </aside>
                        ) : null}
                    </div>

                    <div className="gathering-areas-context-note">
                        <p className="gathering-areas-context-line">{locationNote}</p>
                        <p className="gathering-areas-context-line">{searchContextLine}</p>
                    </div>

                    {categoryOptions.length ? (
                        <div className="crisis-filters-panel">
                            <div className="crisis-filters-header">
                                <p className="crisis-filters-title">Filter by Category</p>
                                <button
                                    type="button"
                                    className="crisis-filters-clear"
                                    onClick={clearCategoryFilters}
                                    disabled={!categoryOptions.length}
                                >
                                    Clear filters
                                </button>
                            </div>
                            <div className="crisis-filters-grid">
                                {categoryOptions.map((option) => {
                                    const active = selectedCategoryKeys.includes(option.key);
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            className={`crisis-filter-chip${active ? " is-active" : ""}`}
                                            onClick={() => toggleCategoryFilter(option.key)}
                                        >
                                            <span
                                                className="crisis-filter-swatch"
                                                style={{ backgroundColor: getLegendSwatchColor(option.key) }}
                                            />
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="crisis-legend">
                                {categoryOptions.map((option) => (
                                    <span key={`legend-${option.key}`} className="crisis-legend-item">
                                        <span
                                            className="crisis-legend-swatch"
                                            style={{ backgroundColor: getLegendSwatchColor(option.key) }}
                                        />
                                        <span>{option.label}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {isLoading ? (
                        <div className="gathering-areas-status-box">
                            <p className="gathering-areas-status-title">Loading nearby gathering areas...</p>
                            <div className="gathering-areas-loading-skeleton" aria-hidden="true">
                                <span />
                                <span />
                            </div>
                        </div>
                    ) : null}

                    {dataNotice ? (
                        <div className={isFallback ? "gathering-areas-status-box is-warning" : "gathering-areas-status-box"}>
                            <div>
                                <p className="gathering-areas-status-title">
                                    {dataNoticeTitle || "Gathering areas status"}
                                </p>
                                <p>{dataNotice}</p>
                                {lastUpdated ? (
                                    <p>Last updated: {formatLastUpdated(lastUpdated)}</p>
                                ) : (
                                    <p>Last updated: cached by backend; exact timestamp unavailable.</p>
                                )}
                            </div>
                            <PrimaryButton className="w-auto" onClick={resolveCurrentLocationAndLoad}>
                                Retry gathering areas
                            </PrimaryButton>
                        </div>
                    ) : lastUpdated && filteredAreas.length ? (
                        <div className="gathering-areas-status-box">
                            <p>Last updated: {formatLastUpdated(lastUpdated)}</p>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="gathering-areas-status-box is-error">
                            <p>{error}</p>
                            <PrimaryButton className="w-auto" onClick={resolveCurrentLocationAndLoad}>
                                Retry gathering areas
                            </PrimaryButton>
                        </div>
                    ) : null}

                    {isEmpty ? (
                        <div className="gathering-areas-status-box">
                            <p>No gathering areas were found for this location and radius.</p>
                        </div>
                    ) : null}

                    {isInitialState ? (
                        <div className="gathering-areas-status-box">
                            <p>Waiting for your location before first fetch.</p>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </AppShell>
    );
}
