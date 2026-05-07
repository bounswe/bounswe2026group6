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

const DEFAULT_CENTER = {
    latitude: 41.0082,
    longitude: 28.9784,
};

const FETCH_LIMIT = 300;
type FetchState = "idle" | "loading" | "success" | "empty" | "error";
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
    if (value === "fire_brigade" || value === "search_and_rescue") {
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
    const [center] = React.useState(DEFAULT_CENTER);
    const [requests, setRequests] = React.useState<CrisisMapFeature[]>([]);
    const [selectedRequestId, setSelectedRequestId] = React.useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = React.useState(true);
    const [fetchState, setFetchState] = React.useState<FetchState>("idle");
    const [error, setError] = React.useState("");
    const [directionsMessage, setDirectionsMessage] = React.useState("");
    const [selectedTypes, setSelectedTypes] = React.useState<Set<CrisisRequestType>>(new Set());
    const requestIdRef = React.useRef(0);

    const loadActiveRequests = React.useCallback(async () => {
        const currentRequestId = ++requestIdRef.current;
        try {
            setFetchState("loading");
            setError("");

            const token = getAccessToken();
            const response = await fetchActiveHelpRequests({
                token,
                status: "PENDING",
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
        }
    }, []);

    React.useEffect(() => {
        void loadActiveRequests();
    }, [loadActiveRequests]);

    const isLoading = fetchState === "loading";
    const isEmpty = fetchState === "empty";
    const visibleRequests = React.useMemo(() => {
        if (!selectedTypes.size) {
            return requests;
        }
        return requests.filter((item) => selectedTypes.has(item.type));
    }, [requests, selectedTypes]);
    const hasActiveFilters = selectedTypes.size > 0;
    const isFilterEmpty = !isLoading && requests.length > 0 && visibleRequests.length === 0;

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
                                features={visibleRequests}
                                selectedFeatureId={selectedRequestId}
                                onSelectFeature={(featureId) => {
                                    setSelectedRequestId(featureId);
                                    setIsDetailsOpen(true);
                                    setDirectionsMessage("");
                                }}
                                heightClassName="h-[380px] md:h-[500px]"
                            />

                            <p className="gathering-areas-map-note">
                                Showing waiting help requests by type and priority.
                            </p>

                            <button
                                type="button"
                                aria-label="Refresh Help Request Map"
                                title="Refresh Help Request Map"
                                className="gathering-areas-map-retry"
                                onClick={() => {
                                    void loadActiveRequests();
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
                                                No waiting requests in view.
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

                    {isLoading ? (
                        <div className="gathering-areas-status-box">
                            <p>Loading waiting help requests...</p>
                        </div>
                    ) : null}

                    {error ? (
                        <div className="gathering-areas-status-box is-error">
                            <p>{error}</p>
                        </div>
                    ) : null}

                    {isEmpty ? (
                        <div className="gathering-areas-status-box">
                            <p>No waiting help requests are available right now.</p>
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
