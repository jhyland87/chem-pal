// jest.config.js
export default {
  //roots: ['./'],
  //  preset: 'babel-jest',
  // jest-fixed-jsdom
  //jsdom
  testEnvironment: "jest-fixed-jsdom", // jest-fixed-jsdom
  transform: {
    "^.+\\.(ts|tsx)?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.node.json",
      },
    ],
    //'^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
    "^.+\\.svg$": "jest-transformer-svg",
    // "^icons/(.*)$": "<rootDir>/src/assets/icons/$1",
    // "^types/(.*)$": "<rootDir>/src/types/$1",
    // "^constants/(.*)$": "<rootDir>/src/constants/$1",
    // "^helpers/(.*)$": "<rootDir>/src/helpers/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/dev", "<rootDir>/src/.*/__fixtures__/.*"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.(ts|tsx)$",
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.ts", "src/**/*.tsx"],
  coverageDirectory: "<rootDir>/coverage",
  coveragePathIgnorePatterns: [
    "node_modules",
    "test-config",
    "interfaces",
    "jestGlobalMocks.ts",
    "__fixtures__",
    "__mocks__",
    "src/types",
    "src/constants",
  ],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 30,
      lines: 40, // Will be raised as I make more tests
      statements: 40, // Will be raised as I make more tests
    },
  },
};
