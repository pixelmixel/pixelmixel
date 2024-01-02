const express = require('express');
const turf = require('@turf/turf');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.json());

function parseCityName(description) {
  // ... (same as before)
}

function checkIntersection(coords) {
  // ... (same as before)
}

app.post('/findNeighbourhood', (req, res) => {
  const coords = req.body.coords;
  if (!coords) {
    return res.status(400).send('Coordinates are required');
  }

  const result = checkIntersection(coords);
  res.json(result);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
