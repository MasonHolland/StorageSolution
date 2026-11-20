// Pluggable "photo → suggested items" step. v1 ships no model; later
// implementations (on-device ML, Gemini free tier, user's own Claude key)
// implement ItemSuggester and are registered in SUGGESTERS.

export interface SuggestedItem {
  name: string
  category?: string
  confidence: number
}

export interface ItemSuggester {
  id: string
  label: string
  /** False hides the "Suggest items" button. */
  available: boolean
  suggest(photo: Blob): Promise<SuggestedItem[]>
}

export const NoopSuggester: ItemSuggester = {
  id: 'none',
  label: 'Off (enter items by hand)',
  available: false,
  async suggest() {
    return []
  },
}

export const SUGGESTERS: ItemSuggester[] = [NoopSuggester]

export function getSuggester(id: string | undefined): ItemSuggester {
  return SUGGESTERS.find((s) => s.id === id) ?? NoopSuggester
}
