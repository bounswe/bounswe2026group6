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
