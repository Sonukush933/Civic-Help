const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const PROJECT_ROOT = __dirname;
const CORS_ORIGINS = new Set(String(process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean));

const pgPool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

const EMERGENCY = [
  { number: '112', label: 'Emergency response', description: 'All emergencies, India-wide', icon: 'alert', tone: 't-r' },
  { number: '108', label: 'Ambulance / medical', description: 'Free emergency ambulance', icon: 'hosp', tone: 't-r' },
  { number: '100', label: 'Police', description: 'Report a crime or danger', icon: 'shield', tone: 't-g' },
  { number: '101', label: 'Fire', description: 'Fire and rescue', icon: 'bolt', tone: 't-a' },
  { number: '1091', label: 'Women helpline', description: '24-hour support', icon: 'user', tone: 't-g' },
  { number: '1098', label: 'Childline', description: 'Help for children', icon: 'user', tone: 't-g' },
  { number: '15100', label: 'Legal helpline', description: 'National Legal Services Authority', icon: 'scale', tone: 't-g' },
];

const WEATHER_CODES = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Heavy freezing drizzle', 61: 'Slight rain', 63: 'Moderate rain',
  65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow',
  73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers',
  81: 'Heavy showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm',
};

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`Upstream returned HTTP ${response.status}`);
      error.status = response.status;
      error.responseBody = text.slice(0, 500);
      throw error;
    }
    try {
      return text ? JSON.parse(text) : null;
    } catch (error) {
      error.message = `Upstream returned invalid JSON: ${error.message}`;
      throw error;
    }
  } catch (error) {
    const target = new URL(url);
    let responseBody = error.responseBody || null;
    if (responseBody) {
      for (const key of ['latitude', 'longitude', 'lat', 'lon']) {
        const coordinate = target.searchParams.get(key);
        if (coordinate) responseBody = responseBody.split(coordinate).join('[redacted]');
      }
    }
    const category = error.status
      ? 'http'
      : controller.signal.aborted
        ? 'timeout'
        : error.message.startsWith('Upstream returned invalid JSON')
          ? 'invalid-json'
          : error.cause
            ? 'network'
            : 'upstream-error';
    console.error('Upstream JSON request failed:', JSON.stringify({
      provider: target.hostname,
      endpoint: target.pathname,
      category,
      status: error.status || null,
      responseBody,
      timeout: controller.signal.aborted,
      error: controller.signal.aborted ? 'request timed out after 12000ms' : `${error.cause && error.cause.code ? error.cause.code + ': ' : ''}${error.message}`.slice(0, 500),
    }));
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function reverseGeocodePhoton(lat, lng) {
  const payload = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`);
  const feature = Array.isArray(payload && payload.features) ? payload.features[0] : null;
  const props = (feature && feature.properties) || {};
  const city = props.city || props.town || props.village || props.county || '';
  const area = props.suburb || props.locality || props.district || props.street || props.neighbourhood || '';
  return {
    city: city || '',
    area,
    state: props.state || '',
    country: props.country || '',
    display_name: props.name || [city, props.state, props.country].filter(Boolean).join(', '),
  };
}

async function reverseGeocode(lat, lng) {
  try {
    const payload = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`, {
      headers: { 'User-Agent': 'CivicHelp/1.0' },
    });
    const address = payload.address || {};
    return {
      city: address.city || address.town || address.village || address.municipality || address.county || '',
      area: address.suburb || address.neighbourhood || address.city_district || address.road || address.hamlet || '',
      state: address.state || '',
      country: address.country || '',
      display_name: payload.display_name || '',
    };
  } catch (error) {
    console.warn('Nominatim reverse geocode failed, using Photon fallback:', error.message);
    return reverseGeocodePhoton(lat, lng);
  }
}

