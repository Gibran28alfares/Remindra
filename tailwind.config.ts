import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#162033",
        panel: "#f8fafc",
        line: "#d8e1ec",
        brand: "#0f766e",
        accent: "#b45309",
        danger: "#b91c1c"
      }
    }
  },
  plugins: []
};

export default config;
