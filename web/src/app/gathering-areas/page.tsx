"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { GatheringAreasMap } from "@/components/feature/location/GatheringAreasMap";
import { fetchViewportGatheringAreas } from "@/lib/gatheringAreas";
import { openDirections } from "@/lib/mapDirections";
import { reverseLocation } from "@/lib/location";
import type { GatheringAreaCategoryMeta, GatheringAreaFeature } from "@/types/location";
import type { GatheringAreaMapFeature } from "@/components/feature/location/LeafletGatheringAreasMap";
import type { MapBounds } from "@/components/feature/location/LeafletMapCanvas";
import {
    effectiveViewportKey,
    isViewportDiscoverable,
    viewportBoundsToBbox,
} from "@/lib/viewportDiscovery";

const DEFAULT_CENTER = {
    latitude: 39.0,
    longitude: 35.0,
};
const DEFAULT_ZOOM = 5;
const CURRENT_LOCATION_ZOOM = 13;
const DEFAULT_LIMIT = 20;
const ADDRESS_UNAVAILABLE = "Address unavailable";
type FetchState = "idle" | "loading" | "success" | "empty" | "error";
const ResourceInitialMessage = "Zoom in or use your device location to see resources in this area.";
const ResourceZoomedOutMessage = "Zoom in to see resources in this area.";
const ResourceLoadingMessage = "Loading resources in this area...";
const ResourceEmptyMessage = "No resources were found in this visible area.";
const ResourceErrorMessage = "Resources could not be loaded for this area. Please try again.";

type CategoryOption = {
    key: string;
    label: string;
};

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

function mapFeatures(features: GatheringAreaFeature[]) {
    return features
        .map(mapFeature)
        .filter((item): item is GatheringAreaMapFeature => item !== null);
}

