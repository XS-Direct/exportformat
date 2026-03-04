import { usePrisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  return await usePrisma().exportModel.findMany({
    orderBy: { updatedAt: 'desc' },
  })
})
