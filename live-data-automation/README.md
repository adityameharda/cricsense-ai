# Live Data Automation Project

This project automates API calls to fetch live data and render it on a web application. It consists of a client-side React application and a server-side Node.js application.

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
│   ├── package.json         # Client-side application configuration
│   └── README.md            # Documentation for the client-side application
├── server
│   ├── src
│   │   ├── automation.js     # Logic for automating API calls to fetch live data
│   │   ├── routes
│   │   │   └── api.js       # API routes for the server
│   │   └── models
│   │       └── Match.js     # MongoDB schema for the Match model
│   ├── package.json         # Server-side application configuration
│   └── README.md            # Documentation for the server-side application
└── README.md                # Overall project documentation
```

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm (Node Package Manager)

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

The client application will be available at `http://localhost:3000` and the server will run on `http://localhost:5000`.

## Usage

The client application fetches live data from the server, which in turn retrieves data from an external API. The data is displayed in real-time on the web application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License.