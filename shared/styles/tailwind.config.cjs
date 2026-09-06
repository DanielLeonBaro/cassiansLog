// Defines scanned source paths and the shared theme-aware Tailwind tokens.
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./admin/**/*.{html,js}",
    "./char/**/*.{html,js}",
    "./campaigns/**/*.{html,js}",
    "./combat-loot/**/*.{html,js}",
    "./compendium/**/*.{html,js}",
    "./dm-screen/**/*.{html,js}",
    "./music/**/*.{html,js}",
    "./public-initiative/**/*.{html,js}",
    "./player-screen/**/*.{html,js}",
    "./screens/**/*.{html,js}",
    "./wiki/**/*.{html,js}",
    "./integrations/**/*.js",
    "./login/**/*.{html,js}",
    "./shared/**/*.js",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--theme-background, 24 24 27) / <alpha-value>)",
        parchment: "rgb(var(--theme-background, 244 244 245) / <alpha-value>)",
        stone: colors.zinc,
        blood: {
          500: "rgb(var(--theme-accent, 184 59 53) / <alpha-value>)",
          600: "rgb(var(--theme-accent-hover, 146 44 40) / <alpha-value>)",
        },
        danger: { 500: "#dc2626", 600: "#b91c1c" },
        "theme-surface": "rgb(var(--theme-surface, 39 39 42) / <alpha-value>)",
        "theme-surface-strong": "rgb(var(--theme-surface-strong, 63 63 70) / <alpha-value>)",
        "theme-border": "rgb(var(--theme-border, 82 82 91) / <alpha-value>)",
        "theme-text": "rgb(var(--theme-text, 255 255 255) / <alpha-value>)",
        "theme-muted": "rgb(var(--theme-muted, 212 212 216) / <alpha-value>)",
        "on-accent": "rgb(var(--theme-on-accent, 255 255 255) / <alpha-value>)",
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
