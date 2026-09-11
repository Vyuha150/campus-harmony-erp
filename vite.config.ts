import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Proxy the API through the dev server so the frontend and backend share
    // one origin. With VITE_API_BASE_URL=/api this lets a single public
    // tunnel (cloudflared, ngrok) expose the whole app — otherwise a remote
    // browser would try to reach the API at ITS OWN localhost:5000 and every
    // call would fail. Also removes CORS from local development entirely.
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
    // Vite refuses requests for hostnames it does not recognise, which blocks
    // any tunnel. Trusted tunnel providers only — not `true`, which would
    // accept anything and reopen the DNS-rebinding hole the check exists for.
    allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.io"],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
