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
function parseCityName(description) {
  // ... existing parseCityName function ...
}

function checkIntersection(coords) {
  // ... existing checkIntersection function ...
}

async function fetchFromWebflowCMS(neighborhoodTitle) {
  // ... existing fetchFromWebflowCMS function ...
}

async function fetchDataFromSupabase(neighborhoodName) {
  try {
    // Fetch the neighbourhood ID
    const { data: neighborhoodData, error: neighborhoodError } = await supabase
      .from('neighbourhoods')
      .select('id')
      .eq('name', neighborhoodName)
      .single();

    if (neighborhoodError) throw neighborhoodError;

    // Fetch places data using the neighbourhood ID
    const { data: placesData, error: placesError } = await supabase
      .from('places')
      .select('*')
      .eq('neighbourhoodID', neighborhoodData.id); // Match the neighbourhoodID column

    if (placesError) throw placesError;

    return placesData;
  } catch (error) {
    console.error('Error fetching data from Supabase:', error.message);
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

    if (intersectionResult.title !== 'No neighbourhood found') {
      const webflowData = await fetchFromWebflowCMS(intersectionResult.title);
      const supabaseData = await fetchDataFromSupabase(intersectionResult.title);

      intersectionResult.webflowData = webflowData;
      intersectionResult.supabaseData = supabaseData;
    }

    res.json(intersectionResult);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error processing request');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
