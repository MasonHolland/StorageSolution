// All measurements are centimetres. Positions use a right-handed frame:
// x = across the space (width), y = into the space (depth), z = up (height).

export type ContainerKind = 'box' | 'bin' | 'drawerUnit' | 'drawer' | 'bag'
export type ContainerStatus = 'packing' | 'sealed' | 'stored' | 'unpacked'
export type Priority = 'open-first' | 'normal' | 'deep-storage'

export interface Space {
  id: string
  name: string
  widthCm: number
  depthCm: number
  heightCm: number
  notes: string
  createdAt: number
}

export interface Stack {
  id: string
  spaceId: string
  label: string
  /** Position of the stack footprint's top-left corner on the floor plan. */
  xCm: number
  yCm: number
  /** Degrees; 0 or 90. A rotated stack swaps width and depth. */
  rotation: 0 | 90
  createdAt: number
}

export interface Container {
  id: string
  code: string
  name: string
  kind: ContainerKind
  widthCm: number
  depthCm: number
  heightCm: number
  sizePreset?: string
  color: string
  originRoom?: string
  status: ContainerStatus
  fragile: boolean
  priority: Priority
  stackId?: string
  /** 0 = bottom of the stack. */
  stackIndex?: number
  /** A drawer's parent drawer unit. */
  parentId?: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Item {
  id: string
  containerId: string
  name: string
  qty: number
  category?: string
  tags: string[]
  notes: string
  photoId?: string
  createdAt: number
}

export interface Photo {
  id: string
  containerId: string
  blob: Blob
  thumb: Blob
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export interface SizePreset {
  id: string
  label: string
  widthCm: number
  depthCm: number
  heightCm: number
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: 'small', label: 'Small box', widthCm: 40, depthCm: 30, heightCm: 30 },
  { id: 'medium', label: 'Medium box', widthCm: 45, depthCm: 45, heightCm: 40 },
  { id: 'large', label: 'Large box', widthCm: 60, depthCm: 45, heightCm: 45 },
  { id: 'wardrobe', label: 'Wardrobe box', widthCm: 60, depthCm: 50, heightCm: 110 },
  { id: 'tote', label: 'Plastic tote', widthCm: 60, depthCm: 40, heightCm: 35 },
  { id: 'drawers', label: '3-drawer unit', widthCm: 40, depthCm: 50, heightCm: 70 },
]

export const COLOR_PRESETS = [
  { label: 'Cardboard', color: '#c19a6b' },
  { label: 'Clear plastic', color: '#d9e6ec' },
  { label: 'Black tote', color: '#2f3237' },
  { label: 'Grey tote', color: '#8c9196' },
  { label: 'Blue tote', color: '#3c6fb4' },
  { label: 'White', color: '#f1efe9' },
]

export const ROOMS = [
  'Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Office',
  'Garage', 'Kids', 'Dining', 'Laundry', 'Outdoor', 'Other',
]

export const STATUS_LABELS: Record<ContainerStatus, string> = {
  packing: 'Packing',
  sealed: 'Sealed',
  stored: 'Stored',
  unpacked: 'Unpacked',
}

export const KIND_LABELS: Record<ContainerKind, string> = {
  box: 'Box',
  bin: 'Bin / tote',
  drawerUnit: 'Drawer unit',
  drawer: 'Drawer',
  bag: 'Bag',
}
