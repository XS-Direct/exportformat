import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  return await prisma.exportModel.create({
    data: {
      title: body.title || 'Nieuw model',
      type: body.type || 'download',
      outputFormat: body.outputFormat || 'custom',
      codeBefore: body.codeBefore || '',
      repeatingCode: body.repeatingCode || '',
      codeAfter: body.codeAfter || '',
      mockFields: typeof body.mockFields === 'string'
        ? body.mockFields
        : JSON.stringify(body.mockFields || []),
    },
  })
})
