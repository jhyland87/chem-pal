import { parseQuantity } from '../quantity'


describe('parseQuantity', () => {
  describe('k/kg/kilogram/kilograms', () => {
    Object.entries({
      '1 kilogram': { quantity: 1, uom: 'kilogram' },
      '0.25 kg': { quantity: 0.25, uom: 'kg' },
      '20 kilograms': { quantity: 20, uom: 'kilograms' }
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('ml/milliliters/millilitre/millilitres', () => {
    Object.entries({
      '2500 ml ': { quantity: 2500, uom: 'ml' },
      '3500 milliliters ': { quantity: 3500, uom: 'milliliters' },
      '4,567 milliliters ': { quantity: 4567, uom: 'milliliters' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });


  describe('lb/lbs/pounds/pounds', () => {
    Object.entries({
      '12lb': { quantity: 12, uom: 'lb' },
      '34 lbs': { quantity: 34, uom: 'lbs' },
      '56 pound': { quantity: 56, uom: 'pound' },
      '78 pounds': { quantity: 78, uom: 'pounds' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('g/gram/grams', () => {
    Object.entries({
      '3g': { quantity: 3, uom: 'g' },
      '43 g': { quantity: 43, uom: 'g' },
      '6 gram': { quantity: 6, uom: 'gram' },
      '7 grams': { quantity: 7, uom: 'grams' },
      '43.6g': { quantity: 43.6, uom: 'g' },
      '50 gram': { quantity: 50, uom: 'gram' },
      '54 grams': { quantity: 54, uom: 'grams' },
      'Sodium, Reagent Grade, 10 g': { quantity: 10, uom: 'g' },
      'Sodium Chlorate, Laboratory Grade, 500 g': { quantity: 500, uom: 'g' },
      '1,000g': { quantity: 1000, uom: 'g' },
      '1,234.5 grams': { quantity: 1234.5, uom: 'grams' },
      '2.345,6 grams': { quantity: 2345.6, uom: 'grams' }
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('mg/milligram/milligrams', () => {
    Object.entries({
      '1 mg': { quantity: 1, uom: 'mg' },
      '2.2 mg': { quantity: 2.2, uom: 'mg' },
      '3,456.78 mg': { quantity: 3456.78, uom: 'mg' },
      '9,123 milligrams': { quantity: 9123, uom: 'milligrams' },

    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('m/meter/meters', () => {
    Object.entries({
      '1m': { quantity: 1, uom: 'm' },
      '2 m': { quantity: 2, uom: 'm' },
      '3 meters': { quantity: 3, uom: 'meters' },
      '4 metres': { quantity: 4, uom: 'metres' },
      '5 metre': { quantity: 5, uom: 'metre' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('oz/ounces', () => {
    Object.entries({
      '1 oz': { quantity: 1, uom: 'oz' },
      '20 ounce': { quantity: 20, uom: 'ounce' },
      '25 ounces': { quantity: 25, uom: 'ounces' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('l/liter/liters', () => {
    Object.entries({
      '1 L': { quantity: 1, uom: 'L' },
      '2.5 L': { quantity: 2.5, uom: 'L' },
      '1.4 l': { quantity: 1.4, uom: 'l' },
      '2.5 L (3,25 € */ 1 L)': { quantity: 2.5, uom: 'L' },
      '3 liters': { quantity: 3, uom: 'liters' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('gal/gallon/gallons', () => {
    Object.entries({
      '1 gal': { quantity: 1, uom: 'gal' },
      '5 gallon': { quantity: 5, uom: 'gallon' },
      '10 gallons': { quantity: 10, uom: 'gallons' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('qt/quart/quarts', () => {
    Object.entries({
      '1 qt': { quantity: 1, uom: 'qt' },
      '2 qts': { quantity: 2, uom: 'qts' },
      '2.3 quart': { quantity: 2.3, uom: 'quart' },
      '3 quarts': { quantity: 3, uom: 'quarts' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('mm/millimeter/millimeters', () => {
    Object.entries({
      '1 millimeter': { quantity: 1, uom: 'millimeter' },
      '2 mm': { quantity: 2, uom: 'mm' },
      '3.4 millimeters': { quantity: 3.4, uom: 'millimeters' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('cm/centimeter/centimeters', () => {
    Object.entries({
      '1 cm': { quantity: 1, uom: 'cm' },
      '123 centimeters': { quantity: 123, uom: 'centimeters' },
      '4,567.89 centimeters': { quantity: 4567.89, uom: 'centimeters' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  describe('km/kilometer/kilometers', () => {
    Object.entries({
      '1 km': { quantity: 1, uom: 'km' },
      '10 kilometre': { quantity: 10, uom: 'kilometre' },
    }).forEach(([content, expected]) => {
      it(`should return ${Object.values(expected).map(e => `'${e}'`).join(' and ')} when parsing: ${content}`, () => {
        expect(parseQuantity(content)).toMatchObject(expected)
      })
    });
  });

  it(`should throw an Error when parsing: foobar`, () => {
    expect(() => parseQuantity('foobar')).toThrow('Failed to parse quantity')
  });
})