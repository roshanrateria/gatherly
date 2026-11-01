import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss()];
  try {
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch (error) {
    // Optional dev annotation plugin; absent in minimal checkouts. Log loudly
    // only when the failure would otherwise be silently ignored.
    console.debug('Skipping .vite-source-tags plugin:', error instanceof Error ? error.message : error);
  }

  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    build: {
      rollupOptions: {
        output: {
          /** React runtime lives in its own chunk: the framework rarely changes
              between app iterations, so browser caching keeps it hot. */
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
})
