"use client";

import * as React from "react";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import { LocationPickerMap } from "@/components/feature/location/LocationPickerMap";
import { reverseLocation, searchLocations } from "@/lib/location";
import { LocationSearchItem } from "@/types/location";

type LocationPickerValue = {
    placeId: string;
    displayName: string;
    latitude: number;
    longitude: number;
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
        administrative: item.administrative,
    };
}

export function LocationPicker({
    countryCode = "TR",
    value,
    onChange,
    label = "Select location from map",
}: LocationPickerProps) {
    const [query, setQuery] = React.useState("");
    const [searching, setSearching] = React.useState(false);
    const [resolving, setResolving] = React.useState(false);
    const [results, setResults] = React.useState<LocationSearchItem[]>([]);
    const [error, setError] = React.useState("");

    const center = value
        ? { latitude: value.latitude, longitude: value.longitude }
        : DEFAULT_CENTER;

    const handleSearch = React.useCallback(async () => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        try {
            setSearching(true);
            setError("");

            const response = await searchLocations({
                q: query.trim(),
                countryCode,
                limit: 10,
            });

            setResults(response.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not search locations.");
        } finally {
            setSearching(false);
        }
    }, [countryCode, query]);

    const handleResolveCoordinates = React.useCallback(
        async (latitude: number, longitude: number) => {
            try {
                setResolving(true);
                setError("");

                const response = await reverseLocation({ latitude, longitude });
                onChange(toPickerValue(response.item));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not resolve selected location.");
                onChange({
                    placeId: "",
                    displayName: "",
                    latitude,
                    longitude,
                    administrative: {},
                });
            } finally {
                setResolving(false);
            }
        },
        [onChange]
    );

    const handleUseCurrentLocation = React.useCallback(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported in this browser.");
            return;
        }

        setError("");
        setResolving(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                void handleResolveCoordinates(
                    position.coords.latitude,
                    position.coords.longitude
                );
            },
            (geoError) => {
                setResolving(false);
                setError(geoError.message || "Could not access current location.");
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        );
    }, [handleResolveCoordinates]);

    React.useEffect(() => {
        const timeout = setTimeout(() => {
            void handleSearch();
        }, 350);

        return () => clearTimeout(timeout);
    }, [handleSearch]);

    return (
        <div className="flex flex-col gap-3">
            <HelperText className="text-sm text-[#2b2b33]">{label}</HelperText>

            <div className="flex flex-col gap-2 sm:flex-row">
                <TextInput
                    id="location-search"
                    placeholder="Search location"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />

                <PrimaryButton
                    type="button"
                    className="sm:w-52"
                    onClick={handleUseCurrentLocation}
                    loading={resolving}
                >
                    Use Current Location
                </PrimaryButton>
            </div>

            {results.length > 0 ? (
                <div className="max-h-44 overflow-auto rounded-[10px] border border-[#e7e7ea] bg-white">
                    {results.map((item) => (
                        <button
                            key={`${item.placeId}-${item.latitude}-${item.longitude}`}
                            type="button"
                            className="w-full border-b border-[#f0f0f2] px-3 py-2 text-left text-sm text-[#2b2b33] transition-colors hover:bg-[#fafafa]"
                            onClick={() => {
                                onChange(toPickerValue(item));
                                setResults([]);
                                setQuery(item.displayName);
                            }}
                        >
                            {item.displayName}
                        </button>
                    ))}
                </div>
            ) : null}

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
                    void handleResolveCoordinates(position.latitude, position.longitude);
                }}
            />

            {searching ? <HelperText>Searching locations...</HelperText> : null}
            {resolving ? <HelperText>Resolving selected coordinates...</HelperText> : null}

            {value ? (
                <HelperText>
                    Selected: {value.displayName || `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`}
                </HelperText>
            ) : null}

            {error ? <HelperText className="text-red-500">{error}</HelperText> : null}
        </div>
    );
}

export type { LocationPickerValue };
