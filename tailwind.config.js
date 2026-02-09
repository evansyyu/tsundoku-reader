/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Light-mode surfaces (use with dark: variant for dark equivalents)
        surface: {
          DEFAULT: '#F2F2F7',
          secondary: '#E5E5EA',
          dark: '#1C1C1E',
          'dark-secondary': '#2C2C2E',
        },
        // Semantic colors
        tint: {
          DEFAULT: '#007AFF',
          dark: '#0A84FF',
          secondary: '#5856D6',
          'secondary-dark': '#5E5CE6',
        },
        danger: {
          DEFAULT: '#FF3B30',
          dark: '#FF453A',
        },
        success: {
          DEFAULT: '#34C759',
          dark: '#30D158',
        },
        // Border colors
        'app-border': {
          DEFAULT: '#C7C7CC',
          dark: '#38383A',
        },
        // Tab bar
        'tab-bar': {
          DEFAULT: '#F8F8F8',
          dark: '#1C1C1E',
        },
        'tab-bar-border': {
          DEFAULT: '#D1D1D6',
          dark: '#38383A',
        },
        // Text
        'text-secondary': {
          DEFAULT: '#6B7280',
          dark: '#9CA3AF',
        },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
      },
      borderRadius: {
        'app-sm': '6px',
        'app-md': '10px',
        'app-lg': '16px',
        'app-xl': '24px',
      },
    },
  },
  plugins: [],
};
