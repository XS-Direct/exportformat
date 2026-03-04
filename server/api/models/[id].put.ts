import { usePrisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  return await usePrisma().exportModel.update({
    where: { id },
    data: {
      title: body.title,
      type: body.type,
      outputFormat: body.outputFormat,
      codeBefore: body.codeBefore,
      repeatingCode: body.repeatingCode,
      codeAfter: body.codeAfter ?? '',
      mockFields: typeof body.mockFields === 'string'
        ? body.mockFields
        : JSON.stringify(body.mockFields || []),
    },
  })
})
