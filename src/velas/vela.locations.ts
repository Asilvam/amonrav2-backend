export const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT",
  "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI",
  "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY",
  "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM",
  "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK",
  "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL",
  "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR",
  "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN",
  "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS",
  "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW",
  "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP",
  "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM",
  "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM",
  "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF",
  "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW",
  "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

const countryNamesEs = new Intl.DisplayNames(["es"], { type: "region" });
const countryNamesEn = new Intl.DisplayNames(["en"], { type: "region" });

export interface VelaCountry {
  code: string;
  name: { es: string; en: string };
}

export function listVelaCountries(): VelaCountry[] {
  return COUNTRY_CODES.map((code) => ({
    code,
    name: {
      es: countryNamesEs.of(code) ?? code,
      en: countryNamesEn.of(code) ?? code,
    },
  })).sort((left, right) => left.name.es.localeCompare(right.name.es, "es"));
}

export interface GeoNameCity {
  geonameId: number;
  name: string;
  adminName1?: string;
  countryCode: string;
}

interface GeoNamesResponse {
  geonames?: GeoNameCity[];
  geonameId?: number;
  countryCode?: string;
  name?: string;
  adminName1?: string;
  status?: { message?: string; value?: number };
}

export interface CityOption {
  id: string;
  name: string;
  region?: string;
}

class GeoNamesRecordNotFoundError extends Error {}

const cache = new Map<string, { expiresAt: number; value: CityOption[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 250;

function getGeoNamesUsername(): string {
  const username = process.env.GEONAMES_USERNAME?.trim();
  if (!username) throw new Error("GEONAMES_USERNAME is not configured.");
  return username;
}

async function requestGeoNames<T extends GeoNamesResponse>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`https://secure.geonames.org/${path}`);
  url.search = new URLSearchParams({
    ...params,
    username: getGeoNamesUsername(),
    type: "json",
  }).toString();

  const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error(`GeoNames returned HTTP ${response.status}.`);

  const body = (await response.json()) as T;
  if (body.status) {
    if (body.status.value === 15) {
      throw new GeoNamesRecordNotFoundError(
        body.status.message ?? "GeoNames record was not found.",
      );
    }
    throw new Error(body.status.message ?? "GeoNames request failed.");
  }
  return body;
}

export async function findVelaCities(
  country: string,
  query: string,
): Promise<CityOption[]> {
  const normalizedCountry = country.toUpperCase();
  const normalizedQuery = query.trim();
  const cacheKey = `${normalizedCountry}:${normalizedQuery.toLocaleLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const result = await requestGeoNames<GeoNamesResponse>("searchJSON", {
    country: normalizedCountry,
    q: normalizedQuery,
    featureClass: "P",
    maxRows: "12",
    orderby: "population",
  });
  const cities = (result.geonames ?? [])
    .filter((city) => city.countryCode === normalizedCountry)
    .map((city) => ({
      id: String(city.geonameId),
      name: city.name,
      ...(city.adminName1 ? { region: city.adminName1 } : {}),
    }));

  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: cities });
  return cities;
}

export async function findVelaCity(
  id: string,
): Promise<GeoNameCity | null> {
  let result: GeoNamesResponse;
  try {
    result = await requestGeoNames<GeoNamesResponse>("getJSON", {
      geonameId: id,
    });
  } catch (error) {
    if (error instanceof GeoNamesRecordNotFoundError) return null;
    throw error;
  }
  if (
    typeof result.geonameId !== "number" ||
    typeof result.name !== "string" ||
    typeof result.countryCode !== "string"
  ) {
    return null;
  }
  return {
    geonameId: result.geonameId,
    name: result.name,
    countryCode: result.countryCode,
    ...(result.adminName1 ? { adminName1: result.adminName1 } : {}),
  };
}
