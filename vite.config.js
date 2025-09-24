import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isPR = process.env.NETLIFY && process.env.CONTEXT !== "production";
  const base = isPR ? "/" : "/bounce/"; // root for PRs, subpath for production

  return {
    plugins: [react()],
    base,
  };
});
