import type { BriefStatus, BriefVersionWithContext } from './types'

const BRIEF_STATUS_LABELS: Record<BriefStatus, string> = {
  pending: 'Pending',
  pending_strategist: 'Pending Strategist',
  in_review: 'In Review',
  revision_requested: 'Revision Requested',
  done: 'Done',
  cancelled: 'Cancelled',
}

export function getBriefVersionLabel(version: number): string {
  return `Brief v${version}`
}

export function getBriefStatusLabel(status: BriefStatus): string {
  return BRIEF_STATUS_LABELS[status] ?? status.replace(/_/g, ' ')
}

export function formatBriefVersionDocument(version: BriefVersionWithContext): string {
  const sections = [
    `${getBriefVersionLabel(version.version)}: ${version.angle}`,
    `Status: ${getBriefStatusLabel(version.status)}`,
    `Assigned to: ${version.assigned_agent_name ?? 'Unassigned'}`,
    `Publish target: ${version.publish_at ?? 'Not scheduled'}`,
    `Research inputs: ${
      version.research_items.length > 0
        ? version.research_items.map((item) => item.title).join('; ')
        : 'None attached'
    }`,
    '',
    'Angle',
    version.angle,
    '',
    'Strategist Notes',
    version.voice_notes?.trim() || 'No strategist notes',
    '',
    'Revision Request',
    version.revision_notes?.trim() || 'No revision request',
  ]

  return sections.join('\n')
}
