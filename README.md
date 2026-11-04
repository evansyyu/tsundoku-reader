# Tsundoku Reader

An EPUB reader for iOS and Android built for reading Japanese: vertical text, furigana, and tap-to-look-up dictionary definitions that work on conjugated words.

## Tech Stack

- **Framework**: Expo SDK 54, React Native 0.81, React 19.1, TypeScript
- **New Architecture**: Enabled (Fabric + TurboModules)
- **Navigation**: Expo Router with native iOS tabs
- **EPUB Rendering**: Custom WebView-based renderer with CSS injection
- **EPUB Parsing**: JSZip (pure JS) + fast-xml-parser -- no native ZIP modules
- **Storage**: react-native-mmkv (settings/positions) + expo-sqlite (book metadata/bookmarks, bundled dictionary)
- **Styling & animation**: NativeWind (Tailwind CSS), react-native-reanimated
- **UI**: iOS 26 Liquid Glass via expo-glass-effect (with expo-blur fallback)
- **Builds**: EAS Build, Git LFS for the dictionary database

## Features

- Import and read EPUB 2/3 files
- Tap any word to look it up in a bundled offline Japanese dictionary; a deinflection engine maps conjugated verbs and adjectives back to their dictionary form
- Japanese vertical text (writing-mode: vertical-rl) with RTL page progression
- Tate-chu-yoko, furigana/ruby, and vertical punctuation support
- English horizontal text with LTR page progression
- Paginated (swipe) and continuous scroll reading modes
- Reading themes: Light, Dark, Sepia, Gray on Black, Custom
- Typography controls: font size, line height, font family (including Japanese fonts)
- Bookmarks and reading position persistence
- Light/Dark/Auto app theme
- iOS and Android, with responsive grid layouts for tablets

## Setup

### Prerequisites

- Node.js 18+
- Git LFS (`git lfs install` before cloning, for the dictionary database)
- iOS development: Xcode 16+, CocoaPods
- Android development: Android Studio
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
npx expo run:ios      # or: npx expo run:android

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

### Dictionary Lookup

Tapping a word in the WebView sends the surrounding text over the bridge. `utils/deinflection.ts` generates candidate dictionary forms by reversing conjugation suffixes (modeled on Yomitan's rule system), and `utils/dictionary.ts` queries the bundled read-only SQLite dictionary, keeping only candidates whose part of speech matches the rule that produced them.

### Storage

- **MMKV**: Settings, reading positions, theme preferences (synchronous, ~30x faster than AsyncStorage)
- **SQLite**: Book metadata, bookmarks, structured queries (WAL mode, foreign keys)
- **File System**: EPUB files and extracted book content in app documents directory

## Dictionary Data and Attribution

The bundled dictionary (`assets/dictionary_tsundoku.db`) is built from [Jitendex](https://jitendex.org) by Stephen Kraus, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The database file is redistributed under the same license.

Jitendex incorporates:

- [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) dictionary data from the [Electronic Dictionaries Research Group](https://www.edrdg.org/), under [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html)
- Example sentences from [Tatoeba](https://tatoeba.org), under CC BY 2.0 FR
- Furigana positions from [JmdictFurigana](https://github.com/Doublevil/JmdictFurigana)
