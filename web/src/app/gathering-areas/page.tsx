"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { GatheringAreasMap } from "@/components/feature/location/GatheringAreasMap";
import { fetchNearbyGatheringAreas } from "@/lib/gatheringAreas";
import type { GatheringAreaFeature } from "@/types/location";
import type { GatheringAreaMapFeature } from "@/components/feature/location/LeafletGatheringAreasMap";

const DEFAULT_CENTER = {
    latitude: 41.0082,
    longitude: 28.9784,
};

const DEFAULT_RADIUS = 2000;
const DEFAULT_LIMIT = 20;

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
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");
    const [locationNote, setLocationNote] = React.useState("");
    const requestIdRef = React.useRef(0);

    const handleSelectArea = React.useCallback((featureId: string) => {
        setSelectedAreaId(featureId);
        setIsDetailsOpen(true);
    }, []);

    const loadNearbyAreas = React.useCallback(
        async (sourceCenter: { latitude: number; longitude: number }) => {
            const currentRequestId = ++requestIdRef.current;

            try {
                setLoading(true);
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
            } finally {
                if (currentRequestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        },
        []
    );

    const resolveCurrentLocation = React.useCallback(() => {
        if (!navigator.geolocation) {
            setLocationNote(
                "Current location is not supported in this browser. Showing nearby areas around Istanbul."
            );
            void loadNearbyAreas(DEFAULT_CENTER);
            return;
        }

        setLocationNote("");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const nextCenter = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };

                setCenter(nextCenter);
                setLocationNote("Showing gathering areas around your current location.");
                void loadNearbyAreas(nextCenter);
            },
            () => {
                setLocationNote(
                    "Location permission was denied or unavailable. Showing nearby areas around Istanbul."
                );
                setCenter(DEFAULT_CENTER);
                void loadNearbyAreas(DEFAULT_CENTER);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        );
    }, [loadNearbyAreas]);

    React.useEffect(() => {
        resolveCurrentLocation();
    }, [resolveCurrentLocation]);

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
                            heightClassName="h-[380px] md:h-[500px]"
                        />

                        {locationNote ? (
                            <p className="gathering-areas-map-note">{locationNote}</p>
                        ) : null}

                        <button
                            type="button"
                            aria-label="Retry Results"
                            title="Retry Results"
                            className="gathering-areas-map-retry"
                            onClick={() => void loadNearbyAreas(center)}
                            disabled={loading}
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
                                            Category: {selectedArea.category}
                                        </p>
                                        <p className="gathering-areas-selected-meta">
                                            Distance: {selectedArea.distanceMeters} m
                                        </p>
                                        <p className="gathering-areas-selected-meta">
                                            Coordinates: {selectedArea.latitude.toFixed(5)}, {selectedArea.longitude.toFixed(5)}
                                        </p>
                                    </article>
                                ) : (
                                    <p className="gathering-areas-empty-detail">
                                        Select a gathering area to view details.
                                    </p>
                                )}

                                <p className="gathering-areas-overlay-title">Nearby Results</p>

                                <div className="gathering-areas-list">
                                    {areas.length ? (
                                        areas.map((area) => (
                                            <button
                                                key={area.featureKey}
                                                type="button"
                                                className={`gathering-areas-item${selectedArea?.featureKey === area.featureKey ? " is-active" : ""}`}
                                                onClick={() => handleSelectArea(area.featureKey)}
                                            >
                                                <p className="gathering-areas-item-name">{area.name}</p>
                                                <p className="gathering-areas-item-meta">
                                                    {area.category} • {area.distanceMeters} m • {area.osmType}
                                                </p>
                                            </button>
                                        ))
                                    ) : (
                                        <p className="gathering-areas-empty-detail">
                                            No nearby areas in the current result.
                                        </p>
                                    )}
                                </div>
                            </aside>
                        ) : null}
                    </div>

                    {loading ? (
                        <div className="gathering-areas-status-box">
                            <p>Loading nearby gathering areas...</p>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="gathering-areas-status-box is-error">
                            <p>{error}</p>
                        </div>
                    ) : null}

                    {!loading && !error && areas.length === 0 ? (
                        <div className="gathering-areas-status-box">
                            <p>No gathering areas were found for this location and radius.</p>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </AppShell>
    );
}
