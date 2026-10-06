import { ProductGrid } from '../../components/product-card';
import { serverApi, type Product } from '../../lib/store-api';
export default async function Offers() { const data = await serverApi<{ items: Product[] }>('/api/v1/search?onOffer=true'); return <main className="section"><p className="eyebrow">Limited-time prices</p><h1>Offers</h1>{data ? <ProductGrid products={data.items} empty="There are no active offers right now." /> : <div className="error-state">Offers are unavailable.</div>}</main>; }
