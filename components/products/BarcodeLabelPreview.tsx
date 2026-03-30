import { buildVariantLabel } from '@/lib/product-merchandising';

const CODE39_MAP: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn'
};

const LABEL_SIZES = {
  small: { width: 210, height: 92, barHeight: 42, title: 'w-56' },
  medium: { width: 280, height: 120, barHeight: 58, title: 'w-72' },
  large: { width: 360, height: 150, barHeight: 78, title: 'w-96' }
} as const;

export type BarcodeLabelSize = keyof typeof LABEL_SIZES;

function sanitizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '');
}

function encodeCode39(value: string) {
  const payload = `*${sanitizeCode(value)}*`;
  const elements: Array<{ dark: boolean; width: number }> = [];

  for (const character of payload) {
    const pattern = CODE39_MAP[character];
    if (!pattern) {
      continue;
    }

    for (let index = 0; index < pattern.length; index += 1) {
      elements.push({
        dark: index % 2 === 0,
        width: pattern[index] === 'w' ? 3 : 1
      });
    }

    elements.push({ dark: false, width: 1 });
  }

  return elements;
}

function BarcodeSvg({
  code,
  size
}: {
  code: string;
  size: BarcodeLabelSize;
}) {
  const spec = LABEL_SIZES[size];
  const encoded = encodeCode39(code);
  const totalUnits = encoded.reduce((sum, element) => sum + element.width, 0);
  const unitWidth = spec.width / Math.max(totalUnits, 1);
  const bars = encoded.reduce<Array<{ key: number; x: number; width: number }>>((acc, element, index) => {
    const previous = acc[acc.length - 1];
    const nextX = previous ? previous.x + previous.width : 0;
    const width = element.width * unitWidth;

    if (!element.dark) {
      acc.push({ key: index, x: nextX, width });
      return acc;
    }

    acc.push({ key: index, x: nextX, width });
    return acc;
  }, []);

  return (
    <svg
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      role="img"
      aria-label={`Barcode for ${code}`}
      className="w-full"
    >
      <rect width={spec.width} height={spec.height} fill="white" />
      {encoded.map((element, index) =>
        element.dark ? (
          <rect key={index} x={bars[index]?.x ?? 0} y={10} width={bars[index]?.width ?? 0} height={spec.barHeight} fill="black" />
        ) : null
      )}
      <text
        x={spec.width / 2}
        y={spec.height - 8}
        textAnchor="middle"
        fontSize="14"
        fontFamily="monospace"
        fill="black"
      >
        {sanitizeCode(code)}
      </text>
    </svg>
  );
}

export function formatVariantLabelForDisplay(input: {
  color?: string | null;
  size?: string | null;
  flavor?: string | null;
  model?: string | null;
}) {
  return buildVariantLabel(input);
}

export default function BarcodeLabelPreview({
  code,
  productName,
  variantLabel,
  sku,
  size = 'medium'
}: {
  code: string | null | undefined;
  productName: string;
  variantLabel?: string | null;
  sku?: string | null;
  size?: BarcodeLabelSize;
}) {
  const normalized = sanitizeCode(code ?? '');

  if (!normalized) {
    return (
      <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500">
        Add a barcode to preview and print labels.
      </div>
    );
  }

  const spec = LABEL_SIZES[size];

  return (
    <div className={`rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm ${spec.title}`}>
      <div className="text-sm font-semibold text-stone-900">{productName}</div>
      {variantLabel ? <div className="mt-1 text-xs text-stone-500">{variantLabel}</div> : null}
      {sku ? <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">SKU {sku}</div> : null}
      <div className="mt-3">
        <BarcodeSvg code={normalized} size={size} />
      </div>
    </div>
  );
}
