import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Host/port come from the repository-level .env (see start.sh). The dev and
// preview servers bind to 127.0.0.1 unless FRONTEND_HOST is set explicitly.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, "..", ["FRONTEND_", "BACKEND_"]), ...process.env };
  const backendHost = !env.BACKEND_HOST || env.BACKEND_HOST === "0.0.0.0" ? "127.0.0.1" : env.BACKEND_HOST;
  const backend = `http://${backendHost}:${env.BACKEND_PORT || 8000}`;
  const proxy = {
    "/api": { target: backend, changeOrigin: false, xfwd: true },
    "/media": { target: backend, changeOrigin: false },
  };
  const server = {
    host: env.FRONTEND_HOST || "127.0.0.1",
    port: Number(env.FRONTEND_PORT || 5173),
    strictPort: true,
    proxy,
  };
  return {
    plugins: [react()],
    server,
    preview: { ...server, allowedHosts: true as const },
    build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  };
});
