export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  ssr: false,
  compatibilityDate: '2024-11-01',
  nitro: {
    rollupConfig: {
      external: ['@prisma/client', '@prisma/adapter-mariadb', 'mariadb'],
    },
  },
})
