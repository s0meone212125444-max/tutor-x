/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Don't bundle these — they ship native .node binaries that webpack can't parse.
    serverComponentsExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
  },
};

export default nextConfig;
