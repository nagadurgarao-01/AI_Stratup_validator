import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Allow Cloudflare tunnel and ngrok origins in dev mode
  // This prevents the 530 / cross-origin blocked error when sharing via tunnel
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.app",
    "*.ngrok.io",
    "192.168.*.*",
    "10.0.*.*",
    "localhost",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
