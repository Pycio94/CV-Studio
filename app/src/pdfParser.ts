import { exampleDocument, newId, type Contact, type CvDocument, type Experience, type Item } from './model'

type PdfSection = 'contact' | 'summary' | 'experience' | 'education' | 'skills' | 'languages' | 'consent'

const sectionAliases: Record<PdfSection, string[]> = {
  contact: ['contact', 'contact details', 'contact information', 'personal details', 'dane kontaktowe', 'kontakt'],
  summary: ['summary', 'professional summary', 'profile', 'professional profile', 'about me', 'objective', 'profil zawodowy', 'podsumowanie', 'o mnie'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'work history', 'career history', 'doswiadczenie', 'doswiadczenie zawodowe', 'zatrudnienie'],
  education: ['education', 'education and training', 'academic background', 'wyksztalcenie', 'edukacja'],
  skills: ['skills', 'technical skills', 'key skills', 'competencies', 'competences', 'umiejetnosci', 'kompetencje'],
  languages: ['languages', 'language skills', 'jezyki', 'jezyki obce'],
  consent: ['consent', 'data protection', 'privacy notice', 'gdpr', 'rodo'],
}

const dateRange = /\b(?:19|20)\d{2}\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|now)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{4}\s*(?:[-–—]\s*(?:present|current|now|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{4}))?/i
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const urlPattern = /(?:https?:\/\/|www\.)[^\s,;|]+|(?:linkedin\.com|github\.com)\/[^\s,;|]+/gi
const phonePattern = /(?:\+\s*)?\d[\d\s()./-]{5,}\d/g
const maxItems = 100
const maxTextLength = 10_000

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function sectionFor(value: string): PdfSection | undefined {
  const heading = normalize(value)
  for (const [section, aliases] of Object.entries(sectionAliases) as [PdfSection, string[]][]) {
    if (aliases.some(alias => heading === alias || heading.startsWith(`${alias} `))) return section
  }
  return undefined
}

function headingInLine(value: string): { section: PdfSection; content: string } | undefined {
  const separator = value.indexOf(':')
  if (separator > 0 && separator < 40) {
    const inlineSection = sectionFor(value.slice(0, separator))
    if (inlineSection) return { section: inlineSection, content: value.slice(separator + 1).trim() }
  }
  const section = sectionFor(value)
  if (section) return { section, content: '' }
  return undefined
}

function isConsentText(value: string): boolean {
  const normalized = normalize(value)
  return normalized.includes('wyrazam zgode na przetwarzanie')
    || normalized.includes('i hereby consent')
    || normalized.includes('consent to the processing')
}

function isPageNumber(value: string): boolean {
  return /^page\s+\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(value)
    || /^\d+\s*\/\s*\d+$/.test(value)
}

function appendUniqueContact(contacts: Contact[], label: string, value: string, url = '') {
  const cleanValue = value.trim().replace(/[),.;]+$/, '')
  if (!cleanValue || contacts.some(contact => contact.value.toLowerCase() === cleanValue.toLowerCase())) return
  contacts.push({ id: newId(), label, value: cleanValue, url })
}

function matches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0
  const found = pattern.test(value)
  pattern.lastIndex = 0
  return found
}

function extractContacts(intro: string[], contactLines: string[]): Contact[] {
  const contacts: Contact[] = []
  for (const line of [...intro.map(value => ({ value, inContactSection: false })), ...contactLines.map(value => ({ value, inContactSection: true }))]) {
    const emailMatches = line.value.match(emailPattern) ?? []
    const urlMatches = line.value.match(urlPattern) ?? []
    const phoneMatches = line.value.match(phonePattern) ?? []
    let found = false

    for (const email of emailMatches) {
      appendUniqueContact(contacts, 'Email', email, `mailto:${email}`)
      found = true
    }
    for (const candidate of urlMatches) {
      const url = candidate.replace(/[),.;]+$/, '')
      const href = /^https?:\/\//i.test(url) ? url : `https://${url}`
      appendUniqueContact(contacts, /linkedin/i.test(url) ? 'LinkedIn' : 'Website', url, href)
      found = true
    }
    for (const phone of phoneMatches) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15 || /^\s*(?:19|20)\d{2}\s*[-–—/]\s*(?:19|20)\d{2}\s*$/.test(phone)) continue
      appendUniqueContact(contacts, 'Phone', phone)
      found = true
    }

    const location = line.value.match(/^(?:location|address|city|based in|lokalizacja|adres|miasto)\s*[:|-]\s*(.+)$/i)
    if (location?.[1]) {
      appendUniqueContact(contacts, 'Location', location[1])
      found = true
    }
    if (line.inContactSection && !found && line.value.trim()) {
      appendUniqueContact(contacts, 'Contact', line.value)
    }
  }
  return contacts
}

function stripResumePrefix(value: string): string {
  return value.replace(/^(?:curriculum vitae|resume|cv)(?:\s+(?:of|for))?\s*[:|-]?\s*/i, '').trim()
}

