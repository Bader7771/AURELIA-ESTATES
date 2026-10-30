export async function api(path,options={}){
 if(import.meta.env.DEV&&import.meta.env.VITE_DEMO_MODE==='true'&&(!options.method||options.method==='GET')&&(path==='/properties'||path.startsWith('/properties?')||path.startsWith('/properties/'))){
  const {demoResponse}=await import('./demo-properties.js');return demoResponse(path);
 }
 const response=await fetch('/api'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers},...options});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||'Request failed. Please try again.'),{status:response.status,fields:data.fields||{},retryAfter:Number(response.headers.get('Retry-After')||data.retryAfter)||0});
 return data;
}
export const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
export const cover=property=>property?.images?.[property.coverIndex||0]?.url||property?.images?.[0]?.url||'';

export const displayPrice=property=>money(property?.price)+(property?.listingStatus==='For Rent'?' / mo':'');
