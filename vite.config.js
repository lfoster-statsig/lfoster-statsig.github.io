import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  let base = "/"; // default for PR deploys
  if (mode === "production") {
    base = "/bounce/"; // your real production path
  }

  return {
    plugins: [react()],
    base,
  };
});
