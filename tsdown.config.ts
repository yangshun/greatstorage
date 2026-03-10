import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/core-entry.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
});
