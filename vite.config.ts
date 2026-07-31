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
              maxSize: 400_000,
              // Service modules import shared domain, currency, media, and
              // evidence-policy helpers. Keeping those dependencies with the
              // service boundary prevents an app -> service -> app cycle.
              includeDependenciesRecursively: true,
            },
          ],
        },
      },
    },
  },
});
