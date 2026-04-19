"use client";

import * as React from "react";
import L from "leaflet";
import markerIcon2xAsset from "leaflet/dist/images/marker-icon-2x.png";
import markerIconAsset from "leaflet/dist/images/marker-icon.png";
import markerShadowAsset from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";

type LatLng = {
    latitude: number;
    longitude: number;
};

type LeafletLocationMapProps = {
    center: LatLng;
    zoom?: number;
    selectedPosition: LatLng | null;
    heightClassName?: string;
    onSelectPosition: (position: LatLng) => void;
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
    onSelectPosition,
}: LeafletLocationMapProps) {
    const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<L.Map | null>(null);
    const markerRef = React.useRef<L.Marker | null>(null);
    const onSelectPositionRef = React.useRef(onSelectPosition);

    React.useEffect(() => {
        onSelectPositionRef.current = onSelectPosition;
    }, [onSelectPosition]);

    React.useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) {
            return;
        }

        const map = L.map(mapContainerRef.current, {
            center: [center.latitude, center.longitude],
            zoom,
            scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.on("click", (event: L.LeafletMouseEvent) => {
            onSelectPositionRef.current({
                latitude: event.latlng.lat,
                longitude: event.latlng.lng,
            });
        });

        mapRef.current = map;

        return () => {
            markerRef.current?.remove();
            markerRef.current = null;
            map.remove();
            mapRef.current = null;
        };
    }, []);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        if (map.getZoom() !== zoom) {
            map.setZoom(zoom);
        }
    }, [zoom]);

    React.useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            return;
        }

        map.setView([center.latitude, center.longitude], map.getZoom(), {
            animate: true,
        });
    }, [center.latitude, center.longitude]);

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
                draggable: true,
            });

            marker.on("dragend", () => {
                const markerPosition = marker.getLatLng();
                onSelectPositionRef.current({
                    latitude: markerPosition.lat,
                    longitude: markerPosition.lng,
                });
            });

            marker.addTo(map);
            markerRef.current = marker;
            return;
        }

        markerRef.current.setLatLng(latLng);
    }, [selectedPosition]);

    return (
        <div className={`overflow-hidden rounded-[10px] border border-[#e7e7ea] ${heightClassName}`}>
            <div ref={mapContainerRef} className="h-full w-full" />
        </div>
    );
}
