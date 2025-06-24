import { faker } from '@faker-js/faker';

export type ProductResult = {
  id: number;
  product: string;
  supplier: string;
  price: string;
  availability: string;
  description: string;
  shipping: string;
  country: string;
  quantity: string;
  subRows?: ProductResult[];
};

const range = (len: number) => {
  const arr: number[] = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};

const suppliers = [
  'Akmekem',
  'Ambeed', 
  'BioFuran Chem',
  'Carolina',
  'Carolina Chemical',
  'Chemsavers',
  'FTF Scientific',
  'Sigma-Aldrich',
  'Fisher Scientific',
  'VWR International',
  'Merck KGaA',
  'Thermo Fisher',
  'Bio-Rad',
  'Qiagen',
  'Promega'
];

const availabilityOptions = ['In Stock', 'Limited Stock', 'Out of Stock', 'Pre-order'];

const chemicalPrefixes = [
  'Acetyl', 'Benzyl', 'Butyl', 'Ethyl', 'Methyl', 'Propyl', 'Phenyl', 'Hexyl',
  'Diethyl', 'Dimethyl', 'Triethyl', 'Hydroxy', 'Amino', 'Nitro', 'Chloro', 'Fluoro'
];

const chemicalSuffixes = [
  'acetate', 'chloride', 'sulfate', 'nitrate', 'phosphate', 'carbonate', 'oxide',
  'hydroxide', 'bromide', 'iodide', 'benzoate', 'citrate', 'tartrate', 'fumarate'
];

const equipmentTypes = [
  'Microscope', 'Centrifuge', 'Spectrophotometer', 'pH Meter', 'Balance', 'Incubator',
  'Autoclave', 'Pipette', 'Burette', 'Beaker', 'Flask', 'Test Tube', 'Petri Dish',
  'Thermometer', 'Hot Plate', 'Magnetic Stirrer', 'Fume Hood', 'Safety Cabinet'
];

const generateChemicalName = (): string => {
  const prefix = faker.helpers.arrayElement(chemicalPrefixes);
  const suffix = faker.helpers.arrayElement(chemicalSuffixes);
  const hasNumber = faker.datatype.boolean(0.3);
  const number = hasNumber ? ` ${faker.number.int({ min: 1, max: 9 })}` : '';
  return `${prefix}${number} ${suffix}`;
};

const generateEquipmentName = (): string => {
  const type = faker.helpers.arrayElement(equipmentTypes);
  const hasModel = faker.datatype.boolean(0.7);
  const model = hasModel ? ` ${faker.string.alphanumeric({ length: { min: 2, max: 4 } }).toUpperCase()}-${faker.number.int({ min: 100, max: 9999 })}` : '';
  return `${type}${model}`;
};

const generateProductName = (): string => {
  const isChemical = faker.datatype.boolean(0.6);
  return isChemical ? generateChemicalName() : generateEquipmentName();
};

const generateDescription = (productName: string): string => {
  const isChemical = productName.includes('acetate') || productName.includes('chloride') || productName.includes('sulfate');
  
  if (isChemical) {
    const purity = faker.helpers.arrayElement(['99%', '98%', '95%', 'ACS grade', 'Reagent grade']);
    const form = faker.helpers.arrayElement(['powder', 'crystals', 'solution', 'liquid']);
    const use = faker.helpers.arrayElement(['analytical', 'synthesis', 'research', 'industrial']);
    return `High quality ${form} from trusted supplier. ${purity} purity, suitable for ${use} applications.`;
  } else {
    const feature = faker.helpers.arrayElement(['digital display', 'stainless steel', 'automated', 'precision']);
    const application = faker.helpers.arrayElement(['laboratory', 'research', 'educational', 'clinical']);
    return `Premium ${feature} equipment with fast shipping. Perfect for ${application} use.`;
  }
};

const countries = ['US', 'UK', 'DE', 'FR', 'CN', 'JP', 'CA', 'AU', 'IN', 'SG'];
const shippingOptions = ['standard', 'express', 'international', 'local', 'next-day'];
const quantities = ['25g', '50g', '100g', '250g', '500g', '1kg', '5kg', '10ml', '25ml', '100ml', '500ml', '1L'];

const generateSubRows = (parentProduct: string, parentSupplier: string): ProductResult[] => {
  const variantCount = faker.number.int({ min: 2, max: 6 });
  const subRows: ProductResult[] = [];
  
  for (let i = 0; i < variantCount; i++) {
    subRows.push({
      id: faker.number.int({ min: 10000, max: 99999 }),
      product: parentProduct, // Same product name
      supplier: parentSupplier, // Same supplier
      quantity: faker.helpers.arrayElement(quantities),
      price: `$${faker.number.float({ min: 15.99, max: 2999.99, fractionDigits: 2 })}`,
      availability: faker.helpers.arrayElement(availabilityOptions),
      description: `${parentProduct} variant - different packaging/quantity`,
      shipping: faker.helpers.arrayElement(shippingOptions),
      country: faker.helpers.arrayElement(countries),
    });
  }
  
  return subRows;
};

const newProduct = (): ProductResult => {
  const productName = generateProductName();
  const supplier = faker.helpers.arrayElement(suppliers);
  const basePrice = `$${faker.number.float({ min: 15.99, max: 2999.99, fractionDigits: 2 })}`;
  const quantity = faker.helpers.arrayElement(quantities);
  
  // Some products have variants (about 60% chance)
  const hasVariants = faker.datatype.boolean(0.6);
  const subRows = hasVariants ? generateSubRows(productName, supplier) : undefined;
  
  return {
    id: faker.number.int({ min: 1000, max: 99999 }),
    product: productName,
    supplier: supplier,
    price: basePrice,
    availability: faker.helpers.arrayElement(availabilityOptions),
    description: generateDescription(productName),
    shipping: faker.helpers.arrayElement(shippingOptions),
    country: faker.helpers.arrayElement(countries),
    quantity: quantity,
    subRows: subRows,
  };
};

export function makeProductData(count: number): ProductResult[] {
  return range(count).map(() => newProduct());
}

// Generate a random number of results between 15 and 150
export function generateRandomProductData(): ProductResult[] {
  const randomCount = faker.number.int({ min: 15, max: 150 });
  return makeProductData(randomCount);
} 