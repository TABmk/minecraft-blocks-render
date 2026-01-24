import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
  compilerOptions: {
    warningFilter: (warning) => !warning.code.startsWith('a11y')
  },
  kit: {
    paths: {
      assets: '',
      base: "/minecraft-blocks-render",
      relative: true,
    },
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
