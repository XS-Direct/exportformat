import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrate: {
    migrations: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL || `file:${path.join(__dirname, 'prisma', 'dev.db')}`,
  },
})
