# Production deployment

CivicHelp has a static frontend and a Node.js API. The frontend uses browser geolocation, so serve it over HTTPS (GitHub Pages does this automatically). The backend must also have a public HTTPS URL.

## GitHub Pages frontend

1. Deploy the repository's static files to GitHub Pages; there is no frontend build step.
2. Set the `civichelp-api-base` meta tag in `index.html` to the backend's HTTPS origin, without a trailing slash:

   ```html
   <meta name="civichelp-api-base" content="https://api.example.org" />
   ```

3. Do not put credentials or secrets in frontend files. Production configuration always uses live API mode and rejects non-HTTPS API URLs.

The empty value in the checked-in file deliberately fails closed: until configured, geo/weather requests show an API configuration error rather than calling the Pages origin or displaying mock data. Local development on `localhost` uses `http://localhost:4000`.

## Node.js backend

Run `npm ci` and `npm start` on a Node.js 18+ host. The host should terminate TLS and forward HTTPS requests to the app's `PORT` (default `4000`).

Configure:

- `PORT`: supplied by most hosting platforms; optional locally.
- `CORS_ORIGINS`: comma-separated, exact frontend origins, with no paths or trailing slashes. For a project hosted at `https://owner.github.io/repository/`, use `https://owner.github.io`. Set a custom Pages domain's origin instead when applicable. Do not use `*`.
- `DATABASE_URL`: optional PostgreSQL connection string. Geo search, reverse geocoding, and weather do not require a database. Without it, live updates are empty and event lookup is unavailable.

Example backend environment:

```text
PORT=4000
CORS_ORIGINS=https://owner.github.io
DATABASE_URL=
```

Never commit a real database URL. No API keys are required by the current OpenStreetMap, Photon, or Open-Meteo integrations. Check provider terms and availability before production launch.

## Production smoke checks

- Open the HTTPS Pages URL and verify its configured API URL uses HTTPS.
- Confirm the backend permits only the deployed frontend origin and responds to `/api/location/resolve`, `/api/facilities`, and `/api/weather`.
- Test location with a real mobile browser. Do not substitute coordinates: browser geolocation requires HTTPS and explicit permission.
- Verify `CivicHelp` location requests use the device's coordinates, that a failed GPS lookup leaves nearby places/weather empty, and that the browser's Network panel shows the API and provider requests.
