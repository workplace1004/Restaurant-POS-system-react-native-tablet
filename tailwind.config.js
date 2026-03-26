/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx}', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        pos: {
          bg: '#2c3e50',
          panel: '#34495e',
          surface: '#7f8c8d',
          'surface-hover': '#95a5a6',
          text: '#ecf0f1',
          muted: '#95a5a6',
          'text-dim': '#bdc3c7',
          border: '#34495e',
          dark: '#1a252f',
          danger: '#e74c3c',
          rowHover: '#3d566e',
          inputBorder: '#4a6278',
          accent: '#22c55e',
        },
      },
    },
  },
  plugins: [],
};
