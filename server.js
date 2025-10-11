const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data storage (in-memory with file persistence)
const DATA_FILE = path.join(__dirname, 'data', 'competitors.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initialize or load competitors data
let competitors = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    competitors = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (error) {
    console.error('Error loading data:', error);
    competitors = [];
  }
} else {
  // Initialize with sample data
  competitors = [
    {
      id: 1,
      name: 'Example Competitor',
      website: 'https://example.com',
      description: 'A sample competitor for demonstration',
      industry: 'Technology',
      pricing: 'Freemium',
      keyFeatures: ['Feature 1', 'Feature 2'],
      strengths: ['Strong brand', 'Large user base'],
      weaknesses: ['High pricing', 'Limited features'],
      lastUpdated: new Date().toISOString()
    }
  ];
  saveData();
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(competitors, null, 2));
}

// API Routes

// Get all competitors
app.get('/api/competitors', (req, res) => {
  res.json(competitors);
});

// Get single competitor
app.get('/api/competitors/:id', (req, res) => {
  const competitor = competitors.find(c => c.id === parseInt(req.params.id));
  if (!competitor) {
    return res.status(404).json({ error: 'Competitor not found' });
  }
  res.json(competitor);
});

// Create new competitor
app.post('/api/competitors', (req, res) => {
  const newCompetitor = {
    id: competitors.length > 0 ? Math.max(...competitors.map(c => c.id)) + 1 : 1,
    name: req.body.name || '',
    website: req.body.website || '',
    description: req.body.description || '',
    industry: req.body.industry || '',
    pricing: req.body.pricing || '',
    keyFeatures: req.body.keyFeatures || [],
    strengths: req.body.strengths || [],
    weaknesses: req.body.weaknesses || [],
    lastUpdated: new Date().toISOString()
  };
  
  competitors.push(newCompetitor);
  saveData();
  res.status(201).json(newCompetitor);
});

// Update competitor
app.put('/api/competitors/:id', (req, res) => {
  const index = competitors.findIndex(c => c.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Competitor not found' });
  }
  
  competitors[index] = {
    ...competitors[index],
    ...req.body,
    id: competitors[index].id,
    lastUpdated: new Date().toISOString()
  };
  
  saveData();
  res.json(competitors[index]);
});

// Delete competitor
app.delete('/api/competitors/:id', (req, res) => {
  const index = competitors.findIndex(c => c.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'Competitor not found' });
  }
  
  competitors.splice(index, 1);
  saveData();
  res.status(204).send();
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`IntelHub server running on http://localhost:${PORT}`);
});
