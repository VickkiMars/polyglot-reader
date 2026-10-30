/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/audio/:lang/:file*",
        destination: "/api/audio/:lang/:file*",
      },
    ];
  },
};

export default nextConfig;

