import { exampleDocument, newId, parseDocument, type CvDocument, type Item } from './model'

function content(element: Element | null | undefined): string {
  return element?.textContent?.trim() ?? ''
}

function percentage(element: Element): string {
  return (element.querySelector('.percent div') as HTMLElement | null)?.style.width ?? ''
}

function item(label: string, detail = ''): Item {
  return { id: newId(), label, detail }
}

export function importLegacy(html: string): CvDocument {
  const template = document.createElement('template')
  template.innerHTML = html
  const root = template.content.querySelector('.container')
  const profile = root?.querySelector('.profileDesc h2')
  if (!root || !profile || !root.querySelector('.right_Side .about')) {
    throw new Error('This does not look like the original CV HTML.')
  }

  const doc = exampleDocument()
  doc.documentName = 'Imported CV'
  doc.name = Array.from(profile.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent?.trim() ?? '').join(' ').trim()
  doc.title = content(profile.querySelector('span'))
  doc.summary = ''
  doc.photo = ''
  doc.contacts = Array.from(root.querySelectorAll('.contact:not(.education):not(.language) li')).map(li => {
    const link = li.querySelector('a')
    return {
      id: newId(),
      label: '',
      value: content(link ?? li.querySelector('.text')),
      url: link?.getAttribute('href') ?? '',
    }
  })
  doc.education = Array.from(root.querySelectorAll('.education li')).map(li => {
    const lines = Array.from(li.querySelectorAll('h4, h5')).map(content).filter(Boolean)
    return item(lines[1] ?? lines[0] ?? '', [lines[2], lines[0]].filter(Boolean).join(' | '))
  })
  doc.languages = Array.from(root.querySelectorAll('.language li'))
    .map(li => item(content(li.querySelector('.text')), percentage(li)))
  doc.experience = Array.from(root.querySelectorAll('.right_Side > .about:not(.skills) .box')).map(box => {
    const datesAndCompany = box.querySelectorAll('.year_exp h5')
    return {
      id: newId(),
      title: content(box.querySelector('.text h4')),
      dates: content(datesAndCompany[0]),
      company: content(datesAndCompany[1]),
      description: content(box.querySelector('.text p')),
      bullets: Array.from(box.querySelectorAll('.text li')).map(li => item(content(li))),
    }
  })
  doc.skills = Array.from(root.querySelectorAll('.skills .box'))
    .map(box => item(content(box.querySelector('h4')), percentage(box)))
  doc.consent = content(root.querySelector('.footer p'))
  doc.showConsent = Boolean(doc.consent)
  doc.headings.contact = content(root.querySelector('.contact:not(.education):not(.language) .title')) || 'Contact'
  doc.headings.education = content(root.querySelector('.education .title')) || 'Education'
  doc.headings.languages = content(root.querySelector('.language .title')) || 'Languages'
  doc.headings.experience = content(root.querySelector('.right_Side > .about:not(.skills) .title2')) || 'Experience'
  doc.headings.skills = content(root.querySelector('.skills .title2')) || 'Skills'
  return parseDocument(doc)
}
