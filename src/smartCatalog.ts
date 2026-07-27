export type SmartCatalogCategoryId =
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'vehicle'
  | 'watch'
  | 'camera'
  | 'gaming'
  | 'tools'
  | 'business'
  | 'jewelry'
  | 'collectible'
  | 'general';

export interface SmartCatalogSelection {
  brand: string;
  model: string;
  year: string;
  variant: string;
  customBrand: string;
  customModel: string;
}

type CatalogBrand = {
  label: string;
  models: readonly string[];
};

export const OTHER_CATALOG_VALUE = '__other__';

export const emptySmartCatalogSelection = (): SmartCatalogSelection => ({
  brand: '',
  model: '',
  year: '',
  variant: '',
  customBrand: '',
  customModel: '',
});

export const phoneCatalog: readonly CatalogBrand[] = [
  {
    label: 'Apple',
    models: [
      'iPhone 16 Pro Max',
      'iPhone 16 Pro',
      'iPhone 16 Plus',
      'iPhone 16',
      'iPhone 15 Pro Max',
      'iPhone 15 Pro',
      'iPhone 15 Plus',
      'iPhone 15',
      'iPhone 14 Pro Max',
      'iPhone 14 Pro',
      'iPhone 14 Plus',
      'iPhone 14',
      'iPhone 13 Pro Max',
      'iPhone 13 Pro',
      'iPhone 13',
      'iPhone 13 mini',
      'iPhone 12 Pro Max',
      'iPhone 12 Pro',
      'iPhone 12',
      'iPhone 12 mini',
      'iPhone 11 Pro Max',
      'iPhone 11 Pro',
      'iPhone 11',
      'iPhone SE (3rd generation)',
      'iPhone SE (2nd generation)',
    ],
  },
  {
    label: 'Samsung',
    models: [
      'Galaxy S25 Ultra',
      'Galaxy S25+',
      'Galaxy S25',
      'Galaxy S24 Ultra',
      'Galaxy S24+',
      'Galaxy S24',
      'Galaxy S23 Ultra',
      'Galaxy S23+',
      'Galaxy S23',
      'Galaxy Z Fold6',
      'Galaxy Z Flip6',
      'Galaxy Z Fold5',
      'Galaxy Z Flip5',
      'Galaxy A56 5G',
      'Galaxy A36 5G',
      'Galaxy A16 5G',
    ],
  },
  {
    label: 'Google',
    models: [
      'Pixel 9 Pro Fold',
      'Pixel 9 Pro XL',
      'Pixel 9 Pro',
      'Pixel 9',
      'Pixel 9a',
      'Pixel 8 Pro',
      'Pixel 8',
      'Pixel 8a',
      'Pixel 7 Pro',
      'Pixel 7',
      'Pixel 7a',
      'Pixel 6 Pro',
      'Pixel 6',
      'Pixel 6a',
    ],
  },
  {
    label: 'Motorola',
    models: [
      'razr+',
      'razr',
      'edge+',
      'edge',
      'moto g power 5G',
      'moto g stylus 5G',
      'moto g 5G',
    ],
  },
  {
    label: 'OnePlus',
    models: ['OnePlus 13', 'OnePlus 12', 'OnePlus 11', 'OnePlus Open', 'Nord N30 5G'],
  },
];

export const phoneStorageOptions = ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'] as const;

