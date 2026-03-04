import { isMonday, notMondayResponse } from '~/server/utils/monday'
import { usePrisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  if (!isMonday()) {
    return notMondayResponse()
  }

  const models = await usePrisma().exportModel.findMany({
    where: { type: 'export' },
    orderBy: { updatedAt: 'desc' },
  })

  return {
    skipped: false,
    date: new Date().toISOString(),
    count: models.length,
    models,
  }
})
