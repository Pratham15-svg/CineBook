// node tests/load_test.mjs /shows 20 300
const path = process.argv[2] || '/shows';
const concurrency = Number(process.argv[3] || 20);
const total = Number(process.argv[4] || 300);
const base = process.env.API_BASE_URL || 'http://localhost:5050/api';
if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(total) || total < 1 || !path.startsWith('/')) {
  console.error('Usage: node tests/load_test.mjs /shows 20 300'); process.exit(1);
}
let next = 0, errors = 0;
const latencies = [];
const started = performance.now();
async function worker() {
  while (next < total) {
    next++;
    const t0=performance.now();
    try { const res=await fetch(base+path); await res.arrayBuffer(); if (!res.ok) errors++; }
    catch { errors++; }
    latencies.push(performance.now()-t0);
  }
}
await Promise.all(Array.from({length:Math.min(total,concurrency)},worker));
const duration=(performance.now()-started)/1000;
latencies.sort((a,b)=>a-b);
const avg=latencies.reduce((a,b)=>a+b,0)/latencies.length;
const p95=latencies[Math.ceil(latencies.length*.95)-1];
console.log(JSON.stringify({endpoint:path,concurrency,requests:total,errors,throughput_req_s:Number((total/duration).toFixed(2)),avg_ms:Number(avg.toFixed(2)),p95_ms:Number(p95.toFixed(2)),duration_s:Number(duration.toFixed(2))},null,2));
if(errors)process.exitCode=1;
