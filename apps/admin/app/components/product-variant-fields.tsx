'use client';

/* eslint-disable local/no-jsx-literals -- Admin form labels are English-only. */
import { useState } from 'react';
import type { Warehouse } from '../lib/api';

interface Props {
  warehouses: Warehouse[];
}

export function ProductVariantFields({ warehouses }: Readonly<Props>) {
  const [rows, setRows] = useState<number[]>([]);
  const [nextId, setNextId] = useState(1);

  function addRow() {
    setRows((current) => [...current, nextId]);
    setNextId((current) => current + 1);
  }

  return (
    <section className="variant-creator wide-field">
      <div className="variant-creator-heading">
        <div>
          <span>Product variants</span>
          <small>
            Add optional pack sizes, weights or flavours. Each variant has its own SKU, price and
            opening stock.
          </small>
        </div>
        <button className="button button-secondary" type="button" onClick={addRow}>
          + Add variant
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="variant-empty">
          <strong>No variants added</strong>
          <span>The base product will be sold as entered above.</span>
        </div>
      ) : (
        <div className="variant-draft-list">
          {rows.map((row, index) => (
            <fieldset className="variant-draft" key={row}>
              <legend>Variant {index + 1}</legend>
              <button
                className="variant-remove"
                type="button"
                onClick={() => setRows((current) => current.filter((item) => item !== row))}
              >
                Remove
              </button>
              <label>
                Variant name
                <input name="variantName" placeholder="750 ml bottle" required />
              </label>
              <label>
                Variant SKU
                <input name="variantSku" placeholder="SKU-750ML" required />
              </label>
              <label>
                Price (pence)
                <input name="variantPriceMinor" type="number" min="0" required />
              </label>
              <label>
                Pack size
                <input name="variantPackSize" placeholder="6 × 330 ml" />
              </label>
              <label>
                Weight (grams)
                <input name="variantWeightGrams" type="number" min="1" />
              </label>
              <label>
                Flavour
                <input name="variantFlavour" placeholder="Original" />
              </label>
              <label>
                Warehouse
                <select name="variantWarehouseId" required defaultValue="">
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option value={warehouse.id} key={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Opening stock
                <input name="variantStockOnHand" type="number" min="0" defaultValue="0" required />
              </label>
              <label>
                Low-stock alert
                <input
                  name="variantLowStockThreshold"
                  type="number"
                  min="0"
                  defaultValue="5"
                  required
                />
              </label>
              <label>
                ABV % (if applicable)
                <input name="variantAbv" type="number" min="0" max="100" step="0.01" />
              </label>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  );
}
