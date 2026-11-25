import { expect, test } from '@playwright/test'
import { getDocument, OPS, Util } from 'pdfjs-dist/legacy/build/pdf.mjs'

const legacyHtml = `<!doctype html><html><body>
<div class="container">
  <div class="left_Side">
    <div class="profileDesc"><h2>Fictional Person<br><span>Developer</span></h2></div>
    <div class="contact"><h3 class="title">Contact Info</h3><ul><li><span class="text">fictional@example.com</span></li></ul></div>
    <div class="contact education"><h3 class="title">Education</h3><ul><li><h5>2010 - 2014</h5><h4>Computing</h4><h4>Example School</h4></li></ul></div>
    <div class="contact language"><h3 class="title">Languages</h3><ul><li><span class="text">English</span><span class="percent"><div style="width: 80%"></div></span></li></ul></div>
  </div>
  <div class="right_Side">
    <div class="about"><h2 class="title2">Experience</h2><div class="box"><div class="year_exp"><h5>2020 - Present</h5><h5>Example Co</h5></div><div class="text"><h4>Engineer</h4><p>Build software.</p><ui><li>Vue</li></ui></div></div></div>
    <div class="about skills"><h2 class="title2">Skills</h2><div class="box"><h4>JavaScript</h4><div class="percent"><div style="width: 75%"></div></div></div></div>
  </div>
  <div class="footer"><p>Example consent.</p></div>
</div></body></html>`

test('starts when secure-context-only randomUUID is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: undefined })
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
})

test('edits, persists, exports, imports and preserves legacy data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByLabel('Full name').fill('Edited Example')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.reload()
  await expect(page.getByLabel('Full name')).toHaveValue('Edited Example')
  await expect(page.locator('.classic-pages .cv h1')).toHaveText('Edited Example')

  await page.getByText('Import, backup and reset').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  expect((await download).suggestedFilename()).toBe('Example-CV.json')
  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Choose original CV HTML').setInputFiles({
    name: 'cv.html', mimeType: 'text/html', buffer: Buffer.from(legacyHtml),
  })
  await expect(page.locator('.classic-pages .cv h1')).toHaveText('Fictional Person')
  await expect(page.locator('.classic-pages .cv')).toContainText('Example Co')
  await expect(page.locator('.classic-pages .cv')).toContainText('JavaScript - 75%')
  await expect(page.locator('.classic-pages .cv')).toContainText('English - 80%')
  await expect(page.locator('.classic-pages .cv')).toContainText('Example consent.')
  await expect(page.locator('.classic-pages .cv img')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.reload()
  await page.getByLabel('Choose CV').selectOption({ label: 'Imported CV' })
  await expect(page.locator('.classic-pages .cv h1')).toHaveText('Fictional Person')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
})

test('exports and restores the edited CV with its original reset state', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  const originalName = await page.getByLabel('Full name').inputValue()
  await page.getByLabel('Full name').fill('Portable edited name')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Import, backup and reset').click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).not.toBeNull()
  const fs = await import('node:fs/promises')
  const backup = JSON.parse(await fs.readFile(path!, 'utf8'))
  expect(backup).toMatchObject({
    format: 'cv-studio-backup',
    version: 1,
    document: { name: 'Portable edited name' },
    original: { name: originalName },
  })

  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Import JSON backup').setInputFiles(path!)
  await expect(page.getByLabel('Full name')).toHaveValue('Portable edited name')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset CV' }).click()
  await expect(page.getByLabel('Full name')).toHaveValue(originalName)
})

