"use client";

import * as React from "react";
import L from "leaflet";
import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";
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

const markerIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function MapClickListener({
    onSelectPosition,
}: {
    onSelectPosition: (position: LatLng) => void;
}) {
    useMapEvents({
        click(event) {
            onSelectPosition({
                latitude: event.latlng.lat,
                longitude: event.latlng.lng,
            });
        },
    });

    return null;
}

function RecenterOnChange({ center }: { center: LatLng }) {
    const map = useMap();

    React.useEffect(() => {
        map.setView([center.latitude, center.longitude], map.getZoom(), {
            animate: true,
        });
    }, [center.latitude, center.longitude, map]);

    return null;
}

export function LeafletLocationMap({
    center,
    zoom = 12,
    selectedPosition,
    heightClassName = "h-72",
    onSelectPosition,
}: LeafletLocationMapProps) {
    return (
        <div className={`overflow-hidden rounded-[10px] border border-[#e7e7ea] ${heightClassName}`}>
            <MapContainer
                center={[center.latitude, center.longitude]}
                zoom={zoom}
                className="h-full w-full"
                scrollWheelZoom
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapClickListener onSelectPosition={onSelectPosition} />
                <RecenterOnChange center={center} />

                {selectedPosition ? (
                    <Marker
                        icon={markerIcon}
                        position={[selectedPosition.latitude, selectedPosition.longitude]}
                        draggable
                        eventHandlers={{
                            dragend(event) {
                                const marker = event.target;
                                const latLng = marker.getLatLng();

                                onSelectPosition({
                                    latitude: latLng.lat,
                                    longitude: latLng.lng,
                                });
                            },
                        }}
                    />
                ) : null}
            </MapContainer>
        </div>
    );
}
