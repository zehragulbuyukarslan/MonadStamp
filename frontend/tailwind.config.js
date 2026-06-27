/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        monad: {
          purple: "#6E54FF",
          dark: "#0D0221",
          glow: "#B794F6",
        },
      },
      animation: {
        stamp: "stamp 0.6s ease-out forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
      },
      keyframes: {
        stamp: {
          "0%": { transform: "scale(2) rotate(-12deg)", opacity: "0" },
          "60%": { transform: "scale(0.95) rotate(2deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
