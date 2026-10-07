import http from 'k6/http'; import { check, sleep } from 'k6';
export const options={vus:Number(__ENV.VUS||100),duration:__ENV.DURATION||'10m',thresholds:{http_req_duration:['p(95)<500'],http_req_failed:['rate<0.01']}};
const base=__ENV.BASE_URL||'http://127.0.0.1:3000';
export default function(){const browse=http.get(`${base}/api/v1/products`);check(browse,{'browse 200':r=>r.status===200});const search=http.get(`${base}/api/v1/search?q=milk`);check(search,{'search 200':r=>r.status===200});sleep(1)}