function facilityCategoryFromTags(tags = {}) {
  const amenity = String(tags.amenity || '').toLowerCase();
  const shop = String(tags.shop || '').toLowerCase();
  if (['drinking_water', 'water_point'].includes(amenity) || tags.drinking_water === 'yes') return 'water';
  if (['toilets', 'toilet', 'sanitary_dump_station'].includes(amenity)) return 'toilet';
  if (['clinic', 'hospital', 'doctors', 'health', 'dentist'].includes(amenity) || ['hospital', 'clinic', 'doctor', 'dentist'].includes(String(tags.healthcare || '').toLowerCase())) return 'hospital';
  if (amenity === 'pharmacy' || shop === 'chemist') return 'pharmacy';
  if (amenity === 'charging_station') return 'charging';
  if (['restaurant', 'cafe', 'food_court', 'fast_food', 'bar', 'pub'].includes(amenity) || ['supermarket', 'bakery', 'convenience'].includes(shop)) return 'food';
  if (amenity === 'police') return 'police';
  if (['shelter', 'social_facility'].includes(amenity) || tags.shelter === 'yes') return 'shelter';
  if (amenity === 'community_centre') return 'food';
  if (amenity === 'legal_service' || String(tags.office || '').toLowerCase() === 'lawyer' || /legal/.test(String(tags.name || ''))) return 'legal';
  return null;
}

async function findNearbyFacilitiesByPhoton({ lat, lng, radius = 5000, category = 'all' }) {
  const queries = {
    water: 'drinking water',
    toilet: 'public toilet',
    hospital: 'hospital',
    pharmacy: 'pharmacy',
    charging: 'charging station',
    food: 'restaurant',
    police: 'police',
    legal: 'lawyer',
    shelter: 'shelter',
  };
  const selectedCategories = category === 'all' ? Object.keys(queries) : [category];
  const responses = await Promise.allSettled(selectedCategories.map((cat) => {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(queries[cat])}&lat=${lat}&lon=${lng}&limit=100`;
    return fetchJson(url);
  }));
  if (responses.every((response) => response.status === 'rejected')) {
    throw new Error('Photon nearby lookup failed for every requested category');
  }
  const results = [];
  const seen = new Set();

  for (const [index, response] of responses.entries()) {
    const cat = selectedCategories[index];
    if (response.status === 'rejected') {
      console.warn(`Photon facility lookup failed for ${cat}:`, response.reason.message);
      continue;
    }
    const features = Array.isArray(response.value && response.value.features) ? response.value.features : [];
    for (const feature of features) {
      const coords = feature && feature.geometry && feature.geometry.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const itemLat = Number(coords[1]);
      const itemLng = Number(coords[0]);
      if (!Number.isFinite(itemLat) || itemLat < -90 || itemLat > 90 || !Number.isFinite(itemLng) || itemLng < -180 || itemLng > 180) continue;
      const distanceMetres = Math.round(haversineKm(lat, lng, itemLat, itemLng) * 1000);
      if (distanceMetres > radius) continue;
      const props = feature.properties || {};
      const fallbackId = `${itemLat.toFixed(6)}-${itemLng.toFixed(6)}`;
      const key = `${props.osm_type || ""}:${props.osm_id || fallbackId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        id: `osm-${props.osm_type || "feature"}-${props.osm_id || fallbackId}`,
        category: cat,
        name: props.name || '',
        distance_m: distanceMetres,
        status_label: '',
        latitude: itemLat,
        longitude: itemLng,
        address: [props.housenumber, props.street, props.locality, props.city].filter(Boolean).join(', '),
        phone: '',
        website: '',
        source: 'OpenStreetMap (Photon)',
        is_demo: false,
      });
    }
  }
  return results.sort((a, b) => a.distance_m - b.distance_m).slice(0, 100);
}

