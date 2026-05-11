"use client";

import * as React from "react";
import L from "leaflet";
import { LeafletMapCanvas } from "@/components/feature/location/LeafletMapCanvas";
import type { LatLng, MapBounds } from "@/components/feature/location/LeafletMapCanvas";

type GatheringAreaMapFeature = {
    featureKey: string;
    id: string;
    osmType: string;
    name: string;
    address: string;
    category: string;
    categoryLabel: string;
    distanceMeters: number;
    latitude: number;
    longitude: number;
};

type LeafletGatheringAreasMapProps = {
    center: LatLng;
    showLiveLocation?: boolean;
    features: GatheringAreaMapFeature[];
    selectedFeatureId: string | null;
    onSelectFeature: (featureId: string) => void;
    onViewportChange?: (bounds: MapBounds) => void;
    heightClassName?: string;
    zoom?: number;
    viewResetToken?: number;
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

function getCategoryMarkerStyle(category: string) {
    const normalized = (category || "").trim().toLowerCase();
    if (normalized === "assembly_point") return { fill: "#e35f4f", stroke: "#c73d2a", glyph: "AP" };
    if (normalized === "shelter") return { fill: "#f3b545", stroke: "#d08a1f", glyph: "SH" };
    if (normalized === "hospital") return { fill: "#ef4444", stroke: "#b91c1c", glyph: "HP" };
    if (normalized === "police") return { fill: "#3b82f6", stroke: "#1e40af", glyph: "PL" };
    if (normalized === "fire_station") return { fill: "#f97316", stroke: "#9a3412", glyph: "FS" };
    if (normalized === "pharmacy") return { fill: "#22c55e", stroke: "#166534", glyph: "PH" };
    return { fill: "#4da2ea", stroke: "#2b7fc8", glyph: "OT" };
}

function createGatheringAreaMarkerIcon(category: string, selected: boolean) {
    const style = getCategoryMarkerStyle(category);
    const selectedClass = selected ? " is-selected" : "";
    return L.divIcon({
        className: "",
        html: `
            <div class="crisis-pin${selectedClass}" style="--pin-fill:${style.fill};--pin-stroke:${style.stroke};">
                <span class="crisis-pin-head">
                    <span class="crisis-pin-glyph">${style.glyph}</span>
                </span>
                <span class="crisis-pin-point"></span>
            </div>
        `,
        iconSize: [42, 52],
        iconAnchor: [21, 48],
        popupAnchor: [0, -42],
    });
}

function formatDistanceLabel(distanceMeters: number) {
    if (distanceMeters >= 1000) {
        return `${(distanceMeters / 1000).toFixed(1)} km`;
    }

    return `${distanceMeters} m`;
}

function createLiveLocationIcon(): L.DivIcon {
    return L.divIcon({
        className: "gathering-areas-live-dot",
        html: '<span class="gathering-areas-live-dot-core" aria-hidden="true"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    });
}

function createPopupContent(feature: GatheringAreaMapFeature) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "grid";
    wrapper.style.gap = "4px";

    const title = document.createElement("strong");
    title.textContent = feature.name || "Unnamed gathering area";

    const category = document.createElement("span");
    category.textContent = `Type: ${feature.categoryLabel || formatCategoryLabel(feature.category)}`;

    const distance = document.createElement("span");
    distance.textContent = `Distance: ${formatDistanceLabel(feature.distanceMeters)}`;

    wrapper.appendChild(title);
    wrapper.appendChild(category);
    wrapper.appendChild(distance);

    return wrapper;
}

export function LeafletGatheringAreasMap({
    center,
    showLiveLocation = false,
    features,
    selectedFeatureId,
    onSelectFeature,
    onViewportChange,
    heightClassName = "h-[380px] md:h-[500px]",
    zoom = 14,
    viewResetToken = 0,
}: LeafletGatheringAreasMapProps) {
    const mapRef = React.useRef<L.Map | null>(null);
    const centerMarkerRef = React.useRef<L.Marker | null>(null);
    const markerLayerRef = React.useRef<L.LayerGroup | null>(null);
    const markerRefs = React.useRef<Map<string, L.Marker>>(new Map());
    const onSelectRef = React.useRef(onSelectFeature);
    const [mapReadyVersion, setMapReadyVersion] = React.useState(0);

    React.useEffect(() => {
        onSelectRef.current = onSelectFeature;
    }, [onSelectFeature]);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map || markerLayerRef.current) {
            return;
        }

        const markerLayer = L.layerGroup().addTo(map);
        markerLayerRef.current = markerLayer;
    }, [mapReadyVersion]);

    React.useEffect(() => {
        return () => {
            markerRefs.current.clear();
            markerLayerRef.current?.clearLayers();
            markerLayerRef.current = null;
            centerMarkerRef.current = null;
            mapRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        map.setView([center.latitude, center.longitude], map.getZoom(), {
            animate: true,
        });

        if (!showLiveLocation) {
            if (centerMarkerRef.current) {
                map.removeLayer(centerMarkerRef.current);
                centerMarkerRef.current = null;
            }
            return;
        }

        if (!centerMarkerRef.current) {
            centerMarkerRef.current = L.marker([center.latitude, center.longitude], {
                icon: createLiveLocationIcon(),
                interactive: false,
                keyboard: false,
            }).addTo(map);
        } else {
            centerMarkerRef.current.setLatLng([center.latitude, center.longitude]);
        }
    }, [center.latitude, center.longitude, showLiveLocation]);

    React.useEffect(() => {
        const markerLayer = markerLayerRef.current;
        if (!markerLayer) {
            return;
        }

        markerLayer.clearLayers();
        markerRefs.current.clear();

        for (const feature of features) {
            const isActive = feature.featureKey === selectedFeatureId;
            const marker = L.marker([feature.latitude, feature.longitude], {
                icon: createGatheringAreaMarkerIcon(feature.category, isActive),
                riseOnHover: true,
            });

            marker.bindPopup(createPopupContent(feature));
            marker.on("click", () => onSelectRef.current(feature.featureKey));
            marker.addTo(markerLayer);
            markerRefs.current.set(feature.featureKey, marker);
        }
    }, [features, selectedFeatureId, mapReadyVersion]);

    React.useEffect(() => {
        for (const [featureId, marker] of markerRefs.current.entries()) {
            const isActive = featureId === selectedFeatureId;
            const feature = features.find((item) => item.featureKey === featureId);
            if (feature) {
                marker.setIcon(createGatheringAreaMarkerIcon(feature.category, isActive));
            }
            marker.setZIndexOffset(isActive ? 600 : 0);

            if (isActive) {
                marker.openPopup();
            }
        }
    }, [selectedFeatureId, features]);

    return (
        <LeafletMapCanvas
            center={center}
            zoom={zoom}
            viewResetToken={viewResetToken}
            heightClassName={heightClassName}
            ariaLabel="Nearby gathering areas map"
            onViewportChange={onViewportChange}
            onMapReady={(map) => {
                mapRef.current = map;
                setMapReadyVersion((version) => version + 1);
            }}
        />
    );
}

export type { GatheringAreaMapFeature };