export const vehicleCatalog: readonly CatalogBrand[] = [
  { label: 'Acura', models: ['Integra', 'MDX', 'RDX', 'TLX'] },
  { label: 'Audi', models: ['A3', 'A4', 'A5', 'A6', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron GT'] },
  { label: 'BMW', models: ['2 Series', '3 Series', '4 Series', '5 Series', '7 Series', 'X1', 'X3', 'X5', 'X7', 'i4', 'i5', 'iX'] },
  { label: 'Buick', models: ['Enclave', 'Encore GX', 'Envision', 'Envista'] },
  { label: 'Cadillac', models: ['CT4', 'CT5', 'Escalade', 'LYRIQ', 'XT4', 'XT5', 'XT6'] },
  { label: 'Chevrolet', models: ['Blazer', 'Bolt EV', 'Camaro', 'Colorado', 'Corvette', 'Equinox', 'Malibu', 'Silverado 1500', 'Suburban', 'Tahoe', 'Trailblazer', 'Traverse'] },
  { label: 'Chrysler', models: ['300', 'Pacifica', 'Voyager'] },
  { label: 'Dodge', models: ['Challenger', 'Charger', 'Durango', 'Hornet'] },
  { label: 'Ford', models: ['Bronco', 'Bronco Sport', 'Edge', 'Escape', 'Expedition', 'Explorer', 'F-150', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Transit'] },
  { label: 'GMC', models: ['Acadia', 'Canyon', 'Hummer EV', 'Sierra 1500', 'Terrain', 'Yukon'] },
  { label: 'Honda', models: ['Accord', 'Civic', 'CR-V', 'HR-V', 'Odyssey', 'Passport', 'Pilot', 'Prologue', 'Ridgeline'] },
  { label: 'Hyundai', models: ['Elantra', 'Ioniq 5', 'Ioniq 6', 'Kona', 'Palisade', 'Santa Cruz', 'Santa Fe', 'Sonata', 'Tucson'] },
  { label: 'Infiniti', models: ['Q50', 'QX50', 'QX55', 'QX60', 'QX80'] },
  { label: 'Jeep', models: ['Cherokee', 'Compass', 'Gladiator', 'Grand Cherokee', 'Renegade', 'Wagoneer', 'Wrangler'] },
  { label: 'Kia', models: ['Carnival', 'EV6', 'EV9', 'Forte', 'K5', 'Niro', 'Seltos', 'Sorento', 'Soul', 'Sportage', 'Telluride'] },
  { label: 'Land Rover', models: ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'] },
  { label: 'Lexus', models: ['ES', 'GX', 'IS', 'LC', 'LS', 'LX', 'NX', 'RC', 'RX', 'RZ', 'TX', 'UX'] },
  { label: 'Lincoln', models: ['Aviator', 'Corsair', 'Nautilus', 'Navigator'] },
  { label: 'Mazda', models: ['Mazda3', 'CX-30', 'CX-5', 'CX-50', 'CX-70', 'CX-90', 'MX-5 Miata'] },
  { label: 'Mercedes-Benz', models: ['A-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'CLE', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'EQE', 'EQS'] },
  { label: 'MINI', models: ['Cooper', 'Countryman'] },
  { label: 'Mitsubishi', models: ['Eclipse Cross', 'Mirage', 'Outlander', 'Outlander Sport'] },
  { label: 'Nissan', models: ['Altima', 'Ariya', 'Armada', 'Frontier', 'Kicks', 'Leaf', 'Maxima', 'Murano', 'Pathfinder', 'Rogue', 'Sentra', 'Titan', 'Versa', 'Z'] },
  { label: 'Porsche', models: ['718', '911', 'Cayenne', 'Macan', 'Panamera', 'Taycan'] },
  { label: 'Ram', models: ['1500', '2500', '3500', 'ProMaster'] },
  { label: 'Subaru', models: ['Ascent', 'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Legacy', 'Outback', 'Solterra', 'WRX'] },
  { label: 'Tesla', models: ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck'] },
  { label: 'Toyota', models: ['4Runner', 'Camry', 'Corolla', 'Crown', 'Grand Highlander', 'Highlander', 'Land Cruiser', 'Prius', 'RAV4', 'Sequoia', 'Sienna', 'Tacoma', 'Tundra', 'Venza'] },
  { label: 'Volkswagen', models: ['Arteon', 'Atlas', 'Golf GTI', 'Golf R', 'ID.4', 'Jetta', 'Taos', 'Tiguan'] },
  { label: 'Volvo', models: ['C40', 'EX30', 'EX90', 'S60', 'S90', 'V60', 'V90', 'XC40', 'XC60', 'XC90'] },
];

export const vehicleYears = Array.from({ length: 47 }, (_, index) => String(2027 - index));

export function getCatalogModels(category: SmartCatalogCategoryId, brand: string): readonly string[] {
  const catalog = category === 'phone' ? phoneCatalog : category === 'vehicle' ? vehicleCatalog : [];
  return catalog.find(item => item.label === brand)?.models ?? [];
}

export function buildSmartCatalogTitle(
  category: SmartCatalogCategoryId,
  selection: SmartCatalogSelection,
): string {
  const brand = selection.brand === OTHER_CATALOG_VALUE ? selection.customBrand.trim() : selection.brand;
  const model = selection.brand === OTHER_CATALOG_VALUE || selection.model === OTHER_CATALOG_VALUE
    ? selection.customModel.trim()
    : selection.model;

  if (category === 'phone') {
    const identity = [brand, model].filter(Boolean).join(' ');
    return [identity, selection.variant].filter(Boolean).join(' · ');
  }

  if (category === 'vehicle') {
    return [selection.year, brand, model].filter(Boolean).join(' ');
  }

  return '';
}

export function sanitizeSmartCatalogSelection(value: unknown): SmartCatalogSelection {
  if (!value || typeof value !== 'object') return emptySmartCatalogSelection();
  const source = value as Partial<Record<keyof SmartCatalogSelection, unknown>>;
  const read = (key: keyof SmartCatalogSelection) => typeof source[key] === 'string'
    ? String(source[key]).slice(0, 80)
    : '';

  return {
    brand: read('brand'),
    model: read('model'),
    year: read('year'),
    variant: read('variant'),
    customBrand: read('customBrand'),
    customModel: read('customModel'),
  };
}