test('imports text from a PDF into matching CV sections', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Blob.prototype.arrayBuffer
    Object.defineProperty(Blob.prototype, 'arrayBuffer', {
      configurable: true,
      value: async function () {
        await new Promise(resolve => setTimeout(resolve, 300))
        return original.call(this)
      },
    })
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')

  const source = await page.context().newPage()
  await source.setContent(`
    <style>
      @page { size: A4; margin: 40px; }
      body { font: 12pt Arial, sans-serif; }
      h1, h2, p { margin: 0 0 8px; }
      .columns { display: grid; grid-template-columns: 1fr 2fr; gap: 35px; }
    </style>
    <h1>Jordan Example</h1>
    <p>Senior Product Manager</p>
    <p>jordan@example.com</p>
    <div class="columns">
      <aside>
        <h2>Skills</h2>
        <p>Roadmapping, Analytics</p>
        <h2>Languages</h2>
        <p>English - Fluent</p>
        <h2>Education</h2>
        <p>BSc Computer Science | Example University | 2015 - 2019</p>
      </aside>
      <main>
        <h2>Profile</h2>
        <p>Product leader with experience building useful products.</p>
        <h2>Work Experience</h2>
        <p>Product Manager | Acme Corp | 2021 - Present</p>
        <p>Led the product roadmap.</p>
        <p>Project Coordinator | Beta Corp | 2018 - 2021</p>
        <p>Supported product launches.</p>
      </main>
    </div>
  `)
  const pdf = await source.pdf({ format: 'A4' })
  await source.close()

  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Choose existing CV PDF').setInputFiles({
    name: 'Jordan-Example.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  })

  await expect(page.getByRole('status')).toHaveText('Importing PDF...')
  await expect(page.getByLabel('CV name')).toHaveValue('Jordan-Example')
  await expect(page.getByLabel('Full name')).toHaveValue('Jordan Example')
  await expect(page.getByLabel('Professional title')).toHaveValue('Senior Product Manager')
  await expect(page.getByLabel('Profile summary')).toHaveValue('Product leader with experience building useful products.')
  await expect(page.locator('.classic-pages .cv')).toContainText('jordan@example.com')
  await expect(page.locator('.classic-pages .cv')).toContainText('Acme Corp')
  await expect(page.locator('.classic-pages .cv')).toContainText('Beta Corp')
  await expect(page.locator('.classic-pages .cv .experience-entry')).toHaveCount(2)
  await expect(page.locator('.classic-pages .cv')).toContainText('BSc Computer Science')
  await expect(page.locator('.classic-pages .cv')).toContainText('Roadmapping')
  await expect(page.locator('.classic-pages .cv')).toContainText('English - Fluent')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
})

test('reports when a PDF has no selectable text', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')

  const source = await page.context().newPage()
  await source.setContent('<canvas width="300" height="100"></canvas>')
  const pdf = await source.pdf({ format: 'A4' })
  await source.close()

  await page.getByLabel('Choose existing CV PDF').setInputFiles({
    name: 'scanned-cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdf),
  })

  await expect(page.getByRole('alert')).toContainText('No selectable text found.')
  await expect(page.getByLabel('Choose CV').locator('option')).toHaveCount(1)
})

test('renders Timeline with contacts in the rail and education in the main column', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByLabel('Layout').selectOption('timeline')

  const preview = page.locator('.classic-pages .cv--timeline')
  await expect(preview).toHaveCount(1)
  await expect(preview.locator('.cv-sidebar')).toContainText('Example City')
  await expect(preview.locator('.cv-sidebar')).toContainText('JavaScript')
  await expect(preview.locator('.cv-sidebar')).not.toContainText('Computer Science')
  await expect(preview.locator('.cv-main')).toContainText('Computer Science')
  await expect(preview.locator('.cv-main')).toContainText('Build and maintain web applications.')
  expect(await preview.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('linear-gradient')

  const columns = await preview.evaluate(element => {
    const bounds = (selector: string) => {
      const target = element.querySelector<HTMLElement>(selector)
      if (!target) throw new Error(`Missing ${selector}`)
      const { left, right } = target.getBoundingClientRect()
      return { left, right }
    }
    const { left, right } = element.getBoundingClientRect()
    return {
      page: { left, right },
      sidebar: bounds('.cv-sidebar'),
      header: bounds('.cv-header'),
      main: bounds('.cv-main'),
    }
  })
  expect(columns.sidebar.left).toBeCloseTo(columns.page.left, 0)
  expect(columns.header.left).toBeCloseTo(columns.main.left, 0)
  expect(columns.header.left).toBeGreaterThan(columns.sidebar.left)
  expect(columns.header.right).toBeCloseTo(columns.page.right, 0)
})

