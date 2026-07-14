/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_CLOUD_HOSTED: process.env.VERCEL === "1" ? "1" : "",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    }
  }
  ,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-*.r2.dev",
        pathname: "/**",
      },
    ],
  },
}

export default nextConfig
