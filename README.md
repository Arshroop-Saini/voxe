# Voxe - Voice-Controlled Productivity Assistant

A mobile app that allows users to control their digital life through natural voice commands and text input.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (Xcode) or Android Emulator

### Development Setup

1. **Install dependencies:**
   ```bash
   # Backend
   cd voxe-backend && npm install
   
   # Mobile app
   cd ../voxe-mobile && npm install
   ```

2. **Start backend with auto-restart:**
   ```bash
   cd voxe-backend && npm run dev
   ```

3. **Start mobile app with hot reload:**
   ```bash
   cd voxe-mobile && npm start
   ```

## 📱 Available Scripts

### Backend (voxe-backend/)
| Script | Description |
|--------|-------------|
| `npm run dev` | Start with nodemon auto-restart on file changes |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production build |

### Mobile App (voxe-mobile/)
| Script | Description |
|--------|-------------|
| `npm start` | Start Expo dev server with hot reload |
| `npm run ios` | Start and open iOS simulator |
| `npm run android` | Start and open Android emulator |
| `npm run web` | Start web version |

## 🔧 Development Features

- **Backend Auto-restart**: Nodemon automatically restarts when you change any `.ts`, `.js`, or `.json` files
- **Mobile Hot Reload**: Expo automatically reloads when you save changes to React Native code
- **TypeScript**: Full type safety across both projects
- **ES Modules**: Modern JavaScript module system

## 🏗️ Project Structure

```
voxe/
├── voxe-backend/          # Express.js API server
│   ├── src/
│   │   ├── api/           # API routes
│   │   ├── lib/           # Utilities and services
│   │   └── index.ts       # Server entry point
│   ├── nodemon.json       # Auto-restart configuration
│   └── package.json       # Backend dependencies
├── voxe-mobile/           # Expo React Native app
│   ├── app/               # App screens (Expo Router)
│   ├── components/        # Reusable components
│   ├── constants/         # App constants
│   └── package.json       # Mobile app dependencies
└── README.md              # This file
```

## 🔄 Auto-Restart Configuration

The backend uses `nodemon` with `ts-node-dev` for optimal development experience:
- Watches `src/` directory for changes
- Supports TypeScript ES modules
- 1-second delay to avoid rapid restarts
- Ignores test files

## 🎯 Current Status

- ✅ **Phase 1A**: Project setup complete
- ✅ **Phase 1B**: OAuth infrastructure complete
- 🔄 **Phase 2A**: Voice & Text Input Interface (Next)

## 🔗 Services

- **Backend**: http://localhost:3002
- **Mobile**: Expo development server
- **Database**: Supabase (zwodcjaefewenwnyvldw)

---

**Happy coding! 🎉** 