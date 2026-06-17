/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          600: '#1a56db',
          700: '#1e429f',
          800: '#1e3a8a',
          900: '#1e3162',
        },
      },
    },
  },
  plugins: [],
}

