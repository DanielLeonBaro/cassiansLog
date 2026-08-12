const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./char/**/*.{html,js}",
    "./compendium/**/*.{html,js}",
    "./wiki/**/*.{html,js}",
    "./integrations/**/*.js",
    "./shared/**/*.js",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: "#18181b",
        parchment: "#f4f4f5",
        stone: colors.zinc,
        blood: { 500: "#b83b35", 600: "#922c28" },
        gold: "#d6aa5b",
      },
      fontFamily: {
        display: ["ui-rounded", "Nunito", "Trebuchet MS", "system-ui", "sans-serif"],
        sans: ["ui-rounded", "Nunito", "Trebuchet MS", "system-ui", "sans-serif"],
      },
      boxShadow: { card: "0 18px 50px -30px rgb(24 24 27 / .45)" },
    },
  },
  plugins: [],
};
