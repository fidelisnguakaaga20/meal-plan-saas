import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Prevent ESLint errors from failing the Vercel build
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    remotePatterns: [
      // Your existing Clerk image host
      {
        protocol: "https",
        hostname: "img.clerk.com",
        pathname: "/**",
      },
      // (Optional) clerk account domains (avatars, assets)
      {
        protocol: "https",
        hostname: "*.clerk.accounts.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;


// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// images: {
//   remotePatterns: [
//     {
//       protocol: "https",
//       port: "",
//       pathname: "/**",
//       hostname: "img.clerk.com",
//     },
//   ],
// },
// };

// export default nextConfig;
