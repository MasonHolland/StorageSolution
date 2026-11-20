// A realistic sample household for trying the app: two storage spaces, stacked
// boxes, a drawer unit with drawers, and a few boxes still being packed.
import { db } from '../../db/db'
import * as repo from '../../db/repo'
import type { Container } from '../../db/schema'
import { SIZE_PRESETS } from '../../db/schema'

type Item = string | { name: string; qty?: number; tags?: string[] }

interface DemoBox {
  name: string
  preset: string
  color: string
  room: string
  items: Item[]
  kind?: Container['kind']
  fragile?: boolean
  priority?: Container['priority']
  status?: Container['status']
  notes?: string
  drawers?: { name: string; items: Item[] }[]
}

interface DemoStack {
  label: string
  x: number
  y: number
  rotation?: 0 | 90
  boxes: DemoBox[] // bottom first
}

const CARDBOARD = '#c19a6b'
const BLACK_TOTE = '#2f3237'
const GREY_TOTE = '#8c9196'
const BLUE_TOTE = '#3c6fb4'
const CLEAR = '#d9e6ec'
const WHITE = '#f1efe9'
const GREEN_TOTE = '#4f8a5b'

const UNIT: DemoStack[] = [
  {
    label: 'Back left', x: 0, y: 0, boxes: [
      { name: 'Pots & pans', preset: 'large', color: CARDBOARD, room: 'Kitchen', items: ['Saucepans', { name: 'Frying pans', qty: 2 }, 'Stock pot', 'Waffle iron', 'Slow cooker'] },
      { name: 'Plates & bowls', preset: 'medium', color: CARDBOARD, room: 'Kitchen', fragile: true, items: [{ name: 'Dinner plates', qty: 8 }, { name: 'Bowls', qty: 8 }, { name: 'Side plates', qty: 6 }] },
      { name: 'Glasses', preset: 'small', color: CARDBOARD, room: 'Kitchen', fragile: true, items: [{ name: 'Wine glasses', qty: 12, tags: ['fragile'] }, { name: 'Tumblers', qty: 6 }, 'Champagne flutes'] },
    ],
  },
  {
    label: 'Back middle', x: 65, y: 0, boxes: [
      { name: 'Christmas decorations', preset: 'tote', color: BLACK_TOTE, room: 'Living room', items: ['Tree lights', 'Baubles', 'Tree stand', 'Wreath', { name: 'Stockings', qty: 4 }] },
      { name: 'Halloween & Easter', preset: 'tote', color: BLACK_TOTE, room: 'Living room', items: ['Costumes', 'Pumpkin carving kit', 'Easter baskets'] },
      { name: 'Camping gear', preset: 'tote', color: GREEN_TOTE, room: 'Garage', items: ['Tent', { name: 'Sleeping bags', qty: 2 }, 'Camping stove', 'Head torches', 'Tarp'] },
    ],
  },
  {
    label: 'Back right', x: 130, y: 0, boxes: [
      { name: 'Winter coats', preset: 'wardrobe', color: CARDBOARD, room: 'Bedroom', items: [{ name: 'Coats', qty: 4 }, 'Ski jacket', 'Suit', { name: 'Dresses', qty: 3 }] },
    ],
  },
  {
    label: 'Books', x: 255, y: 70, rotation: 90, boxes: [
      { name: 'Books A–F', preset: 'small', color: CARDBOARD, room: 'Office', items: ['Atlas', 'Cookbooks', 'Dune', { name: 'Children’s books', qty: 15 }] },
      { name: 'Books G–M', preset: 'small', color: CARDBOARD, room: 'Office', items: ['Harry Potter set', 'Lord of the Rings', 'Photo albums'] },
      { name: 'Books N–Z', preset: 'small', color: CARDBOARD, room: 'Office', items: ['Travel guides', 'Board game rulebooks', 'Old magazines'] },
    ],
  },
  {
    label: 'Front left', x: 0, y: 140, boxes: [
      {
        name: 'Craft drawers', preset: 'drawers', color: WHITE, room: 'Kids', kind: 'drawerUnit', items: [],
        drawers: [
          { name: 'Drawer 1 – paints', items: ['Acrylic paints', 'Brushes', 'Palette'] },
          { name: 'Drawer 2 – yarn', items: ['Yarn', 'Knitting needles', 'Crochet hooks'] },
          { name: 'Drawer 3 – paper', items: ['Sketch pads', 'Coloured card', 'Stickers'] },
        ],
      },
      { name: 'Board games', preset: 'small', color: CARDBOARD, room: 'Living room', items: ['Monopoly', 'Scrabble', 'Jigsaw puzzles', 'Playing cards'] },
    ],
  },
]

