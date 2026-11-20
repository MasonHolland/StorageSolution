import { expect, test } from '@playwright/test'
import { deflateSync } from 'node:zlib'

/** A 200×200 PNG: white background with a blue box in the middle, like a photo of a tote. */
function bluePhoto(): Buffer {
  const size = 200
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const rows: Buffer[] = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3, 255)
    row[0] = 0
    for (let x = 0; x < size; x++) {
      if (x > 30 && x < 170 && y > 30 && y < 170) row.set([60, 111, 180], 1 + x * 3)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

test('pack a box, place it, then find it from search', async ({ page }) => {
  // 1. Create a storage space
  await page.goto('/#/layout')
  await page.getByLabel('Name').fill('Garage')
  await page.getByRole('button', { name: '10×10 ft unit' }).click()
  await page.getByRole('button', { name: 'Create space' }).click()
  await expect(page.getByRole('heading', { name: 'Garage' })).toBeVisible()

  // 2. Create a box with a photo; its colour comes from the photo
  await page.goto('/#/c/new')
  await page.locator('input[type=file]').setInputFiles({ name: 'tote.png', mimeType: 'image/png', buffer: bluePhoto() })
  await expect(page.getByAltText('Box photo')).toBeVisible()
  const color = await page.getByLabel('Custom colour').inputValue()
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  expect(b).toBeGreaterThan(r + 60)
  expect(b).toBeGreaterThan(g)
  await page.getByLabel('Name').fill('Kitchen')
  await page.getByRole('button', { name: 'Create box' }).click()
  await expect(page.getByRole('heading', { name: /B-001/ })).toBeVisible()
  await expect(page.locator('.photo-strip img')).toHaveCount(1)

  // 3. Add three items
  const itemInput = page.getByLabel('New item')
  for (const item of ['Waffle iron', '6 mugs', 'Toaster']) {
    await itemInput.fill(item)
    await itemInput.press('Enter')
  }
  await expect(page.getByLabel('Quantity of mugs')).toHaveValue('6')
  await expect(page.locator('.item-row')).toHaveCount(3)

  // 4. Place it in a new stack in the garage
  await page.getByRole('button', { name: 'Place box' }).click()
  await expect(page.getByText('Garage › Stack 1 › on its own')).toBeVisible()

  // 5. Search for an item and jump to it in the layout
  await page.getByRole('link', { name: 'Search' }).click()
  await page.getByLabel('Search').fill('waff')
  const hit = page.locator('.list-row', { hasText: 'Waffle iron' })
  await expect(hit).toContainText('Garage › Stack 1')
  await hit.getByRole('link', { name: 'Locate' }).click()

  // 6. The front view shows the box, highlighted
  await expect(page.getByRole('tab', { name: /Stack front/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('g[aria-label="B-001 Kitchen"] rect.svg-highlight')).toBeVisible()

  // 7. The floor plan draws the stack in the box's colour
  await page.getByRole('tab', { name: 'Floor plan' }).click()
  const fill = await page.locator('g[aria-label="Stack 1, 1 boxes"] rect').first().getAttribute('fill')
  expect(fill).toBe(color)
})

test('works offline after first load', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Boxes', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await context.setOffline(false)
})
