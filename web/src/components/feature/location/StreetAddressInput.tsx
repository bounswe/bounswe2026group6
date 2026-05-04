"use client";

import * as React from "react";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { searchLocations } from "@/lib/location";
import { LocationSearchItem } from "@/types/location";

type StreetAddressInputProps = {
    id?: string;
    label?: string;
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
    onSelectSuggestion: (item: LocationSearchItem) => void;
    countryCode?: string;
    /** Used to scope the autocomplete to the currently chosen area. */
    scope: {
        country?: string;
        city?: string;
        district?: string;
        neighborhood?: string;
    };
    disabled?: boolean;
};

export function StreetAddressInput({
    id,
    label = "Extra Address",
    placeholder = "Start typing a street name",
    value,
    onChange,
    onSelectSuggestion,
    countryCode = "TR",
    scope,
    disabled = false,
}: StreetAddressInputProps) {
    const [suggestions, setSuggestions] = React.useState<LocationSearchItem[]>([]);
    const [open, setOpen] = React.useState(false);
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
    const requestIdRef = React.useRef(0);
    const skipNextSearchRef = React.useRef(false);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    React.useEffect(() => {
        if (skipNextSearchRef.current) {
            skipNextSearchRef.current = false;
            return;
        }

        const trimmed = value.trim();
        if (trimmed.length < 2) {
            setSuggestions([]);
            return;
        }

        const scopeQuery = [
            trimmed,
            scope.neighborhood,
            scope.district,
            scope.city,
            scope.country,
        ]
            .filter(Boolean)
            .join(", ");

        const currentRequestId = ++requestIdRef.current;

        const timeout = setTimeout(async () => {
            try {
                const response = await searchLocations({
                    q: scopeQuery,
                    countryCode,
                    limit: 6,
                });

                if (currentRequestId !== requestIdRef.current) {
                    return;
                }

                setSuggestions(response.items);
            } catch {
                if (currentRequestId !== requestIdRef.current) {
                    return;
                }
                setSuggestions([]);
            }
        }, 350);

        return () => clearTimeout(timeout);
    }, [
        value,
        scope.country,
        scope.city,
        scope.district,
        scope.neighborhood,
        countryCode,
    ]);

    const handleSelect = (item: LocationSearchItem) => {
        skipNextSearchRef.current = true;
        const street = item.administrative.extraAddress || item.displayName;
        onChange(street);
        onSelectSuggestion(item);
        setSuggestions([]);
        setOpen(false);
        setHighlightedIndex(-1);
    };

    return (
        <div ref={wrapperRef} className="street-address-input relative w-full">
            <TextInput
                id={id}
                label={label}
                placeholder={placeholder}
                value={value}
                disabled={disabled}
                autoComplete="off"
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(true);
                    setHighlightedIndex(-1);
                }}
                onFocus={() => {
                    if (suggestions.length > 0) {
                        setOpen(true);
                    }
                }}
                onKeyDown={(event) => {
                    if (!open || suggestions.length === 0) {
                        return;
                    }

                    if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setHighlightedIndex((index) =>
                            Math.min(index + 1, suggestions.length - 1)
                        );
                    } else if (event.key === "ArrowUp") {
                        event.preventDefault();
                        setHighlightedIndex((index) => Math.max(index - 1, 0));
                    } else if (event.key === "Enter" && highlightedIndex >= 0) {
                        event.preventDefault();
                        handleSelect(suggestions[highlightedIndex]);
                    } else if (event.key === "Escape") {
                        setOpen(false);
                    }
                }}
            />

            {open && suggestions.length > 0 ? (
                <ul
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-[10px] border border-[#e7e7ea] bg-white shadow-md"
                >
                    {suggestions.map((item, index) => (
                        <li key={`${item.placeId}-${item.latitude}-${item.longitude}`}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === highlightedIndex}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                onClick={() => handleSelect(item)}
                                className={`block w-full border-b border-[#f0f0f2] px-3 py-2 text-left text-sm text-[#2b2b33] transition-colors ${
                                    index === highlightedIndex
                                        ? "bg-[#fafafa]"
                                        : "hover:bg-[#fafafa]"
                                }`}
                            >
                                {item.displayName}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
