require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapbox setup
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
const MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

// Webflow setup
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;

app.use(cors());
app.use(bodyParser.json());

// Utility functions
function parseLocationDetails(description) {
  const locationDetails = {
    city: 'Unknown City',
    provinceState: 'Unknown Province/State',
    country: 'Unknown Country'
  };

  if (!description) return locationDetails;

  const lines = description.split('\n');
  for (const line of lines) {
    const lowerCaseLine = line.toLowerCase();

    if (lowerCaseLine.startsWith('city:')) {
      locationDetails.city = line.split(':')[1].trim();
    } else if (lowerCaseLine.startsWith('province_state:')) {
      locationDetails.provinceState = line.split(':')[1].trim();
    } else if (lowerCaseLine.startsWith('country:')) {
      locationDetails.country = line.split(':')[1].trim();
    }
  }

  return locationDetails;
}

function checkIntersection(coords) {
  const geojsonData = JSON.parse(fs.readFileSync('map.geojson', 'utf8'));
  const point = turf.point(coords);

  for (const feature of geojsonData.features) {
    if (turf.booleanPointInPolygon(point, feature) && feature.properties) {
      const title = feature.properties.title || 'Unknown Neighborhood';
      const { city, provinceState, country } = parseLocationDetails(feature.properties.description || '');
      return { title, city, provinceState, country };
    }
  }

  return { title: 'No neighborhood found', city: 'Unknown City', provinceState: 'Unknown Province/State', country: 'Unknown Country' };
}

async function fetchFromWebflowCMS(neighborhoodTitle) {
  if (!WEBFLOW_API_TOKEN || !WEBFLOW_COLLECTION_ID) {
    console.error('Webflow API token and collection ID are not defined in .env');
    return null;
  }

  const webflowEndpoint = `https://api.webflow.com/collections/${WEBFLOW_COLLECTION_ID}/items`;

  try {
    const response = await axios.get(webflowEndpoint, {
      headers: {
        Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
        'accept-version': '1.0.0'
      },
      params: {
        limit: 100,
        offset: 0
      }
    });

    const items = response.data.items;
    const filteredItems = items.filter(item => item.neighborhoodTitle === neighborhoodTitle);

    console.log('Filtered Webflow Data:', filteredItems);
    return filteredItems;
  } catch (error) {
    console.error('Error fetching data from Webflow CMS:', error);
    return null;
  }
}

async function fetchDataFromSupabase(neighborhoodName, cityName) {
  console.log('Querying Supabase for neighborhood:', neighborhoodName, 'in city:', cityName);

  try {
    // Fetch the neighborhood records based on the neighborhood name and city name
    const { data: neighborhoods, error: neighborhoodError } = await supabase
      .from('neighborhoods')
      .select('id')
      .eq('name', neighborhoodName)
      .eq('city', cityName);

    if (neighborhoodError) {
      console.error('Error fetching neighborhood data from Supabase:', neighborhoodError.message);
      return null;
    }

    if (!neighborhoods || neighborhoods.length === 0) {
      console.error('No matching neighborhood found in Supabase for:', neighborhoodName, cityName);
      return null;
    }

    // Use the first matching neighborhood ID
    const neighborhoodId = neighborhoods[0].id;
    console.log('Neighborhood ID:', neighborhoodId);

    // Fetch places data using the neighborhood ID
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('neighborhood_id', neighborhoodId); // Updated to use "neighborhood_id"

    if (placesError) {
      console.error('Error fetching places data from Supabase:', placesError.message);
      return null;
    }

    console.log('Supabase Data:', places);
    return places;
  } catch (error) {
    console.error('Error in fetchDataFromSupabase:', error.message);
    return null;
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
    const coords = geocodeResponse.data.features[0].center;
    const intersectionResult = checkIntersection(coords);

    const webflowData = await fetchFromWebflowCMS(intersectionResult.title);
    const supabaseData = await fetchDataFromSupabase(intersectionResult.title, intersectionResult.city);

    intersectionResult.webflowData = webflowData;
    intersectionResult.supabaseData = supabaseData;

    res.json(intersectionResult);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error processing request');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
