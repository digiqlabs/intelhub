# IntelHub 🎯

> Single Stop Shop to Track Competitors

IntelHub is a comprehensive competitor tracking application that helps you monitor and analyze your competition in one centralized platform.

## Features

- **Add & Manage Competitors**: Easily add new competitors with detailed information
- **Track Key Metrics**: Monitor competitor websites, pricing models, and industry positioning
- **Feature Analysis**: Document competitor strengths, weaknesses, and key features
- **Search & Filter**: Quickly find competitors using the search functionality
- **Real-time Updates**: Track when competitor information was last updated
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/digiqlabs/intelhub.git
cd intelhub
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

### Adding a Competitor

1. Click the "+ Add Competitor" button
2. Fill in the competitor details:
   - Name (required)
   - Website
   - Industry
   - Description
   - Pricing Model
   - Key Features
   - Strengths
   - Weaknesses
3. Click "Save"

### Viewing Competitor Details

- Click on any competitor card to view full details
- See all tracked information including features, strengths, and weaknesses

### Editing Competitors

- Click the "Edit" button on a competitor card
- Update the information
- Click "Save" to apply changes

### Deleting Competitors

- Click the "Delete" button on a competitor card
- Confirm the deletion

### Searching

- Use the search bar to filter competitors by name, industry, description, or website

## Data Storage

IntelHub stores competitor data in a JSON file (`data/competitors.json`) for persistence. The data is automatically saved whenever you add, update, or delete competitors.

## API Endpoints

The application provides a RESTful API:

- `GET /api/competitors` - Get all competitors
- `GET /api/competitors/:id` - Get a specific competitor
- `POST /api/competitors` - Create a new competitor
- `PUT /api/competitors/:id` - Update a competitor
- `DELETE /api/competitors/:id` - Delete a competitor

## Project Structure

```
intelhub/
├── server.js           # Express server and API routes
├── package.json        # Project dependencies
├── data/              # Data storage directory
│   └── competitors.json
└── public/            # Frontend files
    ├── index.html     # Main HTML page
    ├── styles.css     # Styling
    └── app.js         # Frontend JavaScript
```

## Development

To run in development mode:

```bash
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC