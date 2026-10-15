/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#18202f",
        fern: "#2f6f57",
        coral: "#e8694f",
        gold: "#f2b84b",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(24, 32, 47, 0.12)",
      },
    },
  },
  plugins: [],
};
