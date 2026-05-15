/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bbq-dark': '#121313',
        'bbq-light': '#ebdfce',
        'bbq-orange': '#e05c1a',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
