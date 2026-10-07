# Performance

Search has a warm-query budget and database indexes cover catalogue, orders, audit and queues. `scripts/load/checkout.js` provides the release k6 profile: 100 virtual users for 10 minutes with p95 below 500 ms and errors below 1%.

Record environment, dataset size, p50/p95/p99 and first failing concurrency after running against buyer staging. A local run is not representative of Supabase pooler, CDN and payment-provider latency.
