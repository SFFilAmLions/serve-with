// Proof-of-concept normalization for the existing event creation endpoint.
// Never mutate the original request object; reject malformed values in the
// real Worker business validator after this compatibility transformation.
export function normalizeLegacyEventCreate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const keys=['title','location','timezone','start','end'];
  const normalized=Object.fromEntries(keys.filter(k=>k in body).map(k=>[k,body[k]]));
  for (const key of ['title','location']) {
    if (typeof normalized[key]==='string') normalized[key]=normalized[key].trim();
  }
  return normalized;
}