test('keeps Timeline consent at the bottom, preserves 10pt print font, and pads Page 2 top', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByLabel('Layout').selectOption('timeline')
  await page.getByText('Section headings and consent').click()
  await page.getByLabel('Consent statement', { exact: true }).fill('Final Timeline consent.')
  await page.getByLabel('Include consent statement').check()
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await page.getByLabel('Description', { exact: true }).fill(
    Array.from({ length: 120 }, (_, i) => `Timeline continuation line ${i + 1}.`).join('\n'),
  )
  await expect(page.getByRole('status')).toHaveText('Saved locally')

  await page.emulateMedia({ media: 'print' })
  // Verify Timeline keeps 10pt (13.3333px) in print instead of jumping to 10.5pt, and Page 2 has safe top padding
  await expect(page.locator('.classic-pages .cv--timeline').first()).toHaveCSS('font-size', '13.3333px')
  const page2MainPaddingTop = await page.locator('.classic-pages .cv--timeline').nth(1).locator('.cv-main')
    .evaluate(el => parseFloat(getComputedStyle(el).paddingTop))
  expect(page2MainPaddingTop).toBeGreaterThan(45)

  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: false })
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
  const pdf = await loading.promise
  expect(pdf.numPages).toBeGreaterThan(1)
  const pages: { text: string; y: number }[][] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    pages.push(content.items.flatMap(item => {
      if (!('str' in item) || !item.str.trim()) return []
      return [{ text: item.str, y: item.transform[5] }]
    }))
  }
  expect(pages.slice(0, -1).flat().map(item => item.text).join(' ')).not.toContain('Final Timeline consent.')
  const consent = pages.at(-1)!.find(item => item.text.includes('Final Timeline consent.'))
  expect(consent?.y).toBeGreaterThan(10)
  expect(consent?.y).toBeLessThan(35)
  await loading.destroy()
})

test('uses the left-section color for Classic and Timeline consent', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Section headings and consent').click()
  await page.getByLabel('Consent statement', { exact: true }).fill('Color-matched consent.')
  await page.getByLabel('Include consent statement').check()

  for (const layout of ['classic', 'timeline']) {
    await page.getByLabel('Layout').selectOption(layout)
    const preview = page.locator(`.classic-pages .cv--${layout}`)
    const colors = await preview.evaluate(element => ({
      sidebar: getComputedStyle(element.querySelector('.cv-sidebar')!).backgroundColor,
      consent: getComputedStyle(element.querySelector('.cv-consent')!).backgroundColor,
    }))
    expect(colors.consent).toBe(colors.sidebar)
  }
})

test('prints complete A4 PDF independent of viewport width', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  const longText = Array.from({ length: 60 }, (_, i) => `Line ${i + 1}: Example experience description.`).join('\n')
  await page.getByLabel('Profile summary').fill(longText)
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Contact details' }) }).locator('summary').click()
  const longUrl = `https://example.com/${'x'.repeat(250)}`
  await page.getByLabel('Value', { exact: true }).nth(1).fill(longUrl)
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await page.getByLabel('Description', { exact: true }).fill(
    Array.from({ length: 80 }, (_, i) => `Role line ${i + 1}: Testing a long experience entry.`).join('\n'),
  )
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await expect(page.getByText('Your CV may span multiple A4 pages. Check browser print preview.')).toBeVisible()
  for (const layout of ['classic', 'ats', 'timeline']) {
    await page.emulateMedia({ media: 'screen' })
    await page.getByLabel('Layout').selectOption(layout)
    await page.emulateMedia({ media: 'print' })
    const texts: string[] = []
    for (const width of [650, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: false })
      const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
      const pdf = await loading.promise
      expect(pdf.numPages).toBeGreaterThan(1)
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const pdfPage = await pdf.getPage(i)
        const view = pdfPage.view
        expect(view[2] - view[0]).toBeCloseTo(595.28, 0)
        expect(view[3] - view[1]).toBeCloseTo(841.89, 0)
        const content = await pdfPage.getTextContent()
        pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '))
      }
      expect(pages.every(text => text.trim().length > 0)).toBe(true)
      const text = pages.join(' ')
      expect(text).toContain('Line 1:')
      expect(text).toContain('Line 60:')
      expect(text).toContain('Role line 1:')
      expect(text).toContain('Role line 80:')
      expect(text).toContain('Alex Morgan')
      expect(text.replace(/\s/g, '')).toContain(longUrl)
      texts.push(text)
      await loading.destroy()
    }
    expect(texts[0]).toEqual(texts[1])
  }
})

