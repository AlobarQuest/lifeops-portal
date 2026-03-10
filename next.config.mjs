/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    staticGenerationMaxConcurrency: 1,
  },
};

export default nextConfig;
