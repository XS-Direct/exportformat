import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  return await prisma.exportModel.findMany({
    orderBy: { updatedAt: 'desc' },
  })
})
