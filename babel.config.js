export default {
  presets: [["@babel/preset-env", { targets: { node: "current" } }], "@babel/preset-react"],
  plugins: [
    //["@babel/plugin-transform-private-methods", { loose: true }],
    "@babel/plugin-proposal-class-properties",
  ],
};
