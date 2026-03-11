import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["apache-arrow"],
  async redirects() {
    return [{ source: "/stats", destination: "/", permanent: false }];
  },
};

export default nextConfig;
