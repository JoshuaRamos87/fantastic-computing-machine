/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        xblue: '#1DA1F2',
        xbluehover: '#0c85d0',
        xdark: '#0f1419',
        xcard: '#16181c',
        xborder: '#2f3336',
      },
    },
  },
  plugins: [],
};
