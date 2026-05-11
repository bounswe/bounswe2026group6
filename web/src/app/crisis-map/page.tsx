"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { CrisisMap } from "@/components/feature/location/CrisisMap";
import type { CrisisMapFeature, CrisisRequestType } from "@/components/feature/location/LeafletCrisisMap";
import { fetchActiveHelpRequests } from "@/lib/crisisMap";
import { getAccessToken } from "@/lib/auth";
import { openDirections } from "@/lib/mapDirections";
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

const FETCH_LIMIT = 300;
type FetchState = "idle" | "loading" | "success" | "empty" | "error";
const ResourceInitialMessage = "Zoom in or use your device location to see resources in this area.";
const ResourceZoomedOutMessage = "Zoom in to see resources in this area.";
const ResourceLoadingMessage = "Loading resources in this area...";
const ResourceEmptyMessage = "No resources were found in this visible area.";
const ResourceErrorMessage = "Resources could not be loaded for this area. Please try again.";
const REQUEST_TYPE_ORDER: CrisisRequestType[] = [
    "FIRST_AID",
    "SHELTER",
    "FOOD_WATER",
    "SEARCH_AND_RESCUE",
    "OTHER",
];

const REQUEST_TYPE_COLORS: Record<CrisisRequestType, string> = {
    FIRST_AID: "#d94141",
    SHELTER: "#3b66d8",
    FOOD_WATER: "#2f9e67",
    SEARCH_AND_RESCUE: "#f08c00",
    OTHER: "#687280",
};

function normalizeType(type: string): CrisisRequestType {
    const value = type.trim().toLowerCase();
    if (value === "shelter") {
        return "SHELTER";
    }
    if (value === "first_aid") {
        return "FIRST_AID";
    }
    if (
        value === "search_rescue" ||
        value === "search_and_rescue" ||
        value === "sar" ||
        value === "fire_brigade" ||
        value === "rescue"
    ) {
        return "SEARCH_AND_RESCUE";
    }
    if (value === "food" || value === "water" || value === "food_water") {
        return "FOOD_WATER";
    }
    return "OTHER";
}

function typeLabel(type: CrisisRequestType) {
    switch (type) {
        case "SHELTER":
            return "Shelter";
        case "FIRST_AID":
            return "First Aid";
        case "SEARCH_AND_RESCUE":
            return "Search and Rescue";
        case "FOOD_WATER":
            return "Food / Water Supplies";
        default:
            return "Other / Unknown";
    }
}

