/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 handles imports and vendor prefixing itself.
    '@tailwindcss/postcss': {},
  },
};

export default config;
