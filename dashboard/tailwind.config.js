/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        zinc: {
          950: '#09090b',
          900: '#121215',
          850: '#18181c',
          800: '#27272a',
          700: '#3f3f46',
        }
      }
    },
  },
  plugins: [],
}