async function queryOverpassFacilities({ lat, lng, radius, category }) {
  const query = `
    [out:json][timeout:25];
    (
      nwr["amenity"~"^(drinking_water|water_point|toilets|hospital|clinic|pharmacy|charging_station|restaurant|cafe|community_centre|legal_service|police|shelter|social_facility)$"](around:${radius},${lat},${lng});
      nwr["healthcare"~"^(hospital|clinic|doctor|dentist)$"](around:${radius},${lat},${lng});
      nwr["shop"~"^(chemist|supermarket|bakery|convenience)$"](around:${radius},${lat},${lng});
      nwr["office"="lawyer"](around:${radius},${lat},${lng});
      nwr["drinking_water"="yes"](around:${radius},${lat},${lng});
      nwr["shelter"="yes"](around:${radius},${lat},${lng});
    );
    out center tags 100;
  `;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query), {
      headers: { Accept: 'application/json', 'User-Agent': 'CivicHelp/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass request failed with ${response.status}`);
    const data = await response.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];
    return elements.map((entry) => {
      const tags = entry.tags || {};
      const foundCategory = facilityCategoryFromTags(tags);
      if (!foundCategory || (category !== 'all' && foundCategory !== category)) return null;
      const itemLat = Number(entry.lat ?? (entry.center && entry.center.lat));
      const itemLng = Number(entry.lon ?? (entry.center && entry.center.lon));
      if (!Number.isFinite(itemLat) || itemLat < -90 || itemLat > 90 || !Number.isFinite(itemLng) || itemLng < -180 || itemLng > 180) return null;
      const distanceMetres = Math.round(haversineKm(lat, lng, itemLat, itemLng) * 1000);
      if (distanceMetres > radius) return null;
      return {
        id: `osm-${entry.type}-${entry.id}`,
        category: foundCategory,
        name: tags['name:en'] || tags.name || '',
        distance_m: distanceMetres,
        status_label: tags.opening_hours || tags.open || '',
        latitude: itemLat,
        longitude: itemLng,
        address: [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
        phone: tags.phone || tags['contact:phone'] || '',
        website: tags.website || tags['contact:website'] || '',
        accessible: tags.wheelchair === 'yes',
        source: 'OpenStreetMap (Overpass)',
        is_demo: false,
      };
    }).filter(Boolean).sort((a, b) => a.distance_m - b.distance_m).slice(0, 100);
  } finally {
    clearTimeout(timeout);
  }
}

async function findNearbyFacilities({ lat, lng, category = 'all' }) {
  const initialRadius = 5000;
  const expandedRadius = 10000;
  const minimumResults = 10;
  try {
    const initial = await queryOverpassFacilities({ lat, lng, radius: initialRadius, category });
    if (initial.length >= minimumResults) return initial.map((place) => ({ ...place, search_radius_m: initialRadius }));
    try {
      const expanded = await queryOverpassFacilities({ lat, lng, radius: expandedRadius, category });
      return expanded.map((place) => ({ ...place, search_radius_m: expandedRadius }));
    } catch (error) {
      console.warn('Overpass 10 km expansion failed; returning valid 5 km results:', error.message);
      return initial.map((place) => ({ ...place, search_radius_m: initialRadius }));
    }
  } catch (error) {
    console.warn('Overpass failed, falling back to Photon search:', error.message);
    const initial = await findNearbyFacilitiesByPhoton({ lat, lng, radius: initialRadius, category });
    if (initial.length >= minimumResults) return initial.map((place) => ({ ...place, search_radius_m: initialRadius }));
    const expanded = await findNearbyFacilitiesByPhoton({ lat, lng, radius: expandedRadius, category });
    return expanded.map((place) => ({ ...place, search_radius_m: expandedRadius }));
  }
}

