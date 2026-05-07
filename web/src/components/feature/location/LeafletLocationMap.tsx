"use client";

import * as React from "react";
import L from "leaflet";
import markerIcon2xAsset from "leaflet/dist/images/marker-icon-2x.png";
import markerIconAsset from "leaflet/dist/images/marker-icon.png";
import markerShadowAsset from "leaflet/dist/images/marker-shadow.png";
import { LeafletMapCanvas } from "@/components/feature/location/LeafletMapCanvas";
import type { LatLng } from "@/components/feature/location/LeafletMapCanvas";

type LeafletLocationMapProps = {
    center: LatLng;
    zoom?: number;
    selectedPosition: LatLng | null;
    heightClassName?: string;
    interactionMode?: "selectable" | "readonly";
    onSelectPosition?: (position: LatLng) => void;
};

function toAssetUrl(asset: string | { src: string }) {
    return typeof asset === "string" ? asset : asset.src;
}

const locationMarkerIcon = L.icon({
    iconUrl: toAssetUrl(markerIconAsset),
    iconRetinaUrl: toAssetUrl(markerIcon2xAsset),
    shadowUrl: toAssetUrl(markerShadowAsset),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

export function LeafletLocationMap({
    center,
    zoom = 12,
    selectedPosition,
    heightClassName = "h-72",
    interactionMode = "selectable",
    onSelectPosition,
}: LeafletLocationMapProps) {
    const mapRef = React.useRef<L.Map | null>(null);
    const markerRef = React.useRef<L.Marker | null>(null);
    const onSelectPositionRef = React.useRef(onSelectPosition);
    const [mapReadyVersion, setMapReadyVersion] = React.useState(0);

    React.useEffect(() => {
        onSelectPositionRef.current = onSelectPosition;
    }, [onSelectPosition]);

    React.useEffect(() => {
        return () => {
            markerRef.current?.remove();
            markerRef.current = null;
            mapRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        if (!selectedPosition) {
            markerRef.current?.remove();
            markerRef.current = null;
            return;
        }

        const latLng: L.LatLngExpression = [
            selectedPosition.latitude,
            selectedPosition.longitude,
        ];

        if (!markerRef.current) {
            const marker = L.marker(latLng, {
                icon: locationMarkerIcon,
                draggable: interactionMode === "selectable",
            });

            if (interactionMode === "selectable") {
                marker.on("dragend", () => {
                    const markerPosition = marker.getLatLng();
                    onSelectPositionRef.current?.({
                        latitude: markerPosition.lat,
                        longitude: markerPosition.lng,
                    });
                });
            }

            marker.addTo(map);
            markerRef.current = marker;
            return;
        }

        markerRef.current.off("dragend");

        if (interactionMode === "selectable") {
            markerRef.current.dragging?.enable();
            markerRef.current.on("dragend", () => {
                const markerPosition = markerRef.current?.getLatLng();
                if (!markerPosition) {
                    return;
                }

                onSelectPositionRef.current?.({
                    latitude: markerPosition.lat,
                    longitude: markerPosition.lng,
                });
            });
        } else {
            markerRef.current.dragging?.disable();
        }

        markerRef.current.setLatLng(latLng);
    }, [selectedPosition, interactionMode, mapReadyVersion]);

    return (
        <LeafletMapCanvas
            center={center}
            zoom={zoom}
            heightClassName={heightClassName}
            ariaLabel={
                interactionMode === "readonly"
                    ? "Saved location preview map"
                    : "Location picker map"
            }
            onMapReady={(map) => {
                mapRef.current = map;
                setMapReadyVersion((version) => version + 1);
            }}
            onMapClick={
                interactionMode === "selectable"
                    ? (position) => {
                        onSelectPositionRef.current?.(position);
                    }
                    : undefined
            }
        />
    );
}
