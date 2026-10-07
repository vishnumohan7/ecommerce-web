/* eslint-disable local/no-jsx-literals -- Operations copy is English-only. */
import type { Metadata } from 'next';
import Link from 'next/link';
import { importCatalogue } from '../../actions';
import { ActionMessage } from '../../components/action-message';

export const metadata: Metadata = { title: 'Import catalogue' };

interface Props { searchParams: Promise<{ success?: string; error?: string }> }

export default async function CatalogueImportPage({ searchParams }: Props) {
  const query = await searchParams;
  return <>
    <section className="page-heading">
      <div><p className="eyebrow">Catalogue operations</p><h1>Import products</h1><p>Validate or apply a CSV/XLSX catalogue file. Imports are atomic, so invalid rows never create a partial catalogue.</p></div>
      <Link className="button button-muted" href="/products">Back to products</Link>
    </section>
    <ActionMessage success={query.success} error={query.error} />
    <div className="catalogue-ops-grid">
      <article className="panel upload-card">
        <div className="panel-header"><div><p className="eyebrow">Bulk operation</p><h2>Upload catalogue</h2><p>CSV and Excel files up to 25 MB are supported.</p></div></div>
        <form action={importCatalogue} className="product-form">
          <label className="wide-field">Catalogue file<input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
          <label>Duplicate SKUs<select name="duplicatePolicy" defaultValue="update"><option value="update">Update existing</option><option value="skip">Skip existing</option><option value="fail">Fail validation</option></select></label>
          <label className="checkbox-field"><input name="dryRun" type="checkbox" defaultChecked /> Validate only (recommended first)</label>
          <div className="form-actions"><button className="button button-primary" type="submit">Run catalogue import</button></div>
        </form>
      </article>
      <article className="panel import-guide">
        <div className="panel-header"><div><p className="eyebrow">Required columns</p><h2>File structure</h2></div></div>
        <div className="import-column-list">
          {['sku','slug','name','description','categorySlug','priceMinor','vatRateBps','restrictionReason','ageRestriction','abv'].map((column) => <code key={column}>{column}</code>)}
        </div>
        <p className="page-note">Use prices in pence. Set restrictionReason to NONE, ALCOHOL or RETAILER_POLICY. Alcohol ABV may be blank for non-alcohol products.</p>
      </article>
    </div>
  </>;
}