async function getLiveWeather(lat, lng) {
  const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
  weatherUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,apparent_temperature,weather_code',
    hourly: 'precipitation_probability',
    timezone: 'auto',
  }).toString();
  const payload = await fetchJson(weatherUrl.toString());
  const current = payload.current || {};
  const hourly = payload.hourly || { time: [], precipitation_probability: [] };
  if (current.temperature_2m == null || current.weather_code == null || !current.time) {
    throw new Error('Open-Meteo returned a response without required current weather fields');
  }
  const hourIndex = Array.isArray(hourly.time)
    ? hourly.time.findIndex((time) => time.slice(0, 13) === current.time.slice(0, 13))
    : -1;
  const rainProbability = hourIndex >= 0 && hourly.precipitation_probability?.[hourIndex] != null
    ? Number(hourly.precipitation_probability[hourIndex])
    : null;
  const condition = WEATHER_CODES[current.weather_code] || 'Weather conditions available';
  return {
    temp_c: Number(current.temperature_2m ?? 0),
    feels_like_c: current.apparent_temperature == null ? null : Number(current.apparent_temperature),
    condition,
    rain_probability: rainProbability == null ? null : Math.round(rainProbability),
    updated_label: `Updated ${String(current.time).slice(11, 16)} ${payload.timezone_abbreviation || payload.timezone || ''}`.trim(),
    city: 'Live location',
  };
}

const MET_WEATHER_CODES = {
  clearsky: 'Clear sky',
  fair: 'Mostly clear',
  partlycloudy: 'Partly cloudy',
  cloudy: 'Overcast',
  fog: 'Fog',
  lightrain: 'Light rain',
  rain: 'Rain',
  heavyrain: 'Heavy rain',
  lightrainshowers: 'Light rain showers',
  rainshowers: 'Rain showers',
  heavyrainshowers: 'Heavy rain showers',
  lightrainandthunder: 'Light rain and thunder',
  rainandthunder: 'Rain and thunder',
  heavyrainandthunder: 'Heavy rain and thunder',
  lightsleet: 'Light sleet',
  sleet: 'Sleet',
  heavysleet: 'Heavy sleet',
  lightsleetshowers: 'Light sleet showers',
  sleetshowers: 'Sleet showers',
  heavysleetshowers: 'Heavy sleet showers',
  lightsnow: 'Light snow',
  snow: 'Snow',
  heavysnow: 'Heavy snow',
  lightsnowshowers: 'Light snow showers',
  snowshowers: 'Snow showers',
  heavysnowshowers: 'Heavy snow showers',
  lightsnowandthunder: 'Light snow and thunder',
  snowandthunder: 'Snow and thunder',
  heavysnowandthunder: 'Heavy snow and thunder',
};

async function getMetNorwayWeather(lat, lng) {
  const weatherUrl = new URL('https://api.met.no/weatherapi/locationforecast/2.0/compact');
  weatherUrl.search = new URLSearchParams({ lat: String(lat), lon: String(lng) }).toString();
  const payload = await fetchJson(weatherUrl.toString(), {
    headers: { 'User-Agent': 'CivicHelp/1.0 (https://github.com/Sonukush933/Civic-Help)' },
  });
  const series = payload && payload.properties && payload.properties.timeseries;
  if (!Array.isArray(series) || !series.length) {
    throw new Error('MET Norway returned no forecast timeseries');
  }
  const now = Date.now();
  const current = series.reduce((closest, entry) => {
    const entryTime = Date.parse(entry.time);
    const closestTime = Date.parse(closest.time);
    return Math.abs(entryTime - now) < Math.abs(closestTime - now) ? entry : closest;
  });
  const details = current.data && current.data.instant && current.data.instant.details;
  if (!details || !Number.isFinite(Number(details.air_temperature))) {
    throw new Error('MET Norway returned no current air temperature');
  }
  const rawSymbol = current.data.next_1_hours && current.data.next_1_hours.summary && current.data.next_1_hours.summary.symbol_code;
  const symbol = typeof rawSymbol === 'string'
    ? rawSymbol.replace(/_(day|night|polartwilight)$/, '')
    : '';
  const time = new Date(current.time);
  return {
    temp_c: Number(details.air_temperature),
    feels_like_c: null,
    condition: MET_WEATHER_CODES[symbol] || 'Current conditions available',
    rain_probability: null,
    updated_label: `MET Norway forecast ${time.toISOString().slice(11, 16)} UTC`,
    city: 'Live location',
  };
}

