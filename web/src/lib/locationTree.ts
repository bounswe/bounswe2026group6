import { LocationTreeCountry, LocationTreeNeighborhood } from "@/types/location";

export type LocationTreeByCountry = Record<string, LocationTreeCountry>;

function normalize(value: string) {
    return value
        .toLocaleLowerCase("tr")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

export function findCountryKeyByLabel(
    locationTree: LocationTreeByCountry,
    label: string
) {
    if (!label.trim()) {
        return "";
    }

    return (
        Object.entries(locationTree).find(([, country]) => country.label === label)?.[0] ||
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

    return (
        Object.entries(country.cities).find(([, city]) => city.label === label)?.[0] ||
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

    return (
        Object.entries(districts).find(([, district]) => district.label === label)?.[0] ||
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

    return (
        neighborhoods.find((item) => item.label === label || item.value === label)?.value ||
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
