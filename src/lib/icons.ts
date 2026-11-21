import {
  Boxes,
  Camera,
  ClipboardList,
  Cpu,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  Monitor,
  Network,
  Package,
  PackageCheck,
  Phone,
  Printer,
  ShieldCheck,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const ICONS: Record<string, LucideIcon> = {
  Keyboard,
  Monitor,
  Cpu,
  Network,
  Zap,
  Printer,
  Boxes,
  Package,
  Laptop,
  HardDrive,
  Headphones,
  Camera,
  Phone,
  Wifi,
  ClipboardList,
  Wrench,
  PackageCheck,
  ShieldCheck,
}

export const ICON_NAMES = Object.keys(ICONS)

export function getIcon(name?: string | null): LucideIcon {
  return (name && ICONS[name]) || Package
}
