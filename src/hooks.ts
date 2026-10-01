import { useMemo } from 'react'
import type { RoadmapStep, StepStatus } from './types'
import { useStore } from './store'
import { useI18n } from './i18n'
import { deriveActions, generateRoadmap } from './services/engines'

/** Shared by Home, AI Analysis and Risks & Actions: one source of truth for steps and tasks. */
export function useRoadmap() {
  const { lang } = useI18n()
  const { profile, stepOverrides } = useStore()
  return useMemo<RoadmapStep[]>(() => (profile ? generateRoadmap(profile).map((s) => ({ ...s, status: stepOverrides[s.id] ?? s.status })) : []), [profile, stepOverrides, lang])
}
/** Current actions from the risk analysis + finished actions whose risk has since disappeared (so progress never goes backwards). */
export function useActions() {
  const { lang } = useI18n()
  const { profile, employment, actionStatus, actionSnap } = useStore()
  return useMemo(() => {
    if (!profile) return []
    const live = deriveActions(profile, employment).map((a) => ({ ...a, status: actionStatus[a.id] ?? a.status }))
    const ids = new Set(live.map((a) => a.id))
    const kept = Object.entries(actionSnap).filter(([id]) => !ids.has(id) && actionStatus[id] === 'done').map(([id, s]) => ({ id, riskId: s.riskId, riskLabel: s.riskLabel, title: s.title, owner: s.owner, status: 'done' as StepStatus }))
    return [...live, ...kept]
  }, [profile, employment, actionStatus, actionSnap, lang])
}

