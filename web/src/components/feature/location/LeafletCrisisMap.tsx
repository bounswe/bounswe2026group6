"use client";

import * as React from "react";
import L from "leaflet";
import { LeafletMapCanvas } from "@/components/feature/location/LeafletMapCanvas";
import type { LatLng } from "@/components/feature/location/LeafletMapCanvas";

type CrisisRequestType =
    | "SHELTER"
    | "FIRST_AID"
    | "SEARCH_AND_RESCUE"
    | "FOOD_WATER"
    | "OTHER";

type CrisisMapFeature = {
    featureKey: string;
    requestId: string;
    type: CrisisRequestType;
    typeLabel: string;
    priorityLevel: "LOW" | "MEDIUM" | "HIGH";
    createdAt: string;
    latitude: number;
    longitude: number;
    city: string;
    district: string;
};

type LeafletCrisisMapProps = {
    center: LatLng;
    features: CrisisMapFeature[];
    selectedFeatureId: string | null;
    onSelectFeature: (featureId: string) => void;
    heightClassName?: string;
    zoom?: number;
};

const TYPE_STYLES: Record<CrisisRequestType, { fill: string; stroke: string; glyph: string }> = {
    SHELTER: { fill: "#3b66d8", stroke: "#244ba7", glyph: "SH" },
    FIRST_AID: { fill: "#d94141", stroke: "#a92c2c", glyph: "+" },
    SEARCH_AND_RESCUE: { fill: "#f08c00", stroke: "#b96b00", glyph: "SR" },
    FOOD_WATER: { fill: "#2f9e67", stroke: "#22754c", glyph: "FW" },
    OTHER: { fill: "#687280", stroke: "#48515d", glyph: "?" },
};

function createMarkerIcon(feature: CrisisMapFeature, isSelected: boolean) {
    const style = TYPE_STYLES[feature.type];
    const selectedClass = isSelected ? " is-selected" : "";

    return L.divIcon({
        className: "",
        iconSize: [42, 52],
        iconAnchor: [21, 48],
        html: `
            <div class="crisis-pin${selectedClass}" style="--pin-fill:${style.fill};--pin-stroke:${style.stroke};">
                <span class="crisis-pin-head">
                    <span class="crisis-pin-glyph">${style.glyph}</span>
                </span>
                <span class="crisis-pin-point"></span>
            </div>
        `,
    });
}

function formatPriority(priority: CrisisMapFeature["priorityLevel"]) {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function createTooltipContent(feature: CrisisMapFeature) {
    const wrapper = document.createElement("div");
    wrapper.className = "crisis-tooltip-card";

    const title = document.createElement("strong");
    title.className = "crisis-tooltip-title";
    title.textContent = feature.typeLabel;

    const priority = document.createElement("span");
    priority.className = `crisis-tooltip-priority is-${feature.priorityLevel.toLowerCase()}`;
    priority.textContent = `Priority: ${formatPriority(feature.priorityLevel)}`;

    const location = document.createElement("span");
    location.className = "crisis-tooltip-location";
    location.textContent = `${feature.district}, ${feature.city}`;

    wrapper.appendChild(title);
    wrapper.appendChild(priority);
    wrapper.appendChild(location);

    return wrapper;
}

export function LeafletCrisisMap({
    center,
    features,
    selectedFeatureId,
    onSelectFeature,
    heightClassName = "h-[380px] md:h-[500px]",
    zoom = 11,
}: LeafletCrisisMapProps) {
    const mapRef = React.useRef<L.Map | null>(null);
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

        markerLayerRef.current = L.layerGroup().addTo(map);
    }, [mapReadyVersion]);

    React.useEffect(() => {
        return () => {
            markerRefs.current.clear();
            markerLayerRef.current?.clearLayers();
            markerLayerRef.current = null;
            mapRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        const markerLayer = markerLayerRef.current;
        if (!markerLayer) {
            return;
        }

        for (const marker of markerRefs.current.values()) {
            marker.closeTooltip();
            marker.off();
        }
        markerLayer.clearLayers();
        markerRefs.current.clear();

        for (const feature of features) {
            const marker = L.marker([feature.latitude, feature.longitude], {
                icon: createMarkerIcon(feature, false),
            });

            marker.bindTooltip(createTooltipContent(feature), {
                direction: "top",
                offset: [0, -42],
                opacity: 1,
                sticky: true,
                className: "crisis-leaflet-tooltip",
            });
            marker.on("mouseover", () => {
                for (const [featureId, activeMarker] of markerRefs.current.entries()) {
                    if (featureId !== feature.featureKey) {
                        activeMarker.closeTooltip();
                    }
                }
            });
            marker.on("click", () => {
                for (const activeMarker of markerRefs.current.values()) {
                    activeMarker.closeTooltip();
                }
                onSelectRef.current(feature.featureKey);
            });
            marker.addTo(markerLayer);
            markerRefs.current.set(feature.featureKey, marker);
        }
    }, [features, mapReadyVersion]);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        if (!features.length) {
            map.setView([center.latitude, center.longitude], zoom, { animate: true });
            return;
        }

        const bounds = L.latLngBounds(features.map((item) => [item.latitude, item.longitude] as [number, number]));
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    }, [features, center.latitude, center.longitude, zoom, mapReadyVersion]);

    React.useEffect(() => {
        for (const [featureId, marker] of markerRefs.current.entries()) {
            const feature = features.find((item) => item.featureKey === featureId);
            if (!feature) {
                continue;
            }
            const isSelected = featureId === selectedFeatureId;
            marker.setIcon(createMarkerIcon(feature, isSelected));
            marker.setTooltipContent(createTooltipContent(feature));
        }
    }, [selectedFeatureId, features]);

    return (
        <LeafletMapCanvas
            center={center}
            zoom={zoom}
            heightClassName={heightClassName}
            ariaLabel="Live crisis help requests map"
            onMapReady={(map) => {
                mapRef.current = map;
                setMapReadyVersion((version) => version + 1);
            }}
        />
    );
}

export type { CrisisMapFeature, CrisisRequestType };
