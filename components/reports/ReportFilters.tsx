import Input from '@/components/ui/Input';

type Option = {
  value: string;
  label: string;
};

type ReportFiltersProps = {
  action: string;
  fromValue: string;
  toValue: string;
  cashierId?: string;
  categoryId?: string;
  paymentMethod?: string;
  productId?: string;
  cashiers?: Option[];
  categories?: Option[];
  paymentMethods?: Option[];
  products?: Option[];
};

function SelectField({
  name,
  value,
  label,
  options
}: {
  name: string;
  value: string;
  label: string;
  options: Option[];
}) {
  return (
    <label className="space-y-1 text-sm">
      <div className="font-medium text-stone-600">{label}</div>
      <select
        name={name}
        defaultValue={value}
        className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ReportFilters({
  action,
  fromValue,
  toValue,
  cashierId = '',
  categoryId = '',
  paymentMethod = '',
  productId = '',
  cashiers = [],
  categories = [],
  paymentMethods = [],
  products = []
}: ReportFiltersProps) {
  return (
    <form action={action} method="GET" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="space-y-1 text-sm">
        <div className="font-medium text-stone-600">From</div>
        <Input type="date" name="from" defaultValue={fromValue} />
      </label>
      <label className="space-y-1 text-sm">
        <div className="font-medium text-stone-600">To</div>
        <Input type="date" name="to" defaultValue={toValue} />
      </label>

      {cashiers.length ? (
        <SelectField name="cashierId" value={cashierId} label="Cashier" options={cashiers} />
      ) : null}

      {categories.length ? (
        <SelectField name="categoryId" value={categoryId} label="Category" options={categories} />
      ) : null}

      {paymentMethods.length ? (
        <SelectField name="paymentMethod" value={paymentMethod} label="Payment" options={paymentMethods} />
      ) : null}

      {products.length ? (
        <SelectField name="productId" value={productId} label="Product" options={products} />
      ) : null}

      <div className="flex items-end">
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Apply filters
        </button>
      </div>
    </form>
  );
}
