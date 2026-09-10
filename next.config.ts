import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API: process.env.NEXT_PUBLIC_API || "http://localhost:8000",
  },
  allowedDevOrigins: ["b67f-61-8-66-163.ngrok-free.app"],
};

export default nextConfig;
