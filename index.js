require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const fs = require('fs');


const app = express();
const port = process.env.PORT || 3000;

// Replace with your actual Mapbox access token
const MAPBOX_ACCESS_TOKEN = 'process.env.MAPBOX_ACCESS_TOKEN';
const MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Webflow API details
const WEBFLOW_API_TOKEN = 'process.env.WEBFLOW_API_TOKEN';
const WEBFLOW_COLLECTION_ID = '648fa3e80460401ca2b9f2c8';

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
  return 'Unknown City'; // Or return null if you prefer
}

// Function to check if coordinates intersect with any polygon
function checkIntersection(coords) {
  const geojsonData = JSON.parse(fs.readFileSync('map.geojson', 'utf8'));
  const point = turf.point(coords);

  for (const feature of geojsonData.features) {
    if (turf.booleanPointInPolygon(point, feature)) {
      const title = feature.properties.title; // Using 'title' as the property
      const city = parseCityName(feature.properties.description);
      return { title, city };
    }
  }

  return { title: 'No neighbourhood found', city: 'N/A' };
}

// New function to fetch data from Webflow CMS with client-side filtering
async function fetchFromWebflowCMS(neighborhoodTitle) {
  const webflowAPIUrl = `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`;
  const config = {
    headers: { 'Authorization': `Bearer ${WEBFLOW_API_TOKEN}` }
  };

  try {
    const response = await axios.get(webflowAPIUrl, config);
    const allItems = response.data.items;
    const filteredItems = allItems.filter(item => item.neighborhood === neighborhoodTitle);
    console.log("Filtered Webflow CMS Data:", filteredItems); // Log filtered Webflow CMS data
    return filteredItems;
  } catch (error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return null; // or handle the error appropriately
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
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    res.status(500).send('Error processing request');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

console.log("MAPBOX_ACCESS_TOKEN:", process.env.MAPBOX_ACCESS_TOKEN);
console.log("WEBFLOW_API_TOKEN:", process.env.WEBFLOW_API_TOKEN);