function formatRelative(createdAt: string) {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
        return createdAt;
    }
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatPriority(priority: CrisisMapFeature["priorityLevel"]) {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function toFeature(item: Awaited<ReturnType<typeof fetchActiveHelpRequests>>["requests"][number]): CrisisMapFeature | null {
    if (item.status !== "PENDING" || item.assignmentState === "ASSIGNED") {
        return null;
    }

    const latitude = item.location.latitude;
    const longitude = item.location.longitude;
    if (latitude == null || longitude == null) {
        return null;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }
    const type = normalizeType(item.type);

    return {
        featureKey: item.requestId,
        requestId: item.requestId,
        type,
        typeLabel: typeLabel(type),
        priorityLevel: item.urgencyLevel,
        createdAt: item.createdAt,
        latitude,
        longitude,
        city: item.location.city || "unknown",
        district: item.location.district || "unknown",
    };
}

export default function CrisisMapPage() {
    const [center, setCenter] = React.useState(DEFAULT_CENTER);
    const [mapZoom, setMapZoom] = React.useState(DEFAULT_ZOOM);
    const [requests, setRequests] = React.useState<CrisisMapFeature[]>([]);
    const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(true);
    const [fetchState, setFetchState] = React.useState<FetchState>("idle");
    const [error, setError] = React.useState("");
    const [infoMessage, setInfoMessage] = React.useState(ResourceInitialMessage);
    const [directionsMessage, setDirectionsMessage] = React.useState("");
    const [selectedTypes, setSelectedTypes] = React.useState<Set<CrisisRequestType>>(new Set());
    const [currentViewport, setCurrentViewport] = React.useState<MapBounds | null>(null);
    const [pendingViewport, setPendingViewport] = React.useState<MapBounds | null>(null);
    const [lastFetchedViewportKey, setLastFetchedViewportKey] = React.useState<string | null>(null);
    const [viewportRefreshNonce, setViewportRefreshNonce] = React.useState(0);
    const requestIdRef = React.useRef(0);
    const hasRequestedInitialLocationRef = React.useRef(false);

    const loadActiveRequestsForViewport = React.useCallback(async (viewport: MapBounds) => {
        const currentRequestId = ++requestIdRef.current;
        try {
            setFetchState("loading");
            setError("");
            setInfoMessage(ResourceLoadingMessage);

            const token = getAccessToken();
            const response = await fetchActiveHelpRequests({
                token,
                status: "PENDING",
                bbox: viewportBoundsToBbox(viewport),
                limit: FETCH_LIMIT,
                offset: 0,
            });

            if (currentRequestId !== requestIdRef.current) {
                return;
            }

            const mapped = response.requests
                .map(toFeature)
                .filter((item): item is CrisisMapFeature => item !== null);

            setRequests(mapped);
            setFetchState(mapped.length > 0 ? "success" : "empty");
            setInfoMessage(mapped.length > 0 ? "Showing resources in this visible area." : ResourceEmptyMessage);
            setLastFetchedViewportKey(effectiveViewportKey(viewport));
            setViewportRefreshNonce(0);
            setSelectedRequestId((current) => {
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
                err instanceof Error ? err.message : "Could not load active help requests.";
            setError(rawMessage);
            setRequests([]);
            setSelectedRequestId(null);
            setFetchState("error");
            setInfoMessage("");
        }
    }, []);

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
            void loadActiveRequestsForViewport(viewport);
        }, 450);

        return () => {
            window.clearTimeout(timer);
        };
    }, [pendingViewport, lastFetchedViewportKey, viewportRefreshNonce, loadActiveRequestsForViewport]);

    const queueViewportRefresh = React.useCallback(() => {
        if (!isViewportDiscoverable(currentViewport)) {
            setRequests([]);
            setSelectedRequestId(null);
            setError("");
            setFetchState("idle");
            setInfoMessage(ResourceZoomedOutMessage);
            return;
        }

        setError("");
        setPendingViewport(currentViewport);
        setViewportRefreshNonce((nonce) => nonce + 1);
    }, [currentViewport]);

    const handleViewportChange = React.useCallback((bounds: MapBounds) => {
        setCurrentViewport(bounds);

        if (isViewportDiscoverable(bounds)) {
            setError("");
            setPendingViewport(bounds);
            setInfoMessage((current) =>
                current === ResourceZoomedOutMessage ? "" : current
            );
            return;
        }

        requestIdRef.current += 1;
        setRequests([]);
        setSelectedRequestId(null);
        setLastFetchedViewportKey(null);
        setFetchState("idle");
        setError("");
        setInfoMessage(ResourceZoomedOutMessage);
    }, []);

    const handleUseCurrentLocation = React.useCallback(() => {
        setError("");

        if (!navigator.geolocation) {
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
                setInfoMessage("Showing requests around your current location.");
            },
            () => {
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

    const isLoading = fetchState === "loading";
    const isDiscoverable = isViewportDiscoverable(currentViewport);
    const isEmpty =
        fetchState === "empty" &&
        isDiscoverable &&
        Boolean(lastFetchedViewportKey);
    const visibleRequests = React.useMemo(() => {
        if (!selectedTypes.size) {
            return requests;
        }
        return requests.filter((item) => selectedTypes.has(item.type));
    }, [requests, selectedTypes]);
    const hasActiveFilters = selectedTypes.size > 0;
    const isFilterEmpty =
        !isLoading &&
        isDiscoverable &&
        requests.length > 0 &&
        visibleRequests.length === 0;

    React.useEffect(() => {
        if (!selectedRequestId) {
            return;
        }
        const stillVisible = visibleRequests.some((item) => item.featureKey === selectedRequestId);
        if (!stillVisible) {
            setSelectedRequestId(null);
        }
    }, [visibleRequests, selectedRequestId]);

    const filterTypes = REQUEST_TYPE_ORDER;

    const selectedRequest = selectedRequestId
        ? visibleRequests.find((item) => item.featureKey === selectedRequestId) || null
        : null;

    const handleGetDirections = React.useCallback((request: CrisisMapFeature) => {
        const opened = openDirections(request.latitude, request.longitude, request.typeLabel);
        setDirectionsMessage(
            opened ? "" : "Directions are unavailable for this request location."
        );
    }, []);

    return (
        <AppShell title="Help Request Map" containerClassName="gathering-areas-page-container">
            <div className="gathering-areas-page-grid">
                <SectionCard className="gathering-areas-main-card">
                    <div className="gathering-areas-map-wrap">
                        <div className="crisis-map-canvas-wrap">
                            <CrisisMap
                                center={center}
                                zoom={mapZoom}
                                features={isViewportDiscoverable(currentViewport) ? visibleRequests : []}
                                selectedFeatureId={selectedRequestId}
                                onViewportChange={handleViewportChange}
                                onSelectFeature={(featureId) => {
                                    setSelectedRequestId(featureId);
                                    setIsDetailsOpen(true);
                                    setDirectionsMessage("");
                                }}
                                heightClassName="h-[380px] md:h-[500px]"
                            />

                            <p className="gathering-areas-map-note">
                                {infoMessage || ResourceInitialMessage}
                            </p>

                            <button
                                type="button"
                                aria-label="Refresh Help Request Map"
                                title="Refresh Help Request Map"
                                className="gathering-areas-map-retry"
                                onClick={() => {
                                    queueViewportRefresh();
                                }}
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
                                {isDetailsOpen ? "Hide Request Details" : "Show Request Details"}
                            </button>

                            {isDetailsOpen ? (
                                <aside className="gathering-areas-map-overlay">
                                    <p className="gathering-areas-overlay-title">Selected Request</p>
                                    {selectedRequest ? (
                                        <article className="gathering-areas-selected-card">
                                            <p className="gathering-areas-selected-name">{selectedRequest.typeLabel}</p>
                                            <p className="gathering-areas-selected-meta">
                                                Priority: {formatPriority(selectedRequest.priorityLevel)}
                                            </p>
                                            <p className="gathering-areas-selected-meta">
                                                Location: {selectedRequest.district}, {selectedRequest.city}
                                            </p>
                                            <p className="gathering-areas-selected-meta">
                                                Opened: {formatRelative(selectedRequest.createdAt)}
                                            </p>
                                            <PrimaryButton
                                                type="button"
                                                className="mt-1 h-10 w-auto"
                                                onClick={() => handleGetDirections(selectedRequest)}
                                            >
                                                Get Directions
                                            </PrimaryButton>
                                            {directionsMessage ? (
                                                <p className="gathering-areas-selected-meta">{directionsMessage}</p>
                                            ) : null}
                                        </article>
                                    ) : (
                                        <p className="gathering-areas-empty-detail">
                                            Select a request marker to view details.
                                        </p>
                                    )}

                                    <p className="gathering-areas-overlay-title">Waiting Requests</p>
                                    <div className="gathering-areas-list">
                                        {visibleRequests.length ? (
                                            visibleRequests.map((item) => (
                                                <button
                                                    key={item.featureKey}
                                                    type="button"
                                                    className={`gathering-areas-item${selectedRequest?.featureKey === item.featureKey ? " is-active" : ""}`}
                                                    onClick={() => {
                                                        setSelectedRequestId(item.featureKey);
                                                        setDirectionsMessage("");
                                                    }}
                                                >
                                                    <p className="gathering-areas-item-name">{item.typeLabel}</p>
                                                    <p className="gathering-areas-item-meta">
                                                        Priority: {formatPriority(item.priorityLevel)} | {item.district}
                                                    </p>
                                                </button>
                                            ))
                                        ) : (
                                            <p className="gathering-areas-empty-detail">
                                                {isDiscoverable ? "No waiting requests in view." : ResourceZoomedOutMessage}
                                            </p>
                                        )}
                                    </div>
                                </aside>
                            ) : null}
                        </div>

                        {filterTypes.length ? (
                            <div className="crisis-filters-panel">
                                <div className="crisis-filters-header">
                                    <p className="crisis-filters-title">Filter by Request Type</p>
                                    <button
                                        type="button"
                                        className="crisis-filters-clear"
                                        disabled={!hasActiveFilters}
                                        onClick={() => setSelectedTypes(new Set())}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="crisis-filters-grid">
                                    {filterTypes.map((type) => {
                                        const isActive = selectedTypes.has(type);
                                        const swatchColor = REQUEST_TYPE_COLORS[type];
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`crisis-filter-chip${isActive ? " is-active" : ""}`}
                                                onClick={() => {
                                                    setSelectedTypes((current) => {
                                                        const next = new Set(current);
                                                        if (next.has(type)) {
                                                            next.delete(type);
                                                        } else {
                                                            next.add(type);
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                aria-pressed={isActive}
                                            >
                                                <span
                                                    className="crisis-filter-swatch"
                                                    style={{ backgroundColor: swatchColor }}
                                                    aria-hidden="true"
                                                />
                                                <span>{typeLabel(type)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="crisis-legend">
                                    {filterTypes.map((type) => (
                                        <span key={`legend-${type}`} className="crisis-legend-item">
                                            <span
                                                className="crisis-legend-swatch"
                                                style={{ backgroundColor: REQUEST_TYPE_COLORS[type] }}
                                                aria-hidden="true"
                                            />
                                            <span>{typeLabel(type)}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div className="gathering-areas-context-note">
                        <p className="gathering-areas-context-line">
                            Showing waiting help requests by type and priority.
                        </p>
                        <p className="gathering-areas-context-line">
                            {isDiscoverable ? "Browsing requests in the visible map area." : ResourceZoomedOutMessage}
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="gathering-areas-status-box">
                            <p>{ResourceLoadingMessage}</p>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="gathering-areas-status-box is-error">
                            <p>{error || ResourceErrorMessage}</p>
                        </div>
                    ) : null}

                    {isEmpty ? (
                        <div className="gathering-areas-status-box">
                            <p>{ResourceEmptyMessage}</p>
                        </div>
                    ) : null}
                    {isFilterEmpty ? (
                        <div className="gathering-areas-status-box">
                            <p>No help requests match the selected request type filters.</p>
                        </div>
                    ) : null}
                </SectionCard>
            </div>
        </AppShell>
    );
}
