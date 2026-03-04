import { isMonday, notMondayResponse } from '~/server/utils/monday'
import { usePrisma } from '~/server/utils/prisma'

export default defineEventHandler(async () => {
  if (!isMonday()) {
    return notMondayResponse()
  }

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const [total, recentlyUpdated] = await Promise.all([
    usePrisma().exportModel.count(),
    usePrisma().exportModel.findMany({
      where: { updatedAt: { gte: oneWeekAgo } },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  return {
    skipped: false,
    date: new Date().toISOString(),
    summary: {
      totalModels: total,
      updatedLastWeek: recentlyUpdated.length,
      models: recentlyUpdated,
    },
  }
})
