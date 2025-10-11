import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans]
      },
      dropShadow: {
        "panel": "0 20px 45px -25px rgba(15, 23, 42, 1)",
        "panel-strong": "0 25px 45px -28px rgba(14, 23, 42, 1)"
      }
    }
  },
  plugins: []
};
