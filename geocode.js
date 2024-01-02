const express = require('express');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const fs = require('fs');
const NodeGeocoder = require('node-geocoder');

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Geocoder configuration for OpenStreetMap
const geocoderOptions = {
  provider: 'openstreetmap'
};
const geocoder = NodeGeocoder(geocoderOptions);

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

// POST endpoint to receive address from Webflow webhook and return intersection result
app.post('/geocode', async (req, res) => {
  // Assuming the address is sent in a field named 'address'
  const address = req.body.address;
  if (!address) {
    return res.status(400).send('Address is required');
  }

  try {
    const geoRes = await geocoder.geocode(address);
    if (geoRes.length === 0) {
      return res.status(404).send('Address not found');
    }
    const coords = [geoRes[0].longitude, geoRes[0].latitude];
    const result = checkIntersection(coords);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error in geocoding process');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
