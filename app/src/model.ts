import { z } from 'zod'

const text = z.string().max(10000)
const item = z.object({ id: z.string().min(1), label: text, detail: text })
const contact = z.object({ id: z.string().min(1), label: text, value: text, url: text })
const experience = z.object({
  id: z.string().min(1),
  title: text,
  company: text,
  dates: text,
  description: text,
  bullets: z.array(item).max(100),
})

export const documentSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  documentName: text,
  name: text,
  title: text,
  summary: text,
  photo: z.string().max(3_000_000).refine(
    value => !value || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value),
    'Photo must be a PNG, JPEG, or WebP data URL.',
  ),
  layout: z.enum(['classic', 'ats', 'timeline']),
  experienceFontSize: z.union([z.literal(9.5), z.literal(10), z.literal(10.5)]).default(10.5),
  headings: z.object({
    contact: text,
    summary: text,
    experience: text,
    education: text,
    skills: text,
    languages: text,
  }),
  contacts: z.array(contact).max(100),
  experience: z.array(experience).max(100),
  education: z.array(item).max(100),
  skills: z.array(item).max(100),
  languages: z.array(item).max(100),
  consent: text,
  showConsent: z.boolean(),
})

export type CvDocument = z.infer<typeof documentSchema>
export type Item = z.infer<typeof item>
export type Contact = z.infer<typeof contact>
export type Experience = z.infer<typeof experience>
export type HeadingKey = keyof CvDocument['headings']

export function newId(): string {
  const browserCrypto = globalThis.crypto
  if (typeof browserCrypto?.randomUUID === 'function') return browserCrypto.randomUUID()
  if (typeof browserCrypto?.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable.')
  }

  const bytes = browserCrypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const newItem = (): Item => ({ id: newId(), label: '', detail: '' })
export const newContact = (): Contact => ({ id: newId(), label: '', value: '', url: '' })
export const newExperience = (): Experience => ({
  id: newId(), title: '', company: '', dates: '', description: '', bullets: [],
})

export function exampleDocument(): CvDocument {
  return {
    version: 1,
    id: newId(),
    documentName: 'Example CV',
    name: 'Alex Morgan',
    title: 'Software Developer',
    summary: 'Software developer focused on useful, reliable applications.',
    photo: '',
    layout: 'classic',
    experienceFontSize: 10.5,
    headings: {
      contact: 'Contact',
      summary: 'Profile',
      experience: 'Experience',
      education: 'Education',
      skills: 'Skills',
      languages: 'Languages',
    },
    contacts: [
      { id: newId(), label: 'Email', value: 'alex@example.com', url: 'mailto:alex@example.com' },
      { id: newId(), label: 'Location', value: 'Example City', url: '' },
    ],
    experience: [{
      id: newId(), title: 'Software Developer', company: 'Example Company',
      dates: '2021 - Present', description: 'Build and maintain web applications.',
      bullets: [{ id: newId(), label: 'Develop accessible user interfaces.', detail: '' }],
    }],
    education: [{ id: newId(), label: 'Computer Science', detail: 'Example University' }],
    skills: [{ id: newId(), label: 'JavaScript', detail: '' }, { id: newId(), label: 'Vue', detail: '' }],
    languages: [{ id: newId(), label: 'English', detail: 'Fluent' }],
    consent: '',
    showConsent: false,
  }
}

export function parseDocument(input: unknown): CvDocument {
  return documentSchema.parse(input)
}

export function cloneDocument(doc: CvDocument): CvDocument {
  return parseDocument(JSON.parse(JSON.stringify(doc)))
}

export function safeUrl(value: string): string | undefined {
  if (!value.trim()) return undefined
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}
