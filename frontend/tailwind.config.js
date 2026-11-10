/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: "#F7F7F4",
        navy: { DEFAULT: "#102435", 700: "#172D3D", 600: "#23404F" },
        steel: { DEFAULT: "#73818A", 600: "#56646D" },
        line: "#E8EAE7",
        brass: { DEFAULT: "#B68B58", 700: "#8F6A3D" },
        ink: "#202B31",
        danger: "#9B3B30",
        ok: "#2F6B52",
      },
      fontFamily: {
        sans: ['"Manrope Variable"', "Manrope", "system-ui", "sans-serif"],
        serif: ['"DM Serif Display"', "Georgia", "serif"],
      },
      borderRadius: { DEFAULT: "2px", sm: "2px", md: "3px", lg: "4px" },
      maxWidth: { page: "1320px" },
      letterSpacing: { label: "0.14em" },
    },
  },
  plugins: [],
};
