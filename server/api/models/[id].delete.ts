import { usePrisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  await usePrisma().exportModel.delete({
    where: { id },
  })

  return { success: true }
})
