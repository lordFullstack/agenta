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
        brass: { DEFAULT: "#F5B93F", light: "#FACD6E", dark: "#C49432" },
        ember: { DEFAULT: "#B5502E", light: "#D97757" },
        moss: { DEFAULT: "#5C7A5E", light: "#7A9A7C" },
        // Tema del cliente (mockup "Agenta Barber Booking"): oscuro azulado + dorado.
        // Se agregan como tokens aparte para no alterar el panel de la barbería, que
        // sigue usando ink/bone/steel/brass.
        night: { DEFAULT: "#09121B", deep: "#060D14" },
        panel: { DEFAULT: "#0D1822", raised: "#122130" },
        edge: { DEFAULT: "#1E2E3D", strong: "#2C4054" },
        gold: { DEFAULT: "#E8B357", light: "#F2C877", dark: "#B98A35" },
        snow: "#F4F1EA",
        fog: "#93A1AF",
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
        brass: "0 0 0 3px rgba(245,185,63,0.35)",
        "gold-ring": "0 0 0 3px rgba(232,179,87,0.18)",
        "gold-glow": "0 8px 24px -8px rgba(232,179,87,0.45)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "150% 0" },
          "100%": { backgroundPosition: "-50% 0" },
        },
        "draw-check": {
          from: { strokeDashoffset: "24" },
          to: { strokeDashoffset: "0" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "draw-check": "draw-check 0.5s ease-out 0.1s both",
      },
    },
  },
  plugins: [],
};
