# Google Maps address autocomplete

Dealivra uses Google Places Autocomplete Data API for U.S. street-address
suggestions in meeting and shipping workflows. The native address input always
remains usable: if Google is unavailable, users can enter the street, city,
state, ZIP code, and apartment/suite/unit manually.

## Google Cloud configuration

1. Select the dedicated Dealivra Google Cloud project and confirm billing.
2. Enable:
   - Maps JavaScript API
   - Places API (New)
3. Create a browser API key dedicated to Dealivra address autocomplete.
4. Set **Application restrictions** to **Websites** and allow only reviewed
   origins, for example:
   - `https://dealivra.com/*`
   - `https://dealsafe-mvp-nika13.vercel.app/*` while that protected migration
     alias remains in use
   - reviewed Vercel Preview hosts used for acceptance testing
   - `http://localhost:5173/*` only when local development needs live
     suggestions
5. Set **API restrictions** to:
   - Maps JavaScript API
   - Places API (New)
6. Keep quota and billing alerts enabled. Do not use an unrestricted key.

## Vercel configuration

1. Open the Dealivra project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add `VITE_GOOGLE_MAPS_API_KEY` using the restricted browser key.
4. Select only the environments whose allowed origins are present on the key.
5. Save and redeploy; changing an environment variable does not update an
   already-built deployment.

Never commit the API key or paste it into documentation, issue comments,
screenshots, or pull-request logs.

## Acceptance check

On both the meeting and shipping forms:

1. Enter at least three characters of a U.S. street address.
2. Confirm suggestions appear and can be selected with the mouse or
   `ArrowUp`/`ArrowDown` and `Enter`.
3. Confirm selection fills street, city, two-letter state, and ZIP/ZIP+4.
4. If Google returns a `subpremise`, confirm it fills **Address line 2**.
5. Confirm Address line 2 remains editable for apartment, suite, unit,
   building, floor, or mailbox information.
6. Temporarily block Google Maps and confirm manual entry still works.

If suggestions do not appear but manual entry works, check the browser console
and Google Cloud metrics for an origin restriction, disabled Places API (New),
quota, or billing error. Do not weaken key restrictions as a workaround.
