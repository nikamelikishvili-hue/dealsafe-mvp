import { LoaderCircle, MapPin, Search, X } from 'lucide-react';
import { type ChangeEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { parseGoogleUsAddress, type UsAddressParts } from './usAddress';
import { reportClientFailure } from './services/clientFailureReporter';

type PlaceResult = {
  displayName?: string;
  formattedAddress?: string;
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

type PlacePrediction = {
  mainText?: { text?: string };
  secondaryText?: { text?: string };
  text?: { text?: string };
  toPlace: () => PlaceResult;
};

type AutocompleteSuggestion = {
  placePrediction?: PlacePrediction;
};

type AutocompleteRequest = {
  input: string;
  includedPrimaryTypes?: string[];
  includedRegionCodes?: string[];
  language?: string;
  region?: string;
  sessionToken?: unknown;
};

type PlaceLibrary = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: AutocompleteRequest) => Promise<{ suggestions: AutocompleteSuggestion[] }>;
  };
};

type GoogleMapsApi = {
  maps: { importLibrary: (library: string) => Promise<PlaceLibrary> };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __dealivraGoogleMapsReady?: () => void;
  }
}

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-dealivra-google-maps]');
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Google Maps did not load'));
    }, 12_000);
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.google?.maps?.importLibrary
        ? resolve()
        : reject(new Error('Google Maps did not load'));
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(new Error('Google Maps did not load'));
    };

    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      existing.addEventListener('error', fail, { once: true });
      window.setTimeout(() => {
        if (window.google?.maps?.importLibrary) finish();
      }, 0);
      return;
    }

    window.__dealivraGoogleMapsReady = () => {
      resolve();
      delete window.__dealivraGoogleMapsReady;
    };

    const script = document.createElement('script');
    script.dataset.dealivraGoogleMaps = 'true';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      loading: 'async',
      libraries: 'places',
      language: 'en',
      region: 'US',
      callback: '__dealivraGoogleMapsReady',
    })}`;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => {
    mapsLoader = null;
    throw error;
  });

  return mapsLoader;
}

export type AddressParts = Pick<
  UsAddressParts,
  'streetAddress' | 'addressLine2' | 'city' | 'state' | 'postalCode' | 'country'
>;

type QueryState = 'idle' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'failed';

export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  onAddressParts,
  streetAddressOnly = false,
  inputId,
  invalid = false,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onAddressParts?: (parts: AddressParts) => void;
  streetAddressOnly?: boolean;
  inputId?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);
  const selectionMutationRef = useRef(false);
  const sessionTokenRef = useRef<unknown>(null);
  const libraryRef = useRef<PlaceLibrary | null>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [queryState, setQueryState] = useState<QueryState>(apiKey ? 'idle' : 'unavailable');
  const [selectionMessage, setSelectionMessage] = useState('');

  useEffect(() => {
    if (!apiKey) return;
    let active = true;
    loadGoogleMaps(apiKey)
      .then(() => window.google?.maps.importLibrary('places'))
      .then(library => {
        if (!active || !library) return;
        libraryRef.current = library;
        sessionTokenRef.current = new library.AutocompleteSessionToken();
        setQueryState('idle');
      })
      .catch(() => {
        if (active) {
          setQueryState('failed');
          reportClientFailure({
            schema: 'dealivra.client-failure.v1',
            boundary: 'address_autocomplete',
            issue: 'provider_load_failed',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [apiKey]);

  useEffect(() => {
    const library = libraryRef.current;
    const query = value.trim();
    if (!library) return;
    if (query.length < 3 || !focused) {
      requestSequence.current += 1;
      setSuggestions([]);
      setActiveIndex(-1);
      setQueryState('idle');
      return;
    }

    const currentRequest = ++requestSequence.current;
    setQueryState('loading');
    const timer = window.setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new library.AutocompleteSessionToken();
        }
        const { suggestions: nextSuggestions } = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['us'],
          includedPrimaryTypes: streetAddressOnly ? ['street_address'] : undefined,
          language: 'en',
          region: 'us',
          sessionToken: sessionTokenRef.current,
        });
        if (currentRequest !== requestSequence.current) return;
        const predictions = nextSuggestions
          .map(suggestion => suggestion.placePrediction)
          .filter((prediction): prediction is PlacePrediction => Boolean(prediction));
        setSuggestions(predictions);
        setActiveIndex(predictions.length ? 0 : -1);
        setQueryState(predictions.length ? 'ready' : 'empty');
      } catch {
        if (currentRequest !== requestSequence.current) return;
        setSuggestions([]);
        setActiveIndex(-1);
        setQueryState('failed');
        reportClientFailure({
          schema: 'dealivra.client-failure.v1',
          boundary: 'address_autocomplete',
          issue: 'suggestion_request_failed',
        });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [focused, streetAddressOnly, value]);

  const selectPrediction = async (prediction: PlacePrediction) => {
    const library = libraryRef.current;
    if (!library || selectionMutationRef.current) return;
    selectionMutationRef.current = true;
    const selectionRequest = ++requestSequence.current;
    setQueryState('loading');
    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'addressComponents'],
      });
      if (selectionRequest !== requestSequence.current) return;
      const parsed = parseGoogleUsAddress(
        place.addressComponents || [],
        place.formattedAddress || place.displayName || '',
        value,
      );
      if (!parsed.streetAddress) throw new Error('Missing street address');
      onChange(parsed.streetAddress);
      onAddressParts?.(parsed);
      setSuggestions([]);
      setActiveIndex(-1);
      setFocused(false);
      setQueryState('idle');
      setSelectionMessage(
        parsed.isComplete
          ? 'Address selected. City, state, and ZIP code were filled in.'
          : 'Address selected. Review the city, state, and ZIP code.',
      );
      sessionTokenRef.current = new library.AutocompleteSessionToken();
    } catch {
      if (selectionRequest !== requestSequence.current) return;
      setQueryState('failed');
      setSelectionMessage('We could not read that suggestion. Enter the address manually.');
      reportClientFailure({
        schema: 'dealivra.client-failure.v1',
        boundary: 'address_autocomplete',
        issue: 'place_details_failed',
      });
    } finally {
      selectionMutationRef.current = false;
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    requestSequence.current += 1;
    onChange(event.target.value);
    setSelectionMessage('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) {
      if (event.key === 'Escape') setFocused(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(current => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(current => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      void selectPrediction(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSuggestions([]);
      setActiveIndex(-1);
      setFocused(false);
    }
  };

  const statusMessage =
    queryState === 'loading'
      ? 'Searching U.S. addresses…'
      : queryState === 'empty'
        ? 'No exact match found. You can continue entering the address manually.'
        : queryState === 'unavailable'
          ? 'Automatic suggestions are not configured. Enter the complete address manually.'
        : queryState === 'failed'
          ? 'Automatic suggestions are temporarily unavailable. Enter the complete address manually.'
          : selectionMessage;

  return (
    <div className="address-autocomplete">
      <div className="address-autocomplete-control">
        <Search aria-hidden="true" size={19} />
        <input
          id={inputId}
          ref={inputRef}
          required
          role="combobox"
          aria-label={placeholder}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={listboxId}
          aria-describedby={[describedBy, statusId].filter(Boolean).join(' ')}
          aria-invalid={invalid || undefined}
          aria-busy={queryState === 'loading'}
          aria-expanded={focused && suggestions.length > 0}
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          autoComplete={streetAddressOnly ? 'address-line1' : 'street-address'}
          maxLength={200}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onKeyDown={handleKeyDown}
        />
        {queryState === 'loading' ? (
          <LoaderCircle aria-hidden="true" className="address-autocomplete-spinner" size={19} />
        ) : value ? (
          <button
            type="button"
            className="address-autocomplete-clear"
            aria-label="Clear street address"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              requestSequence.current += 1;
              onChange('');
              setSuggestions([]);
              setActiveIndex(-1);
              setSelectionMessage('');
              window.requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <X aria-hidden="true" size={18} />
          </button>
        ) : null}
      </div>

      {focused && suggestions.length > 0 && (
        <div
          id={listboxId}
          className="address-autocomplete-menu"
          role="listbox"
          aria-label="U.S. street address suggestions"
        >
          {suggestions.map((prediction, index) => {
            const main = prediction.mainText?.text || prediction.text?.text || 'Address suggestion';
            const secondary = prediction.secondaryText?.text || '';
            return (
              <button
                key={`${main}-${secondary}-${index}`}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={activeIndex === index ? 'address-autocomplete-option active' : 'address-autocomplete-option'}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => void selectPrediction(prediction)}
              >
                <MapPin aria-hidden="true" size={18} />
                <span>
                  <strong>{main}</strong>
                  {secondary && <small>{secondary}</small>}
                </span>
              </button>
            );
          })}
          <div className="address-autocomplete-attribution">
            <span aria-hidden="true">G</span> Google Maps
          </div>
        </div>
      )}

      <small
        id={statusId}
        className={
          queryState === 'failed' || queryState === 'unavailable'
            ? 'address-autocomplete-status warning'
            : 'address-autocomplete-status'
        }
        role={queryState === 'failed' ? 'alert' : 'status'}
        aria-live={queryState === 'failed' ? 'assertive' : 'polite'}
      >
        {statusMessage}
      </small>
    </div>
  );
}
