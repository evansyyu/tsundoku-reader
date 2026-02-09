# Yomu Reader

A production-ready iOS EPUB reader app specializing in Japanese and English text rendering with vertical/horizontal text support.

## Tech Stack

- **Framework**: Expo SDK 54, React Native 0.81, React 19.1, TypeScript
- **New Architecture**: Enabled (Fabric + TurboModules)
- **Navigation**: Expo Router with native iOS tabs
- **EPUB Rendering**: Custom WebView-based renderer with CSS injection
- **EPUB Parsing**: JSZip (pure JS) + fast-xml-parser -- no native ZIP modules
- **Storage**: react-native-mmkv (settings/positions) + expo-sqlite (book metadata/bookmarks)
- **UI**: iOS 26 Liquid Glass via expo-glass-effect (with expo-blur fallback)

## Features

- Import and read EPUB 2/3 files
- Japanese vertical text (writing-mode: vertical-rl) with RTL page progression
- Tate-chu-yoko, furigana/ruby, and vertical punctuation support
- English horizontal text with LTR page progression
- Paginated (swipe) and continuous scroll reading modes
- Reading themes: Light, Dark, Sepia, Gray on Black, Custom
- Typography controls: font size, line height, font family (including Japanese fonts)
- Bookmarks and reading position persistence
- Light/Dark/Auto app theme

## Setup

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS development: Xcode 16+, CocoaPods
- An Apple Developer account (for device builds)

### Installation

```bash
npm install
```

### Development (Custom Dev Client)

This app requires a custom dev client because it uses native modules (MMKV, WebView).

```bash
# Build a development client
npx expo prebuild
npx expo run:ios

# Or use EAS Build
eas build --profile development --platform ios
```

### Project Structure

```
/app          - Expo Router routing files only
/screens      - Screen components
/components   - Reusable UI components
/contexts     - React Context providers (Theme, Settings, Books)
/hooks        - Custom React hooks
/utils        - Helpers, parsers, text renderers
  /epub       - EPUB parsing engine (parser, CSS injection, bridge)
/constants    - Theme configs, typography, layout, reader CSS templates
/types        - TypeScript type definitions
```

## Architecture

### EPUB Reader Engine

The reader uses a custom WebView-based approach:

1. **Parsing**: EPUB files (ZIP archives) are extracted with JSZip and metadata parsed with fast-xml-parser
2. **Rendering**: Chapter XHTML is loaded into react-native-webview with injected CSS/JS
3. **Pagination**: CSS columns for horizontal text; overflow-based for vertical Japanese text
4. **Communication**: PostMessage bridge between React Native and WebView for page navigation, theme/typography updates
5. **Japanese Text**: CSS `writing-mode: vertical-rl`, tate-chu-yoko via `-webkit-text-combine`, ruby/furigana styling

### Storage

- **MMKV**: Settings, reading positions, theme preferences (synchronous, ~30x faster than AsyncStorage)
- **SQLite**: Book metadata, bookmarks, structured queries (WAL mode, foreign keys)
- **File System**: EPUB files and extracted book content in app documents directory
