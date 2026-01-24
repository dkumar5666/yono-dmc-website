import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#f5991c",
        accent: "#199ce0",
      },
    },
  },
  plugins: [],
};

export default config;
