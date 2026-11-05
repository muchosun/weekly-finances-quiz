// Apple's verifier imports node-fetch for OCSP. Workers provides standard fetch.
export default (url,options)=>fetch(url,options);
export const Headers=globalThis.Headers;
