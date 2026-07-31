export const US_STATE_OPTIONS = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['DC', 'District of Columbia'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
] as const;

const STATE_CODE_BY_NAME = new Map(US_STATE_OPTIONS.map(([code, name]) => [name.toLowerCase(), code]));
const STATE_CODES = new Set<string>(US_STATE_OPTIONS.map(([code]) => code));

export const isUsPostalCode = (value: string) => /^\d{5}(?:-\d{4})?$/.test(value.trim());

export const normalizeUsState = (value: string) => {
  const normalized = value.trim();
  const upper = normalized.toUpperCase();
  if (STATE_CODES.has(upper)) return upper;
  return STATE_CODE_BY_NAME.get(normalized.toLowerCase()) || '';
};

export type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  long_name?: string;
  short_name?: string;
  types?: string[];
};

export type UsAddressParts = {
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  hasStreetNumber: boolean;
  isComplete: boolean;
};

const componentValue = (components: GoogleAddressComponent[], preferred: 'long' | 'short', ...types: string[]) => {
  const match = components.find(entry => types.some(type => entry.types?.includes(type)));
  if (!match) return '';
  return preferred === 'short'
    ? match.shortText || match.short_name || match.longText || match.long_name || ''
    : match.longText || match.long_name || match.shortText || match.short_name || '';
};

const leadingStreetNumber = (value: string) =>
  value.match(/^\s*(\d+[A-Za-z]?(?:\s*[-/]\s*\d+[A-Za-z]?)?)(?:\s|$)/)?.[1] || '';

export function parseGoogleUsAddress(
  components: GoogleAddressComponent[],
  formattedAddress = '',
  typedValue = '',
): UsAddressParts {
  const formattedStreet = formattedAddress.split(',')[0]?.trim() || '';
  const streetNumber =
    componentValue(components, 'long', 'street_number') ||
    leadingStreetNumber(formattedStreet) ||
    leadingStreetNumber(typedValue);
  const route = componentValue(components, 'long', 'route');
  const streetAddress = route
    ? [streetNumber, route].filter(Boolean).join(' ').trim()
    : formattedStreet || typedValue.trim();
  const addressLine2 = componentValue(components, 'long', 'subpremise');
  const city = componentValue(
    components,
    'long',
    'locality',
    'postal_town',
    'sublocality_level_1',
    'administrative_area_level_3',
  );
  const state = normalizeUsState(componentValue(components, 'short', 'administrative_area_level_1'));
  const postalCodeBase = componentValue(components, 'long', 'postal_code');
  const postalCodeSuffix = componentValue(components, 'long', 'postal_code_suffix');
  const postalCode = postalCodeBase && postalCodeSuffix ? `${postalCodeBase}-${postalCodeSuffix}` : postalCodeBase;
  const country = componentValue(components, 'short', 'country');
  const hasStreetNumber = Boolean(streetNumber);

  return {
    streetAddress,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    hasStreetNumber,
    isComplete:
      hasStreetNumber &&
      Boolean(route && city && state && isUsPostalCode(postalCode)) &&
      (!country || country.toUpperCase() === 'US'),
  };
}