function isContactLine(value: string): boolean {
  return matches(emailPattern, value)
    || matches(urlPattern, value)
    || matches(phonePattern, value)
    || /^(?:email|e-mail|phone|mobile|telephone|tel|telefon|address|location|linkedin|website|name|full name|title|position|imi[eę]|nazwisko)\s*[:|-]/i.test(value)
}

function isLikelyName(value: string): boolean {
  const words = value.trim().split(/\s+/)
  return words.length >= 2 && words.length <= 5 && value.length <= 60
    && !/\d|[,@]/.test(value)
    && /^[\p{L}\p{M} .'-]+$/u.test(value)
}

function makeItem(value: string, kind: 'education' | 'skill' | 'language'): Item {
  const line = value.replace(/^[•▪◦*-]\s*/, '').trim()
  const pipeParts = line.split(/\s*[|]\s*/).filter(Boolean)
  if (pipeParts.length > 1) return { id: newId(), label: pipeParts[0]!, detail: pipeParts.slice(1).join(' | ') }

  const colon = line.match(/^([^:]{1,60}):\s*(.+)$/)
  if (colon) return { id: newId(), label: colon[1]!.trim(), detail: colon[2]!.trim() }

  if (kind === 'language') {
    const parentheses = line.match(/^(.+?)\s*\(([^)]+)\)$/)
    if (parentheses) return { id: newId(), label: parentheses[1]!.trim(), detail: parentheses[2]!.trim() }
  }

  const dash = line.match(/^(.+?)\s+[–—-]\s+(.+)$/)
  if (dash && kind !== 'skill') return { id: newId(), label: dash[1]!.trim(), detail: dash[2]!.trim() }
  return { id: newId(), label: line, detail: '' }
}

function parseItems(lines: string[], kind: 'education' | 'skill' | 'language'): Item[] {
  const items: Item[] = []
  const sourceLines: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const previous = sourceLines[sourceLines.length - 1]
    if (kind === 'education' && previous && /[|,;–—-]\s*$/.test(previous)) {
      sourceLines[sourceLines.length - 1] = `${previous} ${line}`
    } else {
      sourceLines.push(line)
    }
  }
  for (const line of sourceLines) {
    const values = kind === 'education'
      ? [line]
      : line.split(/[;,•]/).map(value => value.trim()).filter(Boolean)
    for (const value of values) {
      if (/^(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present|current)$/i.test(value) && items.length) {
        const previous = items[items.length - 1]!
        previous.detail = [previous.detail, value].filter(Boolean).join(' | ')
      } else {
        items.push(makeItem(value, kind))
      }
    }
  }
  if (items.length > maxItems) throw new Error('This PDF contains too many entries in one section to import.')
  return items
}

function isLikelyHeader(value: string): boolean {
  return value.length <= 100 && !/^[•▪◦*-]\s*/.test(value) && !/[.!?]$/.test(value)
}

function parseExperience(lines: string[]): Experience[] {
  const records: string[][] = []
  let current: string[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const match = dateRange.exec(line)
    dateRange.lastIndex = 0
    if (match && current.some(value => dateRange.test(value))) {
      dateRange.lastIndex = 0
      const hasInlineHeader = line.slice(0, match.index).trim().length > 0
      const header = !hasInlineHeader && current.length && isLikelyHeader(current[current.length - 1]!)
        ? [current.pop()!]
        : []
      records.push(current)
      current = [...header, line]
    } else {
      dateRange.lastIndex = 0
      current.push(line)
    }
  }
  if (current.length) records.push(current)
  if (records.length > maxItems) throw new Error('This PDF contains too many work-history entries to import.')

  return records.map(record => {
    let date = ''
    let title = ''
    let company = ''
    const descriptionLines: string[] = []
    const bullets: Item[] = []
    const dateLineIndex = record.findIndex(line => dateRange.test(line))
    dateRange.lastIndex = 0

    if (dateLineIndex >= 0) {
      const dateLine = record[dateLineIndex]!
      const match = dateRange.exec(dateLine)
      dateRange.lastIndex = 0
      if (match) {
        date = match[0]
        const prefix = dateLine.slice(0, match.index).replace(/[|•,–—-]+\s*$/, '').trim()
        const suffix = dateLine.slice(match.index + match[0].length).replace(/^[|•,–—-]+\s*/, '').trim()
        const header = prefix ? [prefix] : record.slice(0, dateLineIndex).filter(Boolean)
        const parts = (header[0] ?? '').split(/\s*[|•]\s*|\s+[–—-]\s+|\s*,\s*/).filter(Boolean)
        const at = (header[0] ?? '').match(/^(.+?)\s+(?:at|@)\s+(.+)$/i)
        title = parts[0] ?? ''
        company = parts[1] ?? ''
        if (at) {
          title = at[1]!.trim()
          company = at[2]!.trim()
        } else if (!prefix && header[1]) {
          company = header[1]
          descriptionLines.push(...header.slice(2))
        }
        descriptionLines.push(...record.slice(dateLineIndex + 1))
        if (suffix) descriptionLines.unshift(suffix)
        if (prefix && record.slice(0, dateLineIndex).length) {
          descriptionLines.unshift(...record.slice(0, dateLineIndex).filter(Boolean))
        }
      }
    } else {
      const header = record.filter(Boolean)
      title = header[0] ?? ''
      if (header.length > 1 && isLikelyHeader(header[1]!)) company = header[1]!
      descriptionLines.push(...header.slice(company ? 2 : 1))
    }

    const description: string[] = []
    for (const raw of descriptionLines) {
      const bullet = raw.match(/^[•▪◦*-]\s*(.+)$/)
      if (bullet?.[1]) bullets.push({ id: newId(), label: bullet[1].trim(), detail: '' })
      else description.push(raw.trim())
    }
    return {
      id: newId(),
      title: title.trim(),
      company: company.trim(),
      dates: date.trim(),
      description: description.filter(Boolean).join('\n'),
      bullets,
    }
  })
}