async function getWeatherWithFallback(lat, lng) {
  try {
    return await getLiveWeather(lat, lng);
  } catch (primaryError) {
    console.warn('Primary live weather provider failed; trying fallback:', JSON.stringify({
      provider: 'api.open-meteo.com',
      endpoint: '/v1/forecast',
      category: primaryError.status ? 'http' : primaryError.name === 'AbortError' ? 'timeout' : primaryError.cause ? 'network' : 'upstream-error',
      status: primaryError.status || null,
    }));
    try {
      return await getMetNorwayWeather(lat, lng);
    } catch (fallbackError) {
      console.error('All live weather providers failed:', JSON.stringify({
        primaryProvider: 'api.open-meteo.com',
        primaryEndpoint: '/v1/forecast',
        fallbackProvider: 'api.met.no',
        fallbackEndpoint: '/weatherapi/locationforecast/2.0/compact',
        fallbackCategory: fallbackError.status ? 'http' : fallbackError.name === 'AbortError' ? 'timeout' : fallbackError.cause ? 'network' : 'upstream-error',
        fallbackStatus: fallbackError.status || null,
        fallbackError: fallbackError.message.slice(0, 300),
      }));
      throw new Error('All live weather providers failed');
    }
  }
}

async function ensureDb() {
  if (!pgPool) return null;
  try {
    await pgPool.query('SELECT 1');
    return pgPool;
  } catch (error) {
    console.warn('PostgreSQL unavailable. Database-backed event and update data will be unavailable.');
    return null;
  }
}

async function initializeSchema() {
  if (!pgPool) return;

  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS civic_events (
        id SERIAL PRIMARY KEY,
        city TEXT NOT NULL,
        area TEXT,
        is_demo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS civic_updates (
        id SERIAL PRIMARY KEY,
        city TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        source_name TEXT,
        source_url TEXT,
        published_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ,
        verification_reason TEXT
      );
    `);
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS civic_emergency (
        id SERIAL PRIMARY KEY,
        number TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        icon TEXT,
        tone TEXT
      );
    `);

  } catch (error) {
    console.warn('Database schema setup failed:', error.message);
  }
}

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (!origin) return next();
  let sameHost = false;
  try {
    sameHost = new URL(origin).host.toLowerCase() === String(req.get('host') || '').toLowerCase();
  } catch (error) {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  if (!sameHost && !CORS_ORIGINS.has(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed.' });
  }
  if (!sameHost) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/api/location/resolve', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Latitude and longitude are required.' });
  }
  try {
    const resolved = await reverseGeocode(lat, lng);
    return res.json({ data: resolved });
  } catch (error) {
    console.warn('Reverse geocoding failed:', error.message);
    return res.status(502).json({ error: 'Location lookup failed' });
  }
});

app.get('/api/events', async (req, res) => {
  const city = String(req.query.city || '').trim();
  if (!city) return res.status(400).json({ error: 'A city is required.' });
  if (!pgPool) return res.status(503).json({ error: 'No live event data source is configured.' });
  try {
    const known = await pgPool.query('SELECT * FROM civic_events WHERE city = $1 AND is_demo = false ORDER BY created_at DESC LIMIT 1', [city]);
    if (known.rows.length) return res.json({ data: known.rows[0] });
  } catch (error) {
    console.warn('DB read failed for events:', error.message);
    return res.status(503).json({ error: 'Live event data is unavailable.' });
  }
  return res.status(404).json({ error: 'No live event is available for this city.' });
});

