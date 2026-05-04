"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { GatheringAreasMap } from "@/components/feature/location/GatheringAreasMap";
import { fetchNearbyGatheringAreas } from "@/lib/gatheringAreas";
import { reverseLocation } from "@/lib/location";
import type { GatheringAreaFeature } from "@/types/location";
import type { GatheringAreaMapFeature } from "@/components/feature/location/LeafletGatheringAreasMap";

const DEFAULT_CENTER = {
    latitude: 41.0082,
    longitude: 28.9784,
};

const DEFAULT_RADIUS = 2000;
const DEFAULT_LIMIT = 20;
const SEARCH_RADIUS_KM = DEFAULT_RADIUS / 1000;
const ADDRESS_UNAVAILABLE = "Address unavailable";
type FetchState = "idle" | "loading" | "success" | "empty" | "error";

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
        distanceMeters: feature.properties.distanceMeters,
        latitude,
        longitude,
    };
}

export default function GatheringAreasPage() {
    const [center, setCenter] = React.useState(DEFAULT_CENTER);
    const [areas, setAreas] = React.useState<GatheringAreaMapFeature[]>([]);
    const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(true);
    const [fetchState, setFetchState] = React.useState<FetchState>("idle");
    const [resolvingLocation, setResolvingLocation] = React.useState(true);
    const [error, setError] = React.useState("");
    const [locationNote, setLocationNote] = React.useState("Resolving your current location...");
    const requestIdRef = React.useRef(0);
    const reverseAddressCacheRef = React.useRef<Map<string, string>>(new Map());

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
    }, []);

    const loadNearbyAreas = React.useCallback(
        async (sourceCenter: { latitude: number; longitude: number }) => {
            const currentRequestId = ++requestIdRef.current;

            try {
                setFetchState("loading");
                setError("");

                const response = await fetchNearbyGatheringAreas({
                    latitude: sourceCenter.latitude,
                    longitude: sourceCenter.longitude,
                    radius: DEFAULT_RADIUS,
                    limit: DEFAULT_LIMIT,
                });

                if (currentRequestId !== requestIdRef.current) {
                    return;
                }

                const mapped = response.collection.features
                    .map(mapFeature)
                    .filter((item): item is GatheringAreaMapFeature => item !== null);

                setAreas(mapped);
                void hydrateMissingAddresses(mapped, currentRequestId);
                setFetchState(mapped.length ? "success" : "empty");
                setSelectedAreaId((current) => {
                    if (!mapped.length) {
                        return null;
                    }

                    if (current && mapped.some((item) => item.featureKey === current)) {
                        return current;
                    }

                    return mapped[0].featureKey;
                });
            } catch (err) {
                if (currentRequestId !== requestIdRef.current) {
                    return;
                }

                const rawMessage =
                    err instanceof Error
                        ? err.message
                        : "Could not load gathering areas right now.";

                const uiMessage =
                    rawMessage === "Internal Server Error"
                        ? "Gathering areas service is temporarily unavailable. Please try again shortly."
                        : rawMessage;

                setError(uiMessage);
                setAreas([]);
                setSelectedAreaId(null);
                setFetchState("error");
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

    const isInitialState = resolvingLocation && fetchState === "idle";
    const isLoading = fetchState === "loading";
    const isError = fetchState === "error";
    const isEmpty = fetchState === "empty";

    const selectedArea =
        areas.find((item) => item.featureKey === selectedAreaId) ||
        (areas.length ? areas[0] : null);

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
                            features={areas}
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
                                            Type: {formatCategoryLabel(selectedArea.category)}
                                        </p>
                                        <p className="gathering-areas-selected-meta">
                                            Distance: {formatDistanceLabel(selectedArea.distanceMeters)}
                                        </p>
                                        <p className="gathering-areas-selected-meta">
                                            Address: {selectedArea.address}
                                        </p>
                                    </article>
                                ) : (
                                    <p className="gathering-areas-empty-detail">
                                        Select a gathering area to view details.
                                    </p>
                                )}

                                <p className="gathering-areas-overlay-title">Nearby Results</p>

                                <div className="gathering-areas-list">
                                    {isError ? (
                                        <p className="gathering-areas-empty-detail">
                                            Could not load nearby results.
                                        </p>
                                    ) : areas.length ? (
                                        areas.map((area) => (
                                            <button
                                                key={area.featureKey}
                                                type="button"
                                                className={`gathering-areas-item${selectedArea?.featureKey === area.featureKey ? " is-active" : ""}`}
                                                onClick={() => handleSelectArea(area.featureKey)}
                                            >
                                                <p className="gathering-areas-item-name">{area.name}</p>
                                                <p className="gathering-areas-item-meta">
                                                    {formatCategoryLabel(area.category)} • {formatDistanceLabel(area.distanceMeters)}
                                                </p>
                                            </button>
                                        ))
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
                        <p className="gathering-areas-context-line">
                            Searching within {SEARCH_RADIUS_KM} km of your current location.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="gathering-areas-status-box">
                            <p>Loading nearby gathering areas...</p>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="gathering-areas-status-box is-error">
                            <p>{error}</p>
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
