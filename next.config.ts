/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "yonodmc.in",
          },
        ],
        destination: "https://www.yonodmc.in/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