app.get('/api/facilities', async (req, res) => {
  const city = String(req.query.city || '').trim();
  const category = req.query.category || 'all';
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = req.query.radius == null || req.query.radius === '' ? 5000 : Number(req.query.radius);
  const categories = ['all', 'water', 'toilet', 'hospital', 'pharmacy', 'charging', 'food', 'police', 'legal', 'shelter'];

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid device latitude and longitude are required for nearby search.' });
  }
  if (!categories.includes(category)) {
    return res.status(400).json({ error: 'Unsupported nearby place category.' });
  }
  if (!Number.isFinite(radius) || radius !== 5000) {
    return res.status(400).json({ error: 'Nearby search starts at 5000 metres and expands to 10000 metres when results are insufficient.' });
  }
  try {
    const places = await findNearbyFacilities({ lat, lng, category });
    return res.json({ data: places.map((place) => ({ ...place, city })) });
  } catch (error) {
    console.warn('Live facility lookup failed:', error.message);
    return res.status(502).json({ error: 'Nearby facility search failed' });
  }
});

app.get('/api/facilities/:id', async (req, res) => {
  return res.status(404).json({ error: 'Facility details are available from the current live nearby search only.' });
});

app.get('/api/updates', async (req, res) => {
  const city = String(req.query.city || '').trim();
  if (!city) return res.status(400).json({ error: 'A city is required.' });
  if (pgPool) {
    try {
      const rows = await pgPool.query('SELECT * FROM civic_updates WHERE city = $1 ORDER BY published_at DESC', [city]);
      if (rows.rowCount) return res.json({ data: rows.rows });
    } catch (error) {
      console.warn('DB read failed for updates:', error.message);
      return res.status(503).json({ error: 'Live updates are unavailable.' });
    }
  }

  return res.json({ data: [] });
});

app.get('/api/emergency', async (req, res) => {
  if (pgPool) {
    try {
      const rows = await pgPool.query('SELECT * FROM civic_emergency ORDER BY id ASC');
      if (rows.rowCount) return res.json({ data: rows.rows });
    } catch (error) {
      console.warn('DB read failed for emergency numbers:', error.message);
    }
  }

  return res.json({ data: EMERGENCY });
});

app.get('/api/weather', async (req, res) => {
  const lat = typeof req.query.lat === 'string' && req.query.lat.trim() ? Number(req.query.lat) : NaN;
  const lng = typeof req.query.lng === 'string' && req.query.lng.trim() ? Number(req.query.lng) : NaN;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid device latitude and longitude are required for local weather.' });
  }
  try {
    const weather = await getWeatherWithFallback(lat, lng);
    return res.json({ data: weather });
  } catch (error) {
    return res.status(503).json({ error: 'Live weather providers are temporarily unavailable' });
  }
});

app.post('/api/claims/check', (req, res) => {
  return res.json({ data: {
    status: 'unverified',
    explanation: 'Live official-source claim verification is not configured. Do not treat this claim as confirmed or disproved.',
    sources: [],
    source_label: 'No live source check available',
    checked_at: new Date().toISOString(),
  } });
});

app.post('/api/safety/check-in', (req, res) => {
  const message = req.body && req.body.message ? req.body.message : 'I’m safe. Sent via CivicHelp. No location shared.';
  const includeLocation = Boolean(req.body && req.body.includeLocation);
  if (includeLocation) {
    return res.json({
      data: {
        channel: 'sms-link',
        message,
        smsHref: 'sms:?body=' + encodeURIComponent(message + ' Location shared only with chosen contacts.'),
      },
    });
  }
  return res.json({
    data: {
      channel: 'sms-link',
      message,
      smsHref: 'sms:?body=' + encodeURIComponent(message),
    },
  });
});

app.post('/api/reports', (req, res) => {
  return res.status(503).json({ error: 'Report submission is not configured.' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

app.use(express.static(PROJECT_ROOT, { index: false }));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.sendFile(path.join(PROJECT_ROOT, 'index.html'));
});

async function start() {
  await ensureDb();
  await initializeSchema();
  app.listen(PORT, () => {
    console.log(`CivicHelp listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