test('keeps Classic columns and consent at the bottom of the final A4 page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Section headings and consent').click()
  await page.getByLabel('Consent statement', { exact: true }).fill('Final page consent.')
  await page.getByLabel('Include consent statement').check()
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await page.getByLabel('Experience text size').selectOption('9.5')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.reload()
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await expect(page.getByLabel('Experience text size')).toHaveValue('9.5')
  await expect(page.locator('.classic-pages .cv .experience-entry')).toHaveCSS('font-size', '12.6667px')

  async function pdfPages() {
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: false })
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    const pdf = await loading.promise
    const result = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const pdfPage = await pdf.getPage(i)
      const content = await pdfPage.getTextContent()
      result.push(content.items.filter(item => 'str' in item && item.str.trim()).map(item => {
        if (!('str' in item)) throw new Error('Unexpected marked content')
        return { text: item.str, x: item.transform[4], y: item.transform[5] }
      }))
    }
    await loading.destroy()
    return result
  }

  await page.emulateMedia({ media: 'print' })
  const shortPages = await pdfPages()
  expect(shortPages).toHaveLength(1)
  const left = shortPages[0]!.find(item => item.text.includes('alex@example.com'))
  const right = shortPages[0]!.find(item => item.text.includes('Build and maintain web applications.'))
  const shortConsent = shortPages[0]!.find(item => item.text.includes('Final page consent.'))
  expect(left?.x).toBeLessThan(200)
  expect(right?.x).toBeGreaterThan(200)
  expect(shortConsent?.y).toBeGreaterThan(10)
  expect(shortConsent?.y).toBeLessThan(35)

  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('Description', { exact: true }).fill(
    Array.from({ length: 120 }, (_, i) => `Continued role line ${i + 1}.`).join('\n'),
  )
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.emulateMedia({ media: 'print' })
  const longPages = await pdfPages()
  expect(longPages.length).toBeGreaterThan(1)
  expect(longPages.slice(0, -1).flat().some(item => item.text.includes('Final page consent.'))).toBe(false)
  const longConsent = longPages.at(-1)!.find(item => item.text.includes('Final page consent.'))
  expect(longConsent?.y).toBeGreaterThan(10)
  expect(longConsent?.y).toBeLessThan(35)
  expect(longPages.slice(1).flat().some(item => item.text.includes('alex@example.com'))).toBe(false)
  const continuation = longPages.slice(1).flat().find(item => item.text.includes('Continued role line'))
  expect(continuation?.x).toBeGreaterThan(200)
  const allText = longPages.flat().map(item => item.text).join(' ')
  for (let i = 1; i <= 120; i++) {
    expect(allText.match(new RegExp(`Continued role line ${i}\\.`, 'g'))).toHaveLength(1)
  }
  await page.emulateMedia({ media: 'screen' })
  const geometry = await page.locator('.classic-pages .classic-page').evaluateAll(pages => pages.map(page => {
    const left = page.querySelector<HTMLElement>('.cv-sidebar')!
    const right = page.querySelector<HTMLElement>('.cv-main')!
    const footer = page.querySelector<HTMLElement>('.cv-consent')
    return {
      leftTop: left.getBoundingClientRect().top,
      rightTop: right.getBoundingClientRect().top,
      leftBottom: left.getBoundingClientRect().bottom,
      rightBottom: right.getBoundingClientRect().bottom,
      leftOverflow: left.scrollHeight - left.clientHeight,
      rightOverflow: right.scrollHeight - right.clientHeight,
      footerGap: footer ? page.getBoundingClientRect().bottom - footer.getBoundingClientRect().bottom : null,
      emptyShells: page.querySelectorAll('li:empty, h2:empty, h3:empty').length,
    }
  }))
  expect(geometry).toHaveLength(longPages.length)
  for (const rect of geometry) {
    expect(Math.abs(rect.leftTop - rect.rightTop)).toBeLessThan(1)
    expect(Math.abs(rect.leftBottom - rect.rightBottom)).toBeLessThan(1)
    expect(rect.leftOverflow).toBeLessThanOrEqual(0)
    expect(rect.rightOverflow).toBeLessThanOrEqual(0)
    expect(rect.emptyShells).toBe(0)
  }
  expect(Math.abs(geometry.at(-1)!.footerGap!)).toBeLessThan(1)
})

