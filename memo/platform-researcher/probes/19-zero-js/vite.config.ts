import react from "@vitejs/plugin-react";
import funstackStatic from "@funstack/static";
import { defineConfig } from "vite";
const variant = process.env.VARIANT ?? "plain";
export default defineConfig({
  root: __dirname,
  plugins: [funstackStatic({ root: "./src/root.tsx", app: `./src/app-${variant}.tsx`, ssr: true }), react()],
  build: { outDir: `dist-${variant}` },
});
