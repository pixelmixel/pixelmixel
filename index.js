const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Replace with your actual Mapbox access token
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibmFiZXJob29kIiwiYSI6ImM2NmMyNTA1MGNhZTQ4YzhkYTliYjI3ZGVlNTBlMjkyIn0.3oOdaanFkpIZq8LL4WG5wg';
const MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Webflow API details
const WEBFLOW_API_TOKEN = '731a6692434580d474e2dc2100c188e105b55604f5b058ea31d8a6bee7600b52';
const WEBFLOW_COLLECTION_ID = '5909710656dfadeef5ba698';

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

// New function to fetch data from Webflow CMS
async function fetchFromWebflowCMS(neighborhoodName) {
  const webflowAPIUrl = `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`;
  const config = {
    headers: { 'Authorization': `Bearer ${WEBFLOW_API_TOKEN}` },
    params: {
      'fields': 'name,slug', // Add other fields you need
      'filter': {
        'field': 'neighborhood', // The field in your collection that matches the neighborhood name
        'value': neighborhoodName
      }
    }
  };

  try {
    const response = await axios.get(webflowAPIUrl, config);
    return response.data.items;
  } catch (error) {
    console.error('Error fetching data from Webflow CMS:', error);
    throw error;
  }
}

// Endpoint to geocode address and check intersection
app.post('/geocodeAndCheckIntersection', async (req, res) => {
  const address = req.body.address;
  if (!address) {
    return res.status(400).send('Address is required');
  }

  try {
    const geocodeUrl = `${MAPBOX_BASE_URL}/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}`;
    const geocodeResponse = await axios.get(geocodeUrl);
    console.log("Mapbox API Response:", geocodeResponse.data); // Log Mapbox response

    const coords = geocodeResponse.data.features[0].center;
    const intersectionResult = checkIntersection(coords);

    if (intersectionResult.title !== 'No neighbourhood found') {
      const webflowData = await fetchFromWebflowCMS(intersectionResult.title);
      console.log("Webflow API Response:", webflowData); // Log Webflow response
      intersectionResult.webflowData = webflowData;
    }

    res.json(intersectionResult);
  } catch (error) {
    console.error('Error in /geocodeAndCheckIntersection:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
    }
    res.status(500).send('Error processing request');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