const GARAGE: DemoStack[] = [
  {
    label: 'Shelf by door', x: 0, y: 420, boxes: [
      { name: 'Tools', preset: 'tote', color: CLEAR, room: 'Garage', items: ['Cordless drill', 'Drill bits', 'Hammer', 'Screwdrivers', 'Tape measure', 'Spirit level'] },
      { name: 'Winter clothes', preset: 'tote', color: BLUE_TOTE, room: 'Bedroom', items: [{ name: 'Scarves', qty: 5 }, 'Gloves', 'Beanies', 'Thermals'] },
    ],
  },
  {
    label: 'Back wall', x: 120, y: 0, boxes: [
      { name: 'Garden', preset: 'tote', color: GREY_TOTE, room: 'Outdoor', items: ['Secateurs', 'Hose fittings', 'Seed packets', 'Gardening gloves'] },
      { name: 'Cables & chargers', preset: 'small', color: CARDBOARD, room: 'Office', status: 'unpacked', items: ['HDMI cables', 'USB-C chargers', 'Power strip', 'Old phone'] },
    ],
  },
]

const UNPLACED: DemoBox[] = [
  { name: 'Bathroom essentials', preset: 'small', color: CARDBOARD, room: 'Bathroom', status: 'packing', priority: 'open-first',
    notes: 'Last box packed, first box opened.', items: ['Towels', 'Toiletries', 'First aid kit', 'Toilet roll'] },
  { name: 'Kids’ toys', preset: 'tote', color: BLUE_TOTE, room: 'Kids', status: 'sealed', items: ['Lego', 'Teddy bears', 'Toy cars', 'Train set'] },
]

/** Wipes everything on this device, then loads the demo household. */
export async function loadDemoData(): Promise<{ boxes: number; items: number }> {
  await Promise.all(db.tables.map((t) => t.clear()))

  const unit = await repo.createSpace({ name: 'Unit 214 – storage', widthCm: 305, depthCm: 305, heightCm: 240, notes: 'Gate code is on the fridge.' })
  const garage = await repo.createSpace({ name: 'Garage', widthCm: 300, depthCm: 550, heightCm: 230 })

  for (const [space, stacks] of [[unit, UNIT], [garage, GARAGE]] as const) {
    for (const s of stacks) {
      const stack = await repo.createStack(space.id, s.x, s.y)
      await repo.updateStack(stack.id, { label: s.label, rotation: s.rotation ?? 0 })
      for (const b of s.boxes) {
        const c = await createBox(b)
        await repo.placeInStack(c.id, stack.id)
        if (b.status) await repo.updateContainer(c.id, { status: b.status })
      }
    }
  }
  for (const b of UNPLACED) await createBox(b)

  return { boxes: await db.containers.count(), items: await db.items.count() }
}

async function createBox(b: DemoBox, parentId?: string): Promise<Container> {
  const preset = SIZE_PRESETS.find((p) => p.id === b.preset)
  // Drawers have no preset: size them to fit inside a 3-drawer unit.
  const size = preset ?? { widthCm: 38, depthCm: 45, heightCm: 20 }
  const c = await repo.createContainer({
    name: b.name,
    kind: b.kind ?? (b.preset === 'tote' ? 'bin' : parentId ? 'drawer' : 'box'),
    sizePreset: preset?.id,
    widthCm: size.widthCm,
    depthCm: size.depthCm,
    heightCm: size.heightCm,
    color: b.color,
    originRoom: b.room,
    status: b.status ?? 'sealed',
    fragile: b.fragile ?? false,
    priority: b.priority ?? 'normal',
    notes: b.notes ?? '',
    parentId,
  })
  for (const it of b.items) {
    await repo.addItem(c.id, typeof it === 'string' ? { name: it } : { name: it.name, qty: it.qty ?? 1, tags: it.tags ?? [] })
  }
  for (const d of b.drawers ?? []) {
    await createBox({ name: d.name, preset: '', color: b.color, room: b.room, items: d.items, kind: 'drawer', status: 'stored' }, c.id)
  }
  return c
}

/** Deletes every record on this device. */
export async function clearAllData(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
