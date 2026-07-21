/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // running a staging-pointed `next dev` alongside the normal one (same repo
  // checkout, different port/env) was silently corrupting both — two `next
  // dev` processes writing to the same .next directory fight over the route
  // manifest and webpack cache. STAGING_DIST=1 (set only when launching the
  // staging server) isolates its build output so the two never collide.
  distDir: process.env.STAGING_DIST ? ".next-staging" : ".next",
};
export default nextConfig;