function validateLengths(doc: CvDocument): CvDocument {
  const textValues = [
    doc.documentName, doc.name, doc.title, doc.summary, doc.consent,
    ...doc.contacts.flatMap(contact => [contact.label, contact.value, contact.url]),
    ...doc.experience.flatMap(entry => [entry.title, entry.company, entry.dates, entry.description, ...entry.bullets.flatMap(bullet => [bullet.label, bullet.detail])]),
    ...doc.education.flatMap(item => [item.label, item.detail]),
    ...doc.skills.flatMap(item => [item.label, item.detail]),
    ...doc.languages.flatMap(item => [item.label, item.detail]),
  ]
  if (textValues.some(value => value.length > maxTextLength)) {
    throw new Error('A PDF section is too long to import. Use a shorter PDF or split its content.')
  }
  return doc
}

export function parsePdfText(text: string, fileName: string): CvDocument {
  const sections: Record<PdfSection, string[]> = {
    contact: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    languages: [],
    consent: [],
  }
  const intro: string[] = []
  const previousSections: (PdfSection | undefined)[] = []

  for (const page of text.split('\v')) {
    const columns = page.split('\f')
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      let current = columns.length === 1 && previousSections.length > 1
        ? previousSections[1] ?? previousSections[0]
        : previousSections[columnIndex]
      for (const raw of columns[columnIndex]!.split(/\r?\n/)) {
        const line = raw.replace(/\s+/g, ' ').trim()
        if (!line) {
          if (current) sections[current].push('')
          else intro.push('')
          continue
        }
        if (isPageNumber(line)) continue
        const heading = headingInLine(line)
        if (heading) {
          current = heading.section
          if (heading.content) sections[current].push(heading.content)
          continue
        }
        if (isConsentText(line)) {
          current = 'consent'
          sections.consent.push(line)
          continue
        }
        if (current) sections[current].push(line)
        else intro.push(line)
      }
      previousSections[columnIndex] = current
    }
  }

  const doc = exampleDocument()
  const fileLabel = fileName.replace(/\.[^.]+$/, '').trim()
  doc.documentName = fileLabel || 'Imported PDF CV'
  doc.name = ''
  doc.title = ''
  doc.summary = sections.summary.filter(Boolean).join('\n').trim()
  doc.contacts = extractContacts(intro, sections.contact)
  doc.experience = parseExperience(sections.experience)
  doc.education = parseItems(sections.education, 'education')
  doc.skills = parseItems(sections.skills, 'skill')
  doc.languages = parseItems(sections.languages, 'language')
  doc.consent = sections.consent.filter(Boolean).join('\n').trim()
  doc.showConsent = Boolean(doc.consent)

  const labeledDetails = [...intro, ...sections.contact]
  const explicitName = labeledDetails
    .map(line => line.match(/^(?:name|full name|imi[eę]|nazwisko)\s*[:|-]\s*(.+)$/i)?.[1]?.trim())
    .find(Boolean)
  const explicitTitle = labeledDetails
    .map(line => line.match(/^(?:title|position|role|stanowisko|zaw[oó]d)\s*[:|-]\s*(.+)$/i)?.[1]?.trim())
    .find(Boolean)
  const headerLines = intro
    .map(stripResumePrefix)
    .filter(line => line && !isContactLine(line) && !sectionFor(line))
  const candidates = headerLines
    .filter(line => !/^(?:name|full name|imi[eę]|nazwisko|title|position|role|stanowisko|zaw[oó]d)\s*[:|-]/i.test(line))
    .flatMap(line => line.split(/\s+[|•]\s+/).map(value => value.trim()).filter(Boolean))

  doc.name = explicitName
    || candidates.find(isLikelyName)
    || candidates[0]
    || ''
  const nameIndex = candidates.indexOf(doc.name)
  doc.title = explicitTitle
    || candidates.find((line, index) => index > nameIndex && line !== doc.name && !line.includes(',') && line.length <= 100)
    || ''

  if (doc.contacts.length > maxItems) throw new Error('This PDF contains too many contact details to import.')
  return validateLengths(doc)
}
