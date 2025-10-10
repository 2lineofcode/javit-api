# Javit API

A modern API for fetching data from various JAV sites. Built with Next.js 15, React 19, and TypeScript.

## 🚀 Tech Stack

- **Next.js 15** - The React Framework for Production
- **React 19** - Latest React with improved performance
- **TypeScript 5.7** - Type-safe JavaScript
- **Yarn 4** - Fast, reliable package manager
- **ESLint & Prettier** - Code quality and formatting

## ✨ Features

- Fetch data from MissAV, NJav, and R18
- Search for videos by code
- Search for actresses
- Get star rankings
- Modern security headers
- Type-safe API routes

## API Endpoints

### MissAV

- `GET /api/missav`: Fetches a list of videos from MissAV.
- `GET /api/missav/bycode?code={code}`: Fetches video details from MissAV by code.
- `GET /api/missav/search?q={query}`: Searches for videos on MissAV.
- `GET /api/missav/star_rank`: Fetches star rankings from MissAV.

### NJav

- `GET /api/njav`: Fetches a list of videos from NJav.
- `GET /api/njav/bycode?code={code}`: Fetches video details from NJav by code.
- `GET /api/njav/search?q={query}`: Searches for videos on NJav.
- `GET /api/njav/star_rank`: Fetches star rankings from NJav.

### R18

- `GET /api/r18`: Fetches a list of videos from R18.
- `GET /api/r18/bycode?code={code}`: Fetches video details from R18 by code.

### Actress

- `GET /api/actress?q={query}`: Searches for an actress.

## 🛠️ Getting Started

### Prerequisites

- Node.js >= 18.18.0
- Yarn >= 1.22.0

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd javit-api
   ```

2. **Install dependencies:**

   ```bash
   yarn install
   ```

3. **Run the development server:**

   ```bash
   yarn dev
   ```

4. **Open your browser:**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Dependencies

- [next](https://nextjs.org/): The React framework for production.
- [react](https://reactjs.org/): A JavaScript library for building user interfaces.
- [react-dom](https://reactjs.org/docs/react-dom.html): The entry point to the DOM and server renderers for React.
- [axios](https://axios-http.com/): Promise based HTTP client for the browser and node.js.
- [cheerio](https://cheerio.js.org/): Fast, flexible, and lean implementation of core jQuery designed specifically for the server.
- [wanakana](https://wanakana.com/): A JavaScript library for detecting and transliterating between Hiragana, Katakana, and Romaji.

## 📜 Available Scripts

```
- `yarn dev`            # Development server
- `yarn build`          # Production build
- `yarn lint`           # Run ESLint
- `yarn lint:fix`       # Auto-fix ESLint errors
- `yarn type-check`     # TypeScript validation
- `yarn format`         # Format code dengan Prettier
- `yarn format:check`   # Check formatting
```

## 🏗️ Project Structure

```
javit-api/
├── pages/           # Next.js pages and API routes
│   ├── api/        # API endpoints
│   │   ├── actress.ts
│   │   ├── missav/
│   │   ├── njav/
│   │   └── r18/
│   └── index.tsx   # Home page
├── src/            # Source files
├── styles/         # Global styles
├── models/         # Data models
└── public/         # Static assets
```

## 🔒 Security

This project includes modern security headers:
- X-Frame-Options
- X-Content-Type-Options
- X-DNS-Prefetch-Control
- Referrer-Policy

## 📝 Code Quality

- **TypeScript** with strict mode enabled
- **ESLint** for code linting
- **Prettier** for consistent formatting
- **Type checking** before commits recommended