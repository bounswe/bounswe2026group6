"use client";

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type LatLng = {
    latitude: number;
    longitude: number;
};

type LeafletMapCanvasProps = {
    center: LatLng;
    zoom?: number;
    heightClassName?: string;
    onMapReady?: (map: L.Map) => void;
    onMapClick?: (position: LatLng) => void;
};

export function LeafletMapCanvas({
    center,
    zoom = 12,
    heightClassName = "h-72",
    onMapReady,
    onMapClick,
}: LeafletMapCanvasProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<L.Map | null>(null);
    const onMapReadyRef = React.useRef(onMapReady);
    const onMapClickRef = React.useRef(onMapClick);

    React.useEffect(() => {
        onMapReadyRef.current = onMapReady;
    }, [onMapReady]);

    React.useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    React.useEffect(() => {
        if (!containerRef.current || mapRef.current) {
            return;
        }

        const map = L.map(containerRef.current, {
            center: [center.latitude, center.longitude],
            zoom,
            scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        map.on("click", (event: L.LeafletMouseEvent) => {
            onMapClickRef.current?.({
                latitude: event.latlng.lat,
                longitude: event.latlng.lng,
            });
        });

        mapRef.current = map;
        onMapReadyRef.current?.(map);

        return () => {
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

    return (
        <div className={`overflow-hidden rounded-[10px] border border-[#e7e7ea] ${heightClassName}`}>
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}

export type { LatLng };
