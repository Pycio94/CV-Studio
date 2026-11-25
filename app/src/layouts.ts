import type { CvDocument } from './model'

export type SidebarSection = 'contacts' | 'education' | 'languages' | 'skills'
export type MainSection = 'summary' | 'experience' | 'education'

export interface LayoutDefinition {
  id: CvDocument['layout']
  label: string
  paged: boolean
  showContactHeading: boolean
  showSummaryHeading: boolean
  sidebarSections: readonly SidebarSection[]
  mainSections: readonly MainSection[]
}

export const layouts: readonly LayoutDefinition[] = [
  {
    id: 'classic',
    label: 'Classic',
    paged: true,
    showContactHeading: true,
    showSummaryHeading: true,
    sidebarSections: ['contacts', 'education', 'languages', 'skills'],
    mainSections: ['summary', 'experience'],
  },
  {
    id: 'ats',
    label: 'ATS-friendly',
    paged: false,
    showContactHeading: true,
    showSummaryHeading: true,
    sidebarSections: ['contacts', 'education', 'languages', 'skills'],
    mainSections: ['summary', 'experience'],
  },
  {
    id: 'timeline',
    label: 'Timeline',
    paged: true,
    showContactHeading: false,
    showSummaryHeading: false,
    sidebarSections: ['contacts', 'skills', 'languages'],
    mainSections: ['summary', 'experience', 'education'],
  },
] as const

export function getLayout(id: CvDocument['layout'] | undefined): LayoutDefinition {
  return layouts.find(layout => layout.id === id) ?? layouts[0]!
}

export function isPagedLayout(id: CvDocument['layout'] | undefined): boolean {
  return getLayout(id).paged
}
