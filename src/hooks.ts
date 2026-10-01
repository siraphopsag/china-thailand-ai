import { useMemo } from 'react'
import type { ActionItem, RoadmapStep, StepStatus } from './types'
import { useStore } from './store'
import { useI18n } from './i18n'
import { deriveActions, generateRoadmap, targetCountry } from './services/engines'
import { buildPlan, ecStarted, employeeActions, evaluateEmployeeCheck, planActions, type PlanItem } from './services/compliance'

/** Shared by Home, AI Analysis and Risks & Actions: one source of truth for steps and tasks. */
export function useRoadmap() {
  const { lang } = useI18n()
  const { profile, stepOverrides } = useStore()
  return useMemo<RoadmapStep[]>(() => (profile ? generateRoadmap(profile).map((s) => ({ ...s, status: stepOverrides[s.id] ?? s.status })) : []), [profile, stepOverrides, lang])
}
/** The action plan: applicable requirements in dependency order, with documents, authority, source, status and next step. */
export function usePlan(): PlanItem[] {
  const { lang } = useI18n()
  const { profile, employeeCheck, actionStatus, docStatus } = useStore()
  return useMemo(() => (profile ? buildPlan(profile, employeeCheck, actionStatus, docStatus, lang) : []), [profile, employeeCheck, actionStatus, docStatus, lang])
}
/** Risk checks whose follow-up is not already a requirement in the plan (those stay as their own tasks). */
const OWN_RISK_TASKS = ['nominee', 'ownership', 'language', 'culture']
/** Every task of the case: plan steps first, then the employee check, then the remaining risk follow-ups;
 *  plus finished tasks whose source has since disappeared (so progress never goes backwards). */
export function useActions(): ActionItem[] {
  const { lang } = useI18n()
  const { profile, employment, actionStatus, actionSnap, employeeCheck } = useStore()
  const plan = usePlan()
  return useMemo(() => {
    if (!profile) return []
    const ec = ecStarted(employeeCheck) ? employeeActions(evaluateEmployeeCheck(employeeCheck, targetCountry(profile))) : []
    const risk = deriveActions(profile, employment).filter((a) => OWN_RISK_TASKS.includes(a.riskId))
    const live = [...planActions(plan), ...ec, ...risk].map((a) => ({ ...a, status: actionStatus[a.id] ?? a.status }))
    const ids = new Set(live.map((a) => a.id))
    const kept = Object.entries(actionSnap).filter(([id]) => !ids.has(id) && actionStatus[id] === 'done').map(([id, s]) => ({ id, riskId: s.riskId, riskLabel: s.riskLabel, title: s.title, owner: s.owner, status: 'done' as StepStatus }))
    return [...live, ...kept]
  }, [profile, employment, actionStatus, actionSnap, employeeCheck, plan, lang])
}
