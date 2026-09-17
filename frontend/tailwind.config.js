/** @type {import('tailwindcss').Config} */
// Tokens tomados de docs/DESIGN_SYSTEM.md — mantener sincronizado con ese documento.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        ink: { DEFAULT: "#14161A", 80: "#14161ACC", 60: "#14161A99" },
        bone: { DEFAULT: "#EDE9E2", 90: "#E4DFD5" },
        steel: { DEFAULT: "#5B6169", 40: "#5B616966" },
        brass: { DEFAULT: "#A9843C", light: "#C9A15E", dark: "#8A6B2E" },
        ember: { DEFAULT: "#B5502E", light: "#D97757" },
        moss: { DEFAULT: "#5C7A5E", light: "#7A9A7C" },
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        safe: "env(safe-area-inset-bottom)",
      },
      borderRadius: {
        razor: "2px",
        DEFAULT: "12px",
        card: "16px",
        sheet: "24px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(20,22,26,0.08)",
        card: "0 4px 16px -4px rgba(20,22,26,0.18)",
        float: "0 8px 24px -6px rgba(20,22,26,0.28)",
        brass: "0 0 0 3px rgba(169,132,60,0.35)",
      },
    },
  },
  plugins: [],
};