test('prints Classic backgrounds to the A4 edges at different viewport widths', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Section headings and consent').click()
  await page.getByLabel('Consent statement', { exact: true }).fill('Final page consent.')
  await page.getByLabel('Include consent statement').check()
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await page.getByLabel('Description', { exact: true }).fill(
    Array.from({ length: 120 }, (_, i) => `Full page continuation line ${i + 1}.`).join('\n'),
  )

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: false })
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    const pdf = await loading.promise
    expect(pdf.numPages).toBeGreaterThan(1)

    async function backgroundBounds(pageNumber: number, color: string) {
      const pdfPage = await pdf.getPage(pageNumber)
      const operators = await pdfPage.getOperatorList()
      let matrix = [1, 0, 0, 1, 0, 0]
      let fill = ''
      const stack: { matrix: number[], fill: string }[] = []
      const matches: { left: number, right: number, bottom: number, top: number }[] = []
      for (let i = 0; i < operators.fnArray.length; i++) {
        const op = operators.fnArray[i]
        const args = operators.argsArray[i]
        if (op === OPS.save) stack.push({ matrix: [...matrix], fill })
        else if (op === OPS.restore) {
          const previous = stack.pop()!
          matrix = previous.matrix
          fill = previous.fill
        } else if (op === OPS.transform) matrix = Util.transform(matrix, args)
        else if (op === OPS.setFillRGBColor) fill = args[0]
        else if (op === OPS.constructPath && fill === color) {
          const [x1, y1, x2, y2] = args[2]
          const points = [[x1, y1], [x2, y2]]
          for (const point of points) Util.applyTransform(point, matrix)
          matches.push({
            left: Math.min(points[0]![0]!, points[1]![0]!),
            right: Math.max(points[0]![0]!, points[1]![0]!),
            bottom: Math.min(points[0]![1]!, points[1]![1]!),
            top: Math.max(points[0]![1]!, points[1]![1]!),
          })
        }
      }
      const widest = matches.sort((a, b) => (b.right - b.left) - (a.right - a.left))[0]
      if (widest) return widest
      throw new Error(`Missing ${color} background on page ${pageNumber}`)
    }

    const header = await backgroundBounds(1, '#12394b')
    const footer = await backgroundBounds(pdf.numPages, '#eaf2f5')
    const pageView = (await pdf.getPage(1)).view
    expect(header.left).toBeCloseTo(0, 0)
    expect(Math.abs(header.right - pageView[2])).toBeLessThan(1)
    expect(Math.abs(header.top - pageView[3])).toBeLessThan(1)
    expect(footer.left).toBeCloseTo(0, 0)
    expect(Math.abs(footer.right - pageView[2])).toBeLessThan(1)
    expect(Math.abs(footer.bottom)).toBeLessThan(1)
    await loading.destroy()
  }
})

test('shows A4 Classic and Timeline preview pages that fit narrow and desktop viewports', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await page.getByLabel('Description', { exact: true }).fill(
    Array.from({ length: 100 }, (_, i) => `Preview continuation line ${i + 1}.`).join('\n'),
  )

  for (const layout of ['classic', 'timeline']) {
    await page.getByLabel('Layout').selectOption(layout)
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const sheets = page.locator('.classic-sheet')
      await expect.poll(() => sheets.count()).toBeGreaterThan(1)
      await expect.poll(async () => sheets.first().evaluate(sheet => {
        const panel = sheet.closest('.preview-panel')?.getBoundingClientRect()
        if (!panel) return false
        const rect = sheet.getBoundingClientRect()
        return rect.right <= panel.right + 1 && rect.left >= panel.left - 1
      })).toBe(true)
      const dimensions = await sheets.first().boundingBox()
      expect(dimensions!.height / dimensions!.width).toBeCloseTo(297 / 210, 2)
      const previewCount = await sheets.count()
      const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: false })
      const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
      const pdf = await loading.promise
      expect(pdf.numPages).toBe(previewCount)
      await loading.destroy()
    }
  }
  expect(errors.filter(message => message.includes('ResizeObserver loop'))).toEqual([])
})

