// jest.config.js
export default {
  //roots: ['./'],
  //  preset: 'babel-jest',
  // jest-fixed-jsdom
  //jsdom
  testEnvironment: "jest-fixed-jsdom", // jest-fixed-jsdom
  transform: {
    //'^.+\\.(ts|tsx)?$': 'ts-jest'
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
    "^.+\\.svg$": "jest-transformer-svg",
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|tsx)$',
}