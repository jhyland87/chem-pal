import "@testing-library/jest-dom";
Object.assign(global, require('jest-chrome'))

// global.chrome = {
//   tabs: {
//     query: async () => { throw new Error("Unimplemented.") };
//   }
// };