import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    files: ["components/book-preview/book-preview.tsx"],
    rules: {
      // The shell intentionally keeps the active engine's ComponentType in
      // state (lazy-loaded adapters) — the React Compiler cannot compile it,
      // so manual memoization cannot be verified by design.
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]

export default eslintConfig