test('rejects invalid imports without replacing the current CV', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Import, backup and reset').click()
  await page.getByLabel('Import JSON backup').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}'),
  })
  await expect(page.getByRole('alert')).toContainText('Import failed')
  await expect(page.locator('.classic-pages .cv h1')).toHaveText('Alex Morgan')
})

test('blocks oversized consent while flowing a long left column across A4 pages', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Section headings and consent').click()
  await page.getByLabel('Consent statement', { exact: true }).fill('Consent text '.repeat(700))
  await page.getByLabel('Include consent statement').check()
  await expect(page.getByRole('alert')).toContainText('consent statement is too long')
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeDisabled()
  await page.getByLabel('Include consent statement').uncheck()
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeEnabled()

  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Contact details' }) }).locator('summary').click()
  await page.getByLabel('Value', { exact: true }).nth(1).fill('x'.repeat(8000))
  await expect(page.getByRole('button', { name: 'Save as PDF' })).toBeEnabled()
  await expect.poll(() => page.locator('.classic-sheet').count()).toBeGreaterThan(1)
})

test('preserves the classic header background in PDF without changing ATS', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  const header = page.locator('.classic-pages .cv-header')
  const measureHeader = page.locator('.classic-pages .cv-header')
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(measureHeader).toHaveCSS('background-color', 'rgb(18, 57, 75)')
  await expect(measureHeader).toHaveCSS('padding-top', '24px')
  await expect(measureHeader).toHaveCSS('padding-right', '28px')
  await page.emulateMedia({ media: 'print' })
  await expect(header).toHaveCSS('background-color', 'rgb(18, 57, 75)')
  await expect(header).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(header).toHaveCSS('padding-top', '24px')
  await expect(header).toHaveCSS('padding-right', '28px')

  for (const printBackground of [false, true]) {
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground })
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    const pdf = await loading.promise
    const firstPage = await pdf.getPage(1)
    const operators = await firstPage.getOperatorList()
    const colors = operators.fnArray.flatMap((op, index) =>
      op === OPS.setFillRGBColor ? [operators.argsArray[index][0]] : [])
    const content = await firstPage.getTextContent()
    expect(colors).toContain('#12394b')
    expect(content.items.map(item => 'str' in item ? item.str : '').join(' ')).toContain('Alex Morgan')
    await loading.destroy()
  }

  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('Layout').selectOption('ats')
  const atsMeasureHeader = page.locator('.print-measure .cv-header')
  const atsHeader = page.locator('.preview-panel > .cv .cv-header')
  await expect(atsMeasureHeader).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(atsMeasureHeader).toHaveCSS('color', 'rgb(25, 43, 54)')
  await page.emulateMedia({ media: 'print' })
  await expect(atsHeader).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(atsHeader).toHaveCSS('color', 'rgb(25, 43, 54)')
})

test('preserves the classic consent background in preview and PDF', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByText('Section headings and consent').click()
  await page.getByLabel('Consent statement', { exact: true }).fill('Example consent.')
  await page.getByLabel('Include consent statement').check()
  const classicConsent = page.locator('.classic-pages .cv .cv-consent')
  await expect(classicConsent).toHaveCSS('background-color', 'rgb(234, 242, 245)')
  await expect(classicConsent).toHaveCSS('color', 'rgb(25, 43, 54)')

  await page.emulateMedia({ media: 'print' })
  for (const printBackground of [false, true]) {
    const bytes = await page.pdf({ preferCSSPageSize: true, printBackground })
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
    const pdf = await loading.promise
    const colors: string[] = []
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const pdfPage = await pdf.getPage(i)
      const operators = await pdfPage.getOperatorList()
      operators.fnArray.forEach((op, index) => {
        if (op === OPS.setFillRGBColor) colors.push(operators.argsArray[index][0])
      })
      const content = await pdfPage.getTextContent()
      text += content.items.map(item => 'str' in item ? item.str : '').join(' ')
    }
    expect(colors).toContain('#eaf2f5')
    expect(text).toContain('Example consent.')
    await loading.destroy()
  }
  await page.emulateMedia({ media: 'screen' })
  await page.getByLabel('Layout').selectOption('ats')
  const atsConsent = page.locator('.preview-panel > .cv .cv-consent')
  await expect(atsConsent).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(atsConsent).toHaveCSS('color', 'rgb(25, 43, 54)')
})

