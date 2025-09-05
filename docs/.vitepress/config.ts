import autoprefixer from 'autoprefixer';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Altus 4',
  description: 'AI-Enhanced Search Engine',
  base: '/docs/',
  ignoreDeadLinks: false,

  // Configure Vite for VitePress
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../../src', import.meta.url)),
      },
    },
    css: {
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
    },
  },

  // Enable Vue support
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: tag => tag.includes('-'),
      },
    },
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Main Site', link: 'https://altus4.thavarshan.com' },
      { text: 'Quick Start', link: '/setup/' },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'Authentication', link: '/api/authentication' },
          { text: 'Search', link: '/api/search' },
          { text: 'Database Management', link: '/api/database' },
          { text: 'Analytics', link: '/api/analytics' },
        ],
      },
      { text: 'Architecture', link: '/architecture/' },
      { text: 'Examples', link: '/examples/' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Installation & Setup', link: '/setup/' },
          { text: 'Quick Start Guide', link: '/setup/quickstart' },
        ],
      },
      {
        text: 'Architecture',
        collapsed: false,
        items: [
          { text: 'System Overview', link: '/architecture/' },
          { text: 'Service Layer', link: '/architecture/services' },
          { text: 'Database Design', link: '/architecture/database' },
          { text: 'Security Model', link: '/architecture/security' },
        ],
      },
      {
        text: 'API Reference',
        collapsed: false,
        items: [
          { text: 'API Overview', link: '/api/' },
          { text: 'Authentication', link: '/api/authentication' },
          { text: 'Search Operations', link: '/api/search' },
          { text: 'Database Management', link: '/api/database' },
          { text: 'Analytics & Insights', link: '/api/analytics' },
          { text: 'Error Handling', link: '/api/errors' },
          { text: 'Rate Limiting', link: '/api/rate-limiting' },
        ],
      },
      {
        text: 'Services Documentation',
        collapsed: true,
        items: [
          { text: 'Service Overview', link: '/services/' },
          { text: 'SearchService', link: '/services/search-service' },
          { text: 'DatabaseService', link: '/services/database-service' },
          { text: 'AIService', link: '/services/ai-service' },
          { text: 'CacheService', link: '/services/cache-service' },
          { text: 'UserService', link: '/services/user-service' },
          { text: 'ApiKeyService', link: '/services/apikey-service' },
        ],
      },
      {
        text: 'Development',
        collapsed: true,
        items: [
          { text: 'Development Guide', link: '/development/' },
          { text: 'Git Workflow', link: '/development/git-workflow' },
          { text: 'Code Standards', link: '/development/standards' },
          { text: 'Testing Strategy', link: '/development/testing' },
          { text: 'Contributing', link: '/development/contributing' },
        ],
      },
      {
        text: 'Examples & Tutorials',
        collapsed: true,
        items: [
          { text: 'Examples Overview', link: '/examples/' },
          { text: 'Basic Search', link: '/examples/basic-search' },
          { text: 'Advanced Queries', link: '/examples/advanced-queries' },
          { text: 'AI Integration', link: '/examples/ai-integration' },
          { text: 'Multi-Database Search', link: '/examples/multi-database' },
          { text: 'SDK Usage', link: '/examples/sdk' },
        ],
      },
      {
        text: 'Deployment',
        collapsed: true,
        items: [
          { text: 'Production Setup', link: '/deployment/production' },
          { text: 'Docker Deployment', link: '/deployment/docker' },
          { text: 'Monitoring & Logging', link: '/deployment/monitoring' },
          { text: 'Scaling', link: '/deployment/scaling' },
        ],
      },
      {
        text: 'Testing',
        collapsed: true,
        items: [
          { text: 'Testing Overview', link: '/testing/' },
          { text: 'Unit Testing', link: '/testing/unit' },
          { text: 'Integration Testing', link: '/testing/integration' },
          { text: 'Performance Testing', link: '/testing/performance' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/altus4/core' }],
  },
});
