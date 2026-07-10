// Pulls in Vite's ambient client types (import.meta.env/glob, *.scss and asset
// module declarations). Uses a side-effect import rather than a triple-slash
// `types="vite/client"` reference because tsconfig.app.json overrides `typeRoots`
// to only @types + src/types, which the reference form can't resolve.
import "vite/client";