test('does not request remote resources in imported HTML', async ({ page }) => {
  const unexpected: string[] = []
  page.on('request', request => {
    if (request.url().includes('example.invalid')) unexpected.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Choose original CV HTML').setInputFiles({
    name: 'cv.html',
    mimeType: 'text/html',
    buffer: Buffer.from(legacyHtml.replace('<div class="container">', '<div class="container"><img src="https://example.invalid/track.png">')),
  })
  await expect(page.locator('.classic-pages .cv h1')).toHaveText('Fictional Person')
  await page.waitForTimeout(300)
  expect(unexpected).toEqual([])
})

test('backs up photos and supports duplicate, reset, and print actions', async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => { document.documentElement.dataset.printCalls = String(Number(document.documentElement.dataset.printCalls || 0) + 1) }
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByLabel('Photo (PNG, JPEG or WebP; maximum 2 MB)').setInputFiles({
    name: 'portrait.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1WQAAAABJRU5ErkJggg==', 'base64'),
  })
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.reload()
  await expect(page.locator('.classic-pages .cv img')).toHaveAttribute('alt', 'Portrait of Alex Morgan')
  await expect(page.locator('.photo-preview')).toHaveCount(1)

  // Verify portrait stays square even with a very long candidate name
  await page.getByLabel('Full name').fill('Alexandria Maximilian Bartholomew-Montgomery-Smythe')
  await expect(page.locator('.classic-pages .cv h1')).toContainText('Alexandria')
  const photoBox = await page.locator('.classic-pages .cv .cv-photo').boundingBox()
  expect(photoBox).not.toBeNull()
  expect(Math.abs(photoBox!.width - photoBox!.height)).toBeLessThan(1)
  await page.getByLabel('Full name').fill('Alex Morgan')
  await expect(page.getByRole('status')).toHaveText('Saved locally')

  await page.getByText('Import, backup and reset').click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  const backup = Buffer.concat(chunks)
  expect(JSON.parse(backup.toString()).document.photo).toMatch(/^data:image\/png;base64,/)
  page.once('dialog', dialog => dialog.accept())
  await page.getByLabel('Import JSON backup').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup })
  await expect(page.locator('.classic-pages .cv img')).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByLabel('Choose CV')).toHaveValue(/.+/)
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.getByLabel('Full name').fill('Edited duplicate')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reset CV' }).click()
  await expect(page.getByLabel('Full name')).toHaveValue('Alex Morgan')
  await page.getByRole('button', { name: 'Print', exact: true }).click()
  await page.getByRole('button', { name: 'Save as PDF' }).click()
  await expect(page.locator('.print-help')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-print-calls', '2')
})

test('hides empty entries, blank headings, and dangling item hyphens', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Saved locally')
  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Experience' }) }).locator('summary').click()
  await page.getByRole('button', { name: '+ Add experience' }).click()
  await expect(page.locator('.classic-pages .cv .experience-entry')).toHaveCount(1)

  await page.locator('details').filter({ has: page.locator('summary', { hasText: 'Skills' }) }).locator('summary').click()
  await page.getByLabel('Skill 1', { exact: true }).fill('')
  await page.getByLabel('Detail 1', { exact: true }).fill('TypeScript')
  await expect(page.locator('.classic-pages .cv .cv-sidebar')).toContainText('TypeScript')
  await expect(page.locator('.classic-pages .cv .cv-sidebar')).not.toContainText('- TypeScript')
})

test('reports unavailable local storage without hiding the draft', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined })
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('only in memory')
  await expect(page.getByRole('status')).toHaveText('Not saved')
  await page.getByLabel('Full name').fill('Unsaved draft')
  await expect(page.locator('.classic-pages .cv h1')).toHaveText('Unsaved draft')
  await expect(page.getByRole('alert')).toContainText('only in memory')
})
