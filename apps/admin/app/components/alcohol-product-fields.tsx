'use client';

/* eslint-disable local/no-jsx-literals -- Admin form labels are English-only. */
import { useState } from 'react';

interface Props {
  initialAlcohol?: boolean;
  initialAbv?: string | null;
  initialAlcoholType?: string | null;
}

export function AlcoholProductFields({
  initialAlcohol = false,
  initialAbv = null,
  initialAlcoholType = null,
}: Readonly<Props>) {
  const [isAlcohol, setIsAlcohol] = useState(initialAlcohol);

  return (
    <>
      <label className="checkbox-field">
        <input
          name="isAlcohol"
          type="checkbox"
          checked={isAlcohol}
          onChange={(event) => {
            setIsAlcohol(event.target.checked);
          }}
        />
        Alcohol product (forces age 18 and standard VAT)
      </label>
      <label>
        ABV %
        <input
          name="abv"
          type="number"
          inputMode="decimal"
          min="0"
          max="100"
          step="0.01"
          defaultValue={initialAbv ?? ''}
          placeholder="12.5"
          disabled={!isAlcohol}
          required={isAlcohol}
        />
      </label>
      <label>
        Alcohol type
        <select
          name="alcoholType"
          defaultValue={initialAlcoholType ?? 'WINE'}
          disabled={!isAlcohol}
          required={isAlcohol}
        >
          <option>BEER</option>
          <option>WINE</option>
          <option>SPIRITS</option>
          <option>CIDER</option>
          <option>OTHER</option>
        </select>
      </label>
    </>
  );
}
