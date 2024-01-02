const turf = require('@turf/turf');
const fs = require('fs');

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

// Example usage
function main() {
  const coords = [-77.653814, 44.021671]; // Replace with your default coordinates
  const result = checkIntersection(coords);
  console.log(`${result.title},${result.city}`);
}

main();
