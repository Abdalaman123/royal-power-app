import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * SEO helper: fills __SITE_URL__ in index.html and writes robots.txt + sitemap.xml with absolute URLs.
 * Site address = VITE_SITE_URL (your own domain, optional) or the URL Netlify provides automatically.
 */
function seoPlugin(siteUrl: string): Plugin {
  const base = siteUrl.replace(/\/+$/, '')
  const pages = [
    { path: '/', priority: '1.0' },
    { path: '/request/new', priority: '0.9' },
    { path: '/catalog', priority: '0.8' },
    { path: '/sops', priority: '0.7' },
    { path: '/about', priority: '0.6' },
    { path: '/track', priority: '0.5' },
  ]
  return {
    name: 'royal-power-seo',
    transformIndexHtml: { order: 'pre', handler: (html: string) => html.replace(/__SITE_URL__/g, base) },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: ['User-agent: *', 'Allow: /', 'Disallow: /admin', ...(base ? [`Sitemap: ${base}/sitemap.xml`] : []), ''].join('\n'),
      })
      if (base) {
        const urls = pages
          .map((p) => `  <url><loc>${base}${p.path === '/' ? '/' : p.path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${p.priority}</priority></url>`)
          .join('\n')
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = process.env.VITE_SITE_URL || env.VITE_SITE_URL || process.env.URL || ''
  return {
    plugins: [react(), seoPlugin(siteUrl)],
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
