/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.aladin.co.kr" },
      { protocol: "https", hostname: "bookthumb-phinf.pstatic.net" },
      { protocol: "https", hostname: "data4library.kr" },
      { protocol: "https", hostname: "www.data4library.kr" },
      { protocol: "https", hostname: "www.nl.go.kr" },
      { protocol: "https", hostname: "nl.go.kr" },
      { protocol: "http", hostname: "image.aladin.co.kr" },
      { protocol: "http", hostname: "bookthumb-phinf.pstatic.net" },
      { protocol: "http", hostname: "data4library.kr" },
    ],
  },
};

export default nextConfig;
