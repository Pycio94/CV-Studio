import { describe, expect, it } from 'vitest'
import { parsePdfText } from './pdfParser'

describe('parsePdfText', () => {
  it('maps common PDF CV sections into matching editor fields', () => {
    const doc = parsePdfText([
      'Jordan Example',
      'Senior Product Manager',
      'jordan@example.com',
      '+1 555 123 4567',
      'Profile',
      'Product leader with experience building useful products.',
      'Work Experience',
      'Product Manager | Acme Corp | 2021 - Present',
      'Led the product roadmap.',
      'Project Coordinator | Beta Corp | 2018 - 2021',
      'Supported product launches.',
      'Education',
      'BSc Computer Science | Example University | 2015 - 2019',
      'Skills',
      'Roadmapping, Analytics, Communication',
      'Languages',
      'English - Fluent; Polish - Native',
      'Consent',
      'I hereby consent to the processing of my personal data.',
    ].join('\n'), 'Jordan-Example.pdf')

    expect(doc.documentName).toBe('Jordan-Example')
    expect(doc.name).toBe('Jordan Example')
    expect(doc.title).toBe('Senior Product Manager')
    expect(doc.summary).toBe('Product leader with experience building useful products.')
    expect(doc.contacts.map(contact => [contact.label, contact.value])).toEqual([
      ['Email', 'jordan@example.com'],
      ['Phone', '+1 555 123 4567'],
    ])
    expect(doc.experience).toMatchObject([
      {
        title: 'Product Manager',
        company: 'Acme Corp',
        dates: '2021 - Present',
        description: 'Led the product roadmap.',
      },
      {
        title: 'Project Coordinator',
        company: 'Beta Corp',
        dates: '2018 - 2021',
        description: 'Supported product launches.',
      },
    ])
    expect(doc.education[0]).toMatchObject({
      label: 'BSc Computer Science',
      detail: 'Example University | 2015 - 2019',
    })
    expect(doc.skills.map(item => item.label)).toEqual(['Roadmapping', 'Analytics', 'Communication'])
    expect(doc.languages).toMatchObject([
      { label: 'English', detail: 'Fluent' },
      { label: 'Polish', detail: 'Native' },
    ])
    expect(doc.consent).toBe('I hereby consent to the processing of my personal data.')
    expect(doc.showConsent).toBe(true)
  })

  it('recognizes Polish section headings', () => {
    const doc = parsePdfText([
      'Anna Kowalska',
      'Profil zawodowy',
      'Doświadczona projektantka.',
      'Doświadczenie zawodowe',
      'Projektantka | Firma | 2020 - 2024',
      'Wykształcenie',
      'Projektowanie | Uniwersytet',
      'Umiejętności',
      'Figma, UX',
      'Języki obce',
      'Polski - ojczysty',
    ].join('\n'), 'cv.pdf')

    expect(doc.name).toBe('Anna Kowalska')
    expect(doc.summary).toBe('Doświadczona projektantka.')
    expect(doc.experience[0]?.title).toBe('Projektantka')
    expect(doc.education[0]?.label).toBe('Projektowanie')
    expect(doc.skills.map(item => item.label)).toEqual(['Figma', 'UX'])
    expect(doc.languages[0]).toMatchObject({ label: 'Polski', detail: 'ojczysty' })
  })

  it('preserves content after inline section headings', () => {
    const doc = parsePdfText([
      'Jordan Example',
      'Senior QA Specialist',
      'Profile: QA leader with experience building reliable products.',
      'Skills: Python, Playwright',
    ].join('\n'), 'cv.pdf')

    expect(doc.summary).toBe('QA leader with experience building reliable products.')
    expect(doc.skills.map(item => item.label)).toEqual(['Python', 'Playwright'])
  })
})
