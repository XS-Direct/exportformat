export interface MockField {
  id: string
  label: string
  value: string
}

export interface ExportModel {
  id?: number
  title: string
  type: 'download' | 'export'
  outputFormat: 'json' | 'custom'
  codeBefore: string
  repeatingCode: string
  codeAfter: string
  mockFields: MockField[]
}

const models = ref<ExportModel[]>([])
const activeModelId = ref<number | null>(null)
const loading = ref(false)

export function useModels() {
  const activeModel = computed(() =>
    models.value.find((m) => m.id === activeModelId.value) || null
  )

  async function fetchModels() {
    loading.value = true
    try {
      const data = await $fetch<ExportModel[]>('/api/models')
      models.value = data.map((m: any) => ({
        ...m,
        mockFields: typeof m.mockFields === 'string' ? JSON.parse(m.mockFields) : m.mockFields || [],
      }))
      if (models.value.length && !activeModelId.value) {
        activeModelId.value = models.value[0].id!
      }
    } finally {
      loading.value = false
    }
  }

  async function createModel() {
    const newModel: Omit<ExportModel, 'id'> = {
      title: 'Nieuw model',
      type: 'download',
      outputFormat: 'custom',
      codeBefore: '',
      repeatingCode: '',
      codeAfter: '',
      mockFields: [],
    }
    const created = await $fetch<ExportModel>('/api/models', {
      method: 'POST',
      body: newModel,
    })
    const parsed = {
      ...created,
      mockFields: typeof (created as any).mockFields === 'string'
        ? JSON.parse((created as any).mockFields)
        : (created as any).mockFields || [],
    }
    models.value.push(parsed)
    activeModelId.value = parsed.id!
  }

  async function updateModel(model: ExportModel) {
    await $fetch(`/api/models/${model.id}`, {
      method: 'PUT',
      body: {
        ...model,
        mockFields: JSON.stringify(model.mockFields),
      },
    })
  }

  async function deleteModel(id: number) {
    await $fetch(`/api/models/${id}`, { method: 'DELETE' })
    models.value = models.value.filter((m) => m.id !== id)
    if (activeModelId.value === id) {
      activeModelId.value = models.value[0]?.id || null
    }
  }

  return {
    models,
    activeModelId,
    activeModel,
    loading,
    fetchModels,
    createModel,
    updateModel,
    deleteModel,
  }
}
