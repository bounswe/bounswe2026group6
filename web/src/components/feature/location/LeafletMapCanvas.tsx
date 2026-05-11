"use client";

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapBounds = {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};

export type LatLng = {
    latitude: number;
    longitude: number;
};

type LeafletMapCanvasProps = {
    center: LatLng;
    zoom?: number;
    viewResetToken?: number;
    heightClassName?: string;
    ariaLabel?: string;
    onMapReady?: (map: L.Map) => void;
    onMapClick?: (position: LatLng) => void;
    onViewportChange?: (bounds: MapBounds) => void;
};

export function LeafletMapCanvas({
    center,
    zoom = 12,
    viewResetToken = 0,
    heightClassName = "h-72",
    ariaLabel = "Map",
    onMapReady,
    onMapClick,
    onViewportChange,
}: LeafletMapCanvasProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const mapRef = React.useRef<L.Map | null>(null);
    const onMapReadyRef = React.useRef(onMapReady);
    const onMapClickRef = React.useRef(onMapClick);
    const onViewportChangeRef = React.useRef(onViewportChange);

    React.useEffect(() => {
        onMapReadyRef.current = onMapReady;
    }, [onMapReady]);

    React.useEffect(() => {
        onMapClickRef.current = onMapClick;
    }, [onMapClick]);

    React.useEffect(() => {
        onViewportChangeRef.current = onViewportChange;
    }, [onViewportChange]);

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

        function emitViewport() {
            const bounds = map.getBounds();
            onViewportChangeRef.current?.({
                minLat: bounds.getSouth(),
                maxLat: bounds.getNorth(),
                minLon: bounds.getWest(),
                maxLon: bounds.getEast(),
            });
        }

        map.on("moveend", emitViewport);
        map.on("zoomend", emitViewport);

        mapRef.current = map;
        onMapReadyRef.current?.(map);
        emitViewport();

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

        map.setView([center.latitude, center.longitude], zoom, {
            animate: true,
        });
        map.invalidateSize();
    }, [center.latitude, center.longitude, zoom, viewResetToken]);

    return (
        <div
            className={`overflow-hidden rounded-[10px] border border-[color:var(--border-subtle)] ${heightClassName}`}
            role="region"
            aria-label={ariaLabel}
        >
            <div ref={containerRef} className="h-full w-full" />
        </div>
    );
}
