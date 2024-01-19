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

  return { title: 'No neighbourhood found', city: 'Unknown City', provinceState: 'Unknown Province/State', country: 'Unknown Country' };
}

async function fetchFromWebflowCMS(neighborhoodTitle) {
  // Placeholder for fetchFromWebflowCMS function implementation
  // Implement based on your Webflow CMS setup
}

async function fetchDataFromSupabase(neighbourhoodName, cityName) {
  console.log('Querying Supabase for neighbourhood:', neighbourhoodName, 'in city:', cityName);

  try {
    // Fetch the neighbourhood records based on the neighbourhood name and city name
    const { data: neighbourhoods, error: neighbourhoodError } = await supabase
      .from('neighbourhoods')
      .select('id')
      .eq('name', neighbourhoodName)
      .eq('city', cityName);

    if (neighbourhoodError) {
      console.error('Error fetching neighbourhood data from Supabase:', neighbourhoodError.message);
      return null;
    }

    if (!neighbourhoods || neighbourhoods.length === 0) {
      console.error('No matching neighbourhood found in Supabase for:', neighbourhoodName, cityName);
      return null;
    }

    // Use the first matching neighbourhood ID
    const neighbourhoodId = neighbourhoods[0].id;
    console.log('Neighbourhood ID:', neighbourhoodId);

    // Fetch places data using the neighbourhood ID
    const { data: places, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('neighbourhoodID', neighbourhoodId);

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
