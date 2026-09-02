/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io", pathname: "/football/**" },
      { protocol: "https", hostname: "crests.football-data.org", pathname: "/**" },
    ],
  },
};

export default nextConfig;