export default function GatheringAreasPage() {
    const [center, setCenter] = React.useState(DEFAULT_CENTER);
    const [mapZoom, setMapZoom] = React.useState(DEFAULT_ZOOM);
    const [hasUserLocation, setHasUserLocation] = React.useState(false);
    const [areas, setAreas] = React.useState<GatheringAreaMapFeature[]>([]);
    const [categoryOptions, setCategoryOptions] = React.useState<CategoryOption[]>([]);
    const [selectedCategoryKeys, setSelectedCategoryKeys] = React.useState<string[]>([]);
    const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(true);
    const [fetchState, setFetchState] = React.useState<FetchState>("idle");
    const [error, setError] = React.useState("");
    const [infoMessage, setInfoMessage] = React.useState(ResourceInitialMessage);
    const [locationNote, setLocationNote] = React.useState(
        "Move around the map to discover resources in different cities."
    );
    const [directionsMessage, setDirectionsMessage] = React.useState("");
    const [currentViewport, setCurrentViewport] = React.useState<MapBounds | null>(null);
    const [pendingViewport, setPendingViewport] = React.useState<MapBounds | null>(null);
    const [lastFetchedViewportKey, setLastFetchedViewportKey] = React.useState<string | null>(null);
    const [viewportRefreshNonce, setViewportRefreshNonce] = React.useState(0);
    const requestIdRef = React.useRef(0);
    const reverseAddressCacheRef = React.useRef<Map<string, string>>(new Map());
    const hasRequestedInitialLocationRef = React.useRef(false);
    const hasInitializedCategoryFiltersRef = React.useRef(false);

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

    const loadViewportAreas = React.useCallback(
        async (viewport: MapBounds) => {
            const currentRequestId = ++requestIdRef.current;

            try {
                setFetchState("loading");
                setError("");
                setInfoMessage(ResourceLoadingMessage);

                const response = await fetchViewportGatheringAreas({
                    bbox: viewportBoundsToBbox(viewport),
                    limit: DEFAULT_LIMIT,
                });

                if (currentRequestId !== requestIdRef.current) {
                    return;
                }

                const mapped = mapFeatures(response.collection.features);
                const responseCategoryOptions = deriveCategoryOptions(mapped, response.meta.categories);

                setAreas(mapped);
                setCategoryOptions(responseCategoryOptions);
                setSelectedCategoryKeys((current) => {
                    if (!hasInitializedCategoryFiltersRef.current) {
                        hasInitializedCategoryFiltersRef.current = true;
                        return responseCategoryOptions.map((item) => item.key);
                    }
                    return current;
                });
                void hydrateMissingAddresses(mapped, currentRequestId);
                setFetchState(mapped.length ? "success" : "empty");
                setInfoMessage(mapped.length ? "Showing resources in this visible area." : ResourceEmptyMessage);
                setLastFetchedViewportKey(effectiveViewportKey(viewport));
                setViewportRefreshNonce(0);
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

                setAreas([]);
                setCategoryOptions([]);
                setSelectedCategoryKeys([]);
                setSelectedAreaId(null);
                setError(rawMessage || ResourceErrorMessage);
                setFetchState("error");
                setInfoMessage("");
            } finally {
                if (currentRequestId !== requestIdRef.current) {
                    return;
                }
            }
        },
        [hydrateMissingAddresses]
    );

    React.useEffect(() => {
        const viewport = pendingViewport;
        const viewportKey = effectiveViewportKey(viewport);
        if (!viewport || !viewportKey) {
            return;
        }

        if (viewportKey === lastFetchedViewportKey && viewportRefreshNonce === 0) {
            return;
        }

        const timer = window.setTimeout(() => {
            void loadViewportAreas(viewport);
        }, 450);

        return () => {
            window.clearTimeout(timer);
        };
    }, [pendingViewport, lastFetchedViewportKey, viewportRefreshNonce, loadViewportAreas]);

    const handleUseCurrentLocation = React.useCallback(() => {
        setError("");
        if (!navigator.geolocation) {
            setHasUserLocation(false);
            setInfoMessage("Current location is not supported in this browser.");
            return;
        }

        setInfoMessage("Resolving your current location...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextCenter = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };

                setCenter(nextCenter);
                setMapZoom(CURRENT_LOCATION_ZOOM);
                setHasUserLocation(true);
                setLocationNote("Showing gathering areas around your current location.");
                setInfoMessage("Showing resources around your current location.");
            },
            () => {
                setHasUserLocation(false);
                setInfoMessage(
                    "Location permission was denied or unavailable. Continue by moving the map manually."
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        );
    }, []);

    React.useEffect(() => {
        if (hasRequestedInitialLocationRef.current) {
            return;
        }

        hasRequestedInitialLocationRef.current = true;
        handleUseCurrentLocation();
    }, [handleUseCurrentLocation]);

    const queueViewportRefresh = React.useCallback(() => {
        if (!isViewportDiscoverable(currentViewport)) {
            requestIdRef.current += 1;
            setAreas([]);
            setSelectedAreaId(null);
            setLastFetchedViewportKey(null);
            setError("");
            setFetchState("idle");
            setInfoMessage(ResourceZoomedOutMessage);
            return;
        }

        setError("");
        setPendingViewport(currentViewport);
        setViewportRefreshNonce((nonce) => nonce + 1);
    }, [currentViewport]);

    const handleViewportChange = React.useCallback((viewport: MapBounds) => {
        setCurrentViewport(viewport);

        if (isViewportDiscoverable(viewport)) {
            setError("");
            setPendingViewport(viewport);
            setInfoMessage((current) =>
                current === ResourceZoomedOutMessage ? "" : current
            );
            return;
        }

        requestIdRef.current += 1;
        setAreas([]);
        setSelectedAreaId(null);
        setLastFetchedViewportKey(null);
        setError("");
        setFetchState("idle");
        setInfoMessage(ResourceZoomedOutMessage);
    }, []);

    React.useEffect(() => {
        if (!selectedAreaId) {
            return;
        }

        const stillVisible = filteredAreas.some((item) => item.featureKey === selectedAreaId);
        if (!stillVisible) {
            setSelectedAreaId(null);
            setDirectionsMessage("");
        }
    }, [filteredAreas, selectedAreaId]);

    const isDiscoverable = isViewportDiscoverable(currentViewport);
    const isInitialState = currentViewport == null && fetchState === "idle";
    const isLoading = fetchState === "loading";
    const isError = fetchState === "error";
    const isEmpty = fetchState === "empty" && isDiscoverable && Boolean(lastFetchedViewportKey);
    const isFilterEmpty = !isLoading && !isError && isDiscoverable && areas.length > 0 && filteredAreas.length === 0;
    const searchContextLine = isDiscoverable
        ? "Showing resources in the visible map area."
        : ResourceZoomedOutMessage;

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
                            zoom={mapZoom}
                            showLiveLocation={hasUserLocation}
                            features={isDiscoverable ? filteredAreas : []}
                            selectedFeatureId={selectedAreaId}
                            onSelectFeature={handleSelectArea}
                            onViewportChange={handleViewportChange}
                            heightClassName="h-[460px] md:h-[620px]"
                        />

                        <button
                            type="button"
                            aria-label="Retry Results"
                            title="Retry Results"
                            className="gathering-areas-map-retry"
                            onClick={queueViewportRefresh}
                            disabled={isLoading}
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
                            aria-label="Use Current Location"
                            title="Use Current Location"
                            className="gathering-areas-map-current-location"
                            onClick={handleUseCurrentLocation}
                            disabled={isLoading}
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                            >
                                <path
                                    d="M12 3V6M12 18V21M3 12H6M18 12H21M12 16.5A4.5 4.5 0 1 0 12 7.5A4.5 4.5 0 0 0 12 16.5Z"
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
                                                    {area.categoryLabel} | {formatDistanceLabel(area.distanceMeters)}
                                                </p>
                                            </button>
                                        ))
                                    ) : isFilterEmpty ? (
                                        <p className="gathering-areas-empty-detail">
                                            No results match the selected categories.
                                        </p>
                                    ) : isEmpty ? (
                                        <p className="gathering-areas-empty-detail">
                                            {ResourceEmptyMessage}
                                        </p>
                                    ) : (
                                        <p className="gathering-areas-empty-detail">
                                            {infoMessage || ResourceInitialMessage}
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
                            <p className="gathering-areas-status-title">{ResourceLoadingMessage}</p>
                            <div className="gathering-areas-loading-skeleton" aria-hidden="true">
                                <span />
                                <span />
                            </div>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="gathering-areas-status-box is-error">
                            <p>{error}</p>
                            <PrimaryButton className="w-auto" onClick={queueViewportRefresh}>
                                Retry gathering areas
                            </PrimaryButton>
                        </div>
                    ) : null}

                    {isEmpty ? (
                        <div className="gathering-areas-status-box">
                            <p>{ResourceEmptyMessage}</p>
                        </div>
                    ) : null}

                    {isInitialState ? (
                        <div className="gathering-areas-status-box">
                            <p>{ResourceInitialMessage}</p>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </AppShell>
    );
}
