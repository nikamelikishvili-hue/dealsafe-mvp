import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'deal-services',
              test: /src[\\/]services[\\/]/,
              priority: 20,
              maxSize: 240_000,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
});
