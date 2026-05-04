"use client";

import * as React from "react";
import L from "leaflet";
import markerIcon2xAsset from "leaflet/dist/images/marker-icon-2x.png";
import markerIconAsset from "leaflet/dist/images/marker-icon.png";
import markerShadowAsset from "leaflet/dist/images/marker-shadow.png";
import { LeafletMapCanvas } from "@/components/feature/location/LeafletMapCanvas";
import type { LatLng } from "@/components/feature/location/LeafletMapCanvas";

type GatheringAreaMapFeature = {
    featureKey: string;
    id: string;
    osmType: string;
    name: string;
    address: string;
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

function toAssetUrl(asset: string | { src: string }) {
    return typeof asset === "string" ? asset : asset.src;
}

const gatheringAreaMarkerIcon = L.icon({
    iconUrl: toAssetUrl(markerIconAsset),
    iconRetinaUrl: toAssetUrl(markerIcon2xAsset),
    shadowUrl: toAssetUrl(markerShadowAsset),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

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
    category.textContent = `Type: ${formatCategoryLabel(feature.category)}`;

    const distance = document.createElement("span");
    distance.textContent = `Distance: ${formatDistanceLabel(feature.distanceMeters)}`;

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

        if (!centerMarkerRef.current) {
            centerMarkerRef.current = L.marker([center.latitude, center.longitude], {
                icon: createLiveLocationIcon(),
                interactive: false,
                keyboard: false,
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
            const marker = L.marker([feature.latitude, feature.longitude], {
                icon: gatheringAreaMarkerIcon,
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
            heightClassName={heightClassName}
            ariaLabel="Nearby gathering areas map"
            onMapReady={(map) => {
                mapRef.current = map;
                setMapReadyVersion((version) => version + 1);
            }}
        />
    );
}

export type { GatheringAreaMapFeature };
