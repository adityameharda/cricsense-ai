# Live Data Automation Project

## Overview
This project automates API calls to fetch live data and renders it on a web application. It consists of a client-side React application and a server-side Node.js application that interacts with an external API to retrieve live data.

## Project Structure
```
live-data-automation
├── client
│   ├── public
│   │   ├── index.html        # Main HTML file for the client application
│   │   └── styles.css       # CSS styles for the client application
│   ├── src
│   │   ├── App.js           # Main React component that initializes the application
│   │   └── components
│   │       └── LiveData.js  # Component that fetches and displays live data
│   ├── package.json         # Configuration file for the client-side application
│   └── README.md            # Documentation for the client-side application
├── server
│   ├── src
│   │   ├── automation.js     # Logic for automating API calls to fetch live data
│   │   ├── routes
│   │   │   └── api.js       # API routes for the server
│   │   └── models
│   │       └── Match.js     # MongoDB schema for the Match model
│   ├── package.json         # Configuration file for the server-side application
│   └── README.md            # Documentation for the server-side application
└── README.md                # Documentation for the overall project
```

## Getting Started

### Prerequisites
- Node.js and npm installed on your machine.
- MongoDB instance running (if using a local database).

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd live-data-automation
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Install client dependencies:
   ```
   cd ../client
   npm install
   ```

### Running the Application

1. Start the server:
   ```
   cd server
   npm start
   ```

2. Start the client:
   ```
   cd ../client
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000` to view the application.

## Usage
The application will automatically fetch live data from the specified API and display it on the client-side interface. The server will handle API requests and database interactions.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License
This project is licensed under the MIT License.