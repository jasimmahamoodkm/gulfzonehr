/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0F3460',
        secondary: '#16A085',
        accent: '#F39C12',
        danger: '#E74C3C',
        success: '#27AE60',
        light: '#ECF0F1',
        dark: '#34495E',
      },
    },
  },
  plugins: [],
}
