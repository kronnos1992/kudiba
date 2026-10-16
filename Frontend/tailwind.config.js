/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kudiba: {
          primary: {
            DEFAULT: "#0D5C3A",
            dark: "#073B25",
            light: "#148052",
            subtle: "#E8F5EE",
          },
          gold: {
            DEFAULT: "#C59B27",
            dark: "#9A781C",
            light: "#DFBA4E",
            subtle: "#FDF8EC",
          },
          slate: {
            50: "#F8FAFC",
            100: "#F1F5F9",
            200: "#E2E8F0",
            300: "#CBD5E1",
            400: "#94A3B8",
            500: "#64748B",
            600: "#475569",
            700: "#334155",
            800: "#1E293B",
            900: "#0F172A",
            950: "#020617",
          },
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
