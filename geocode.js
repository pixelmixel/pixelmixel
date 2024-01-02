const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const fs = require('fs');

const app = express();
const port = 3000;

// Replace with your actual Mapbox access token
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibmFiZXJob29kIiwiYSI6ImM2NmMyNTA1MGNhZTQ4YzhkYTliYjI3ZGVlNTBlMjkyIn0.3oOdaanFkpIZq8LL4WG5wg';
const MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

app.use(cors());
app.use(bodyParser.json());

// Function to parse the city name from the description
function parseCityName(description) {
  const lines = description.split('\n');
  for (const line of lines) {
    if (line.startsWith('city:')) {
      return line.split(':')[1].trim();
    }
  }
  return 'Unknown City';
}

// Function to check if coordinates intersect with any polygon
function checkIntersection(coords) {
  const geojsonData = JSON.parse(fs.readFileSync('map.geojson', 'utf8'));
  const point = turf.point(coords);

  for (const feature of geojsonData.features) {
    if (turf.booleanPointInPolygon(point, feature)) {
      const title = feature.properties.title;
      const city = parseCityName(feature.properties.description);
      return { title, city };
    }
  }

  return { title: 'No neighbourhood found', city: 'N/A' };
}

// Endpoint to geocode address and check intersection
app.post('/geocodeAndCheckIntersection', async (req, res) => {
  const address = req.body.address;
  if (!address) {
    return res.status(400).send('Address is required');
  }

  try {
    // Geocode address using Mapbox
    const geocodeUrl = `${MAPBOX_BASE_URL}/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}`;
    const geocodeResponse = await axios.get(geocodeUrl);
    const coords = geocodeResponse.data.features[0].center;

    // Check intersection
    const result = checkIntersection(coords);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing request');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
