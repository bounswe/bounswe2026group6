"use client";

import * as React from "react";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import { LocationPickerMap } from "@/components/feature/location/LocationPickerMap";
import { reverseLocation } from "@/lib/location";
import { LocationSearchItem } from "@/types/location";

type LocationPickerValue = {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    source?: string | null;
    capturedAt?: string | null;
    administrative: LocationSearchItem["administrative"];
};

type LocationPickerProps = {
    countryCode?: string;
    value: LocationPickerValue | null;
    onChange: (value: LocationPickerValue | null) => void;
    label?: string;
};

const DEFAULT_CENTER = {
    latitude: 39.0,
    longitude: 35.0,
};

function toPickerValue(item: LocationSearchItem): LocationPickerValue {
    return {
        placeId: item.placeId,
        displayName: item.displayName,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracyMeters: null,
        source: "search",
        capturedAt: new Date().toISOString(),
        administrative: item.administrative,
    };
}

function toManualPickerValue(latitude: number, longitude: number): LocationPickerValue {
    const normalizedLatitude = latitude.toFixed(6);
    const normalizedLongitude = longitude.toFixed(6);

    return {
        placeId: `manual:${normalizedLatitude},${normalizedLongitude}`,
        displayName: `Pinned location (${normalizedLatitude}, ${normalizedLongitude})`,
        latitude,
        longitude,
        accuracyMeters: null,
        source: "map_pin",
        capturedAt: new Date().toISOString(),
        administrative: {},
    };
}

function mapGeolocationError(geoError: GeolocationPositionError) {
    switch (geoError.code) {
        case geoError.PERMISSION_DENIED:
            return "Location permission was denied. Enable location access in your browser settings.";
        case geoError.POSITION_UNAVAILABLE:
            return "Current location is unavailable right now. Please try again or select from map.";
        case geoError.TIMEOUT:
            return "Location request timed out. Please try again.";
        default:
            return geoError.message || "Could not access current location.";
    }
}

export function LocationPicker({
    value,
    onChange,
    label = "Select location from map",
}: LocationPickerProps) {
    const [resolving, setResolving] = React.useState(false);
    const [error, setError] = React.useState("");
    const reverseRequestIdRef = React.useRef(0);

    const center = value
        ? { latitude: value.latitude, longitude: value.longitude }
        : DEFAULT_CENTER;

    const handleResolveCoordinates = React.useCallback(
        async (
            latitude: number,
            longitude: number,
            metadata?: {
                source?: string | null;
                accuracyMeters?: number | null;
                capturedAt?: string | null;
            }
        ) => {
            const currentReverseRequestId = ++reverseRequestIdRef.current;

            try {
                setResolving(true);
                setError("");

                const response = await reverseLocation({ latitude, longitude });

                if (currentReverseRequestId !== reverseRequestIdRef.current) {
                    return;
                }

                onChange({
                    ...toPickerValue(response.item),
                    source: metadata?.source ?? "map_pin",
                    accuracyMeters: metadata?.accuracyMeters ?? null,
                    capturedAt: metadata?.capturedAt ?? new Date().toISOString(),
                });
            } catch (err) {
                if (currentReverseRequestId !== reverseRequestIdRef.current) {
                    return;
                }

                setError(err instanceof Error ? err.message : "Could not resolve selected location.");
                onChange({
                    ...toManualPickerValue(latitude, longitude),
                    source: metadata?.source ?? "map_pin",
                    accuracyMeters: metadata?.accuracyMeters ?? null,
                    capturedAt: metadata?.capturedAt ?? new Date().toISOString(),
                });
            } finally {
                if (currentReverseRequestId === reverseRequestIdRef.current) {
                    setResolving(false);
                }
            }
        },
        [onChange]
    );

    const handleUseCurrentLocation = React.useCallback(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported in this browser.");
            return;
        }

        const requestLocation = () => {
            setError("");
            setResolving(true);

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    onChange({
                        ...toManualPickerValue(
                            position.coords.latitude,
                            position.coords.longitude
                        ),
                        source: "current_device",
                        accuracyMeters:
                            typeof position.coords.accuracy === "number"
                                ? position.coords.accuracy
                                : null,
                        capturedAt: new Date(position.timestamp).toISOString(),
                    });

                    void handleResolveCoordinates(
                        position.coords.latitude,
                        position.coords.longitude,
                        {
                            source: "current_device",
                            accuracyMeters:
                                typeof position.coords.accuracy === "number"
                                    ? position.coords.accuracy
                                    : null,
                            capturedAt: new Date(position.timestamp).toISOString(),
                        }
                    );
                },
                (geoError) => {
                    setResolving(false);
                    setError(mapGeolocationError(geoError));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                }
            );
        };

        if (!navigator.permissions?.query) {
            requestLocation();
            return;
        }

        void navigator.permissions
            .query({ name: "geolocation" })
            .then((permissionStatus) => {
                if (permissionStatus.state === "denied") {
                    setError(
                        "Location permission is denied. Enable location access in your browser settings."
                    );
                    return;
                }

                requestLocation();
            })
            .catch(() => {
                requestLocation();
            });
    }, [handleResolveCoordinates]);

    return (
        <div className="location-picker-wrap flex flex-col gap-3">
            <HelperText className="text-sm text-[color:var(--text-primary)]">{label}</HelperText>

            <PrimaryButton
                type="button"
                className="w-full sm:w-52"
                onClick={handleUseCurrentLocation}
                loading={resolving}
            >
                Use Current Location
            </PrimaryButton>

            <LocationPickerMap
                center={center}
                selectedPosition={
                    value
                        ? {
                            latitude: value.latitude,
                            longitude: value.longitude,
                        }
                        : null
                }
                onSelectPosition={(position) => {
                    onChange({
                        ...toManualPickerValue(position.latitude, position.longitude),
                        source: "map_pin",
                        accuracyMeters: null,
                        capturedAt: new Date().toISOString(),
                    });

                    void handleResolveCoordinates(position.latitude, position.longitude, {
                        source: "map_pin",
                        accuracyMeters: null,
                    });
                }}
            />

            {resolving ? <HelperText>Resolving selected coordinates...</HelperText> : null}

            {value ? (
                <HelperText>
                    Selected: {value.displayName || `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`}
                </HelperText>
            ) : null}

            {error ? <HelperText className="text-[color:var(--primary-500)]">{error}</HelperText> : null}
        </div>
    );
}

export type { LocationPickerValue };
