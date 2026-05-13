"use client";

import type { ProductItem } from "@/lib/email/templates/types";

type WizardTranslate = (key: string, values?: Record<string, string | number>) => string;

export function ProductsEditor({
  products,
  onChange,
  max,
  tEmail,
}: {
  products: ProductItem[];
  onChange: (products: ProductItem[]) => void;
  max: number;
  tEmail: WizardTranslate;
}) {
  function addProduct() {
    if (products.length >= max) return;
    onChange([...products, { imageUrl: "", productUrl: "", name: "", description: "" }]);
  }
  function removeProduct(i: number) {
    onChange(products.filter((_, idx) => idx !== i));
  }
  function updateProduct(i: number, field: keyof ProductItem, value: string) {
    onChange(products.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-ink-muted">
          {tEmail("products")} <span className="font-normal">({tEmail("productsMax", { max })})</span>
        </label>
        {products.length < max && (
          <button
            type="button"
            onClick={addProduct}
            className="text-xs font-medium text-accent hover:text-accent-hover"
          >
            + {tEmail("addProduct")}
          </button>
        )}
      </div>
      {products.map((p, i) => (
        <div key={i} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-muted">{tEmail("productN", { n: i + 1 })}</p>
            <button
              type="button"
              onClick={() => removeProduct(i)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              {tEmail("removeProduct")}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productName")}</label>
              <input
                value={p.name}
                onChange={(e) => updateProduct(i, "name", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={tEmail("productNamePh")}
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productUrl")}</label>
              <input
                value={p.productUrl}
                onChange={(e) => updateProduct(i, "productUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="https://"
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productImageUrl")}</label>
              <input
                value={p.imageUrl}
                onChange={(e) => updateProduct(i, "imageUrl", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-xs text-ink-muted">{tEmail("productDesc")}</label>
              <input
                value={p.description}
                onChange={(e) => updateProduct(i, "description", e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                placeholder={tEmail("productDescPh")}
              />
            </div>
          </div>
        </div>
      ))}
      {products.length === 0 && (
        <p className="text-xs text-ink-muted">{tEmail("noProductsYet")}</p>
      )}
    </div>
  );
}

export function ListEditor({
  items,
  onChange,
  max,
  label,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  max: number;
  label: string;
  placeholder: string;
}) {
  const ensured = items.length ? items : [""];

  function update(i: number, val: string) {
    const next = [...ensured];
    next[i] = val;
    onChange(next);
  }
  function add() {
    if (ensured.length >= max) return;
    onChange([...ensured, ""]);
  }
  function remove(i: number) {
    if (ensured.length <= 1) {
      onChange([""]);
    } else {
      onChange(ensured.filter((_, idx) => idx !== i));
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      {ensured.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="px-2 text-zinc-400 hover:text-red-500"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      {ensured.length < max && (
        <button
          type="button"
          onClick={add}
          className="text-xs font-medium text-accent hover:text-accent-hover"
        >
          + Add
        </button>
      )}
    </div>
  );
}
