import {
  IconBeach,
  IconCoffee,
  IconDeviceLaptop,
  IconDeviceTv,
  IconFlame,
  IconParking,
  IconPaw,
  IconPool,
  IconSnowflake,
  IconToolsKitchen2,
  IconWashMachine,
  IconWifi,
  IconCheck,
  type Icon,
} from "@tabler/icons-react"

// The one lookup from `amenities.icon_key` (set by the backend seed) to a Tabler icon.
const ICONS: Record<string, Icon> = {
  wifi: IconWifi,
  kitchen: IconToolsKitchen2,
  parking: IconParking,
  pool: IconPool,
  beach: IconBeach,
  air_conditioning: IconSnowflake,
  workspace: IconDeviceLaptop,
  paw: IconPaw,
  washer: IconWashMachine,
  tv: IconDeviceTv,
  fireplace: IconFlame,
  breakfast: IconCoffee,
}

export const amenityIcon = (key: string): Icon => ICONS[key] ?? IconCheck
