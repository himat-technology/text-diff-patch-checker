import type { Preset } from './presetTypes';

const original = `function calculateTotal(items, discount) {
  var total = 0;

  for (var i = 0; i < items.length; i++) {
    total = total + items[i].price;
  }

  if (discount) {
    total = total - (total * discount);
  }

  return total;
}
`;

const modified = `interface LineItem {
  name: string;
  price: number;
  quantity?: number;
}

export function calculateTotal(items: LineItem[], discountRate = 0): number {
  if (discountRate < 0 || discountRate > 1) {
    throw new RangeError('discountRate must be between 0 and 1');
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * (item.quantity ?? 1),
    0,
  );

  const total = subtotal - subtotal * discountRate;

  return Math.round(total * 100) / 100;
}
`;

export const codeRevision: Preset = {
  id: 'code-revision',
  label: 'Code Revision',
  description: 'JavaScript refactored to TypeScript with validation, reduce() and rounding.',
  original,
  modified,
  originalName: 'calculateTotal.js',
  modifiedName: 'calculateTotal.ts',
};
