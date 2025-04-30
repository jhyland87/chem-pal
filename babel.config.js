export default {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-react',
  ],
  plugins: ['@babel/plugin-proposal-private-methods', "@babel/plugin-proposal-class-properties"],
}