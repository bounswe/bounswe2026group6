import { LocationTreeCountry, LocationTreeNeighborhood } from "@/types/location";

export type LocationTreeByCountry = Record<string, LocationTreeCountry>;

function normalize(value: string) {
    return value
        .toLocaleLowerCase("tr")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function normalizeIfPresent(value: string | undefined | null) {
    return normalize(value || "");
}

export function findCountryKeyByLabel(
    locationTree: LocationTreeByCountry,
    label: string
) {
    if (!label.trim()) {
        return "";
    }

    const normalizedLabel = normalize(label);

    return (
        Object.entries(locationTree).find(([key, country]) => {
            return (
                normalizeIfPresent(key) === normalizedLabel ||
                normalizeIfPresent(country.label) === normalizedLabel
            );
        })?.[0] ||
        ""
    );
}

export function findCityKeyByLabel(
    locationTree: LocationTreeByCountry,
    countryKey: string,
    label: string
) {
    if (!countryKey || !label.trim()) {
        return "";
    }

    const country = locationTree[countryKey];
    if (!country) {
        return "";
    }

    const normalizedLabel = normalize(label);

    return (
        Object.entries(country.cities).find(([key, city]) => {
            return (
                normalizeIfPresent(key) === normalizedLabel ||
                normalizeIfPresent(city.label) === normalizedLabel
            );
        })?.[0] ||
        ""
    );
}

export function findDistrictKeyByLabel(
    locationTree: LocationTreeByCountry,
    countryKey: string,
    cityKey: string,
    label: string
) {
    if (!countryKey || !cityKey || !label.trim()) {
        return "";
    }

    const districts = locationTree[countryKey]?.cities[cityKey]?.districts;
    if (!districts) {
        return "";
    }

    const normalizedLabel = normalize(label);

    return (
        Object.entries(districts).find(([key, district]) => {
            return (
                normalizeIfPresent(key) === normalizedLabel ||
                normalizeIfPresent(district.label) === normalizedLabel
            );
        })?.[0] ||
        ""
    );
}

export function findNeighborhoodValueByLabel(
    neighborhoods: LocationTreeNeighborhood[],
    label: string
) {
    if (!label.trim()) {
        return "";
    }

    const normalizedLabel = normalize(label);

    return (
        neighborhoods.find((item) => {
            return (
                normalizeIfPresent(item.label) === normalizedLabel ||
                normalizeIfPresent(item.value) === normalizedLabel
            );
        })?.value ||
        ""
    );
}

export function parseLocationAddress(
    locationTree: LocationTreeByCountry,
    countryKey: string,
    cityKey: string,
    address: string
) {
    const tokens = address
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    if (!countryKey || !cityKey || tokens.length === 0) {
        return {
            district: "",
            neighborhood: "",
            extraAddress: address,
        };
    }

    const city = locationTree[countryKey]?.cities[cityKey];
    if (!city) {
        return {
            district: "",
            neighborhood: "",
            extraAddress: address,
        };
    }

    const remainingTokens = new Map(tokens.map((token) => [normalize(token), token]));

    let district = "";
    let neighborhood = "";

    for (const [districtKey, districtValue] of Object.entries(city.districts)) {
        const matchedDistrict = [districtKey, districtValue.label]
            .map(normalize)
            .find((candidate) => remainingTokens.has(candidate));

        if (!matchedDistrict) {
            continue;
        }

        district = districtKey;
        remainingTokens.delete(matchedDistrict);

        const matchedNeighborhood = districtValue.neighborhoods.find((item) =>
            [item.value, item.label]
                .map(normalize)
                .some((candidate) => remainingTokens.has(candidate))
        );

        if (matchedNeighborhood) {
            neighborhood = matchedNeighborhood.value;
            for (const candidate of [matchedNeighborhood.value, matchedNeighborhood.label].map(
                normalize
            )) {
                remainingTokens.delete(candidate);
            }
        }

        break;
    }

    return {
        district,
        neighborhood,
        extraAddress: Array.from(remainingTokens.values()).join(", "),
    };
}

export type ResolvedPickerLocation = {
    countryKey: string;
    cityKey: string;
    districtKey: string;
    neighborhoodValue: string;
    extraAddress: string;
};

/**
 * Resolve a picker selection (administrative fields + free-text displayName)
 * to dropdown keys. Falls back to scanning displayName tokens when the
 * administrative payload is sparse, so that map pins always have a chance
 * to populate the country/city/district/neighborhood dropdowns.
 */
export function resolvePickerLocation(
    locationTree: LocationTreeByCountry,
    administrative: {
        country?: string | null;
        countryCode?: string | null;
        city?: string | null;
        district?: string | null;
        neighborhood?: string | null;
        extraAddress?: string | null;
    },
    displayName: string
): ResolvedPickerLocation {
    const tokens = (displayName || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    const findCountryFromTokens = () => {
        for (let index = tokens.length - 1; index >= 0; index -= 1) {
            const key = findCountryKeyByLabel(locationTree, tokens[index]);
            if (key) {
                return key;
            }
        }
        return "";
    };

    const countryKey =
        findCountryKeyByLabel(locationTree, administrative.country || "") ||
        findCountryKeyByLabel(locationTree, administrative.countryCode || "") ||
        findCountryFromTokens();

    if (!countryKey) {
        return {
            countryKey: "",
            cityKey: "",
            districtKey: "",
            neighborhoodValue: "",
            extraAddress: administrative.extraAddress || "",
        };
    }

    const findCityFromTokens = () => {
        for (const token of tokens) {
            const key = findCityKeyByLabel(locationTree, countryKey, token);
            if (key) {
                return key;
            }
        }
        return "";
    };

    const cityKey =
        findCityKeyByLabel(locationTree, countryKey, administrative.city || "") ||
        findCityFromTokens();

    if (!cityKey) {
        return {
            countryKey,
            cityKey: "",
            districtKey: "",
            neighborhoodValue: "",
            extraAddress: administrative.extraAddress || "",
        };
    }

    const findDistrictFromTokens = () => {
        for (const token of tokens) {
            const key = findDistrictKeyByLabel(locationTree, countryKey, cityKey, token);
            if (key) {
                return key;
            }
        }
        return "";
    };

    const districtKey =
        findDistrictKeyByLabel(
            locationTree,
            countryKey,
            cityKey,
            administrative.district || ""
        ) || findDistrictFromTokens();

    const neighborhoods =
        locationTree[countryKey]?.cities[cityKey]?.districts[districtKey]?.neighborhoods ||
        [];

    const findNeighborhoodFromTokens = () => {
        for (const token of tokens) {
            const value = findNeighborhoodValueByLabel(neighborhoods, token);
            if (value) {
                return value;
            }
        }
        return "";
    };

    const neighborhoodValue =
        findNeighborhoodValueByLabel(neighborhoods, administrative.neighborhood || "") ||
        findNeighborhoodFromTokens();

    return {
        countryKey,
        cityKey,
        districtKey,
        neighborhoodValue,
        extraAddress: administrative.extraAddress || "",
    };
}

