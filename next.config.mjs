/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server, so the runtime image carries only what it
  // needs instead of the whole node_modules tree.
  output: 'standalone',
}

export default nextConfig
