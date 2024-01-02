const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const turf = require('@turf/turf');
const fs = require('fs');

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json()); // Support JSON-encoded bodies

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

// POST endpoint to receive coordinates and return intersection result
app.post('/checkIntersection', (req, res) => {
  const coords = req.body.coords;
  if (!coords) {
    return res.status(400).send('Coordinates are required');
  }

  try {
    const result = checkIntersection(coords);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing request');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
