"use client";

import * as React from "react";
import L from "leaflet";
import { LeafletMapCanvas } from "@/components/feature/location/LeafletMapCanvas";

type LatLng = {
    latitude: number;
    longitude: number;
};

type GatheringAreaMapFeature = {
    featureKey: string;
    id: string;
    osmType: string;
    name: string;
    category: string;
    distanceMeters: number;
    latitude: number;
    longitude: number;
};

type LeafletGatheringAreasMapProps = {
    center: LatLng;
    features: GatheringAreaMapFeature[];
    selectedFeatureId: string | null;
    onSelectFeature: (featureId: string) => void;
    heightClassName?: string;
    zoom?: number;
};

function createPopupContent(feature: GatheringAreaMapFeature) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "grid";
    wrapper.style.gap = "4px";

    const title = document.createElement("strong");
    title.textContent = feature.name || "Unnamed gathering area";

    const category = document.createElement("span");
    category.textContent = `Category: ${feature.category || "unknown"}`;

    const distance = document.createElement("span");
    distance.textContent = `Distance: ${feature.distanceMeters} m`;

    wrapper.appendChild(title);
    wrapper.appendChild(category);
    wrapper.appendChild(distance);

    return wrapper;
}

export function LeafletGatheringAreasMap({
    center,
    features,
    selectedFeatureId,
    onSelectFeature,
    heightClassName = "h-[380px] md:h-[500px]",
    zoom = 14,
}: LeafletGatheringAreasMapProps) {
    const mapRef = React.useRef<L.Map | null>(null);
    const centerMarkerRef = React.useRef<L.CircleMarker | null>(null);
    const markerLayerRef = React.useRef<L.LayerGroup | null>(null);
    const markerRefs = React.useRef<Map<string, L.CircleMarker>>(new Map());
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

        if (!centerMarkerRef.current) {
            centerMarkerRef.current = L.circleMarker([center.latitude, center.longitude], {
                radius: 8,
                color: "#b23b3b",
                weight: 2,
                fillColor: "#d84a4a",
                fillOpacity: 0.35,
            }).addTo(map);
        } else {
            centerMarkerRef.current.setLatLng([center.latitude, center.longitude]);
        }
    }, [center.latitude, center.longitude]);

    React.useEffect(() => {
        const markerLayer = markerLayerRef.current;
        if (!markerLayer) {
            return;
        }

        markerLayer.clearLayers();
        markerRefs.current.clear();

        for (const feature of features) {
            const marker = L.circleMarker([feature.latitude, feature.longitude], {
                radius: feature.featureKey === selectedFeatureId ? 9 : 7,
                color: feature.featureKey === selectedFeatureId ? "#a93232" : "#d84a4a",
                weight: 2,
                fillColor: feature.featureKey === selectedFeatureId ? "#c53e3e" : "#f4b740",
                fillOpacity: 0.85,
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
            marker.setStyle({
                radius: isActive ? 9 : 7,
                color: isActive ? "#a93232" : "#d84a4a",
                fillColor: isActive ? "#c53e3e" : "#f4b740",
            });

            if (isActive) {
                marker.openPopup();
            }
        }
    }, [selectedFeatureId]);

    return (
        <LeafletMapCanvas
            center={center}
            zoom={zoom}
            heightClassName={heightClassName}
            onMapReady={(map) => {
                mapRef.current = map;
                setMapReadyVersion((version) => version + 1);
            }}
        />
    );
}

export type { GatheringAreaMapFeature };
