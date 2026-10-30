const photos=['photo-1600607687920-4e2a09cf159d','photo-1600566753190-17f0baa2a6c3','photo-1600596542815-ffad4c1539a9','photo-1600607687939-ce8a6c25118c','photo-1600210492486-724fe5c67fb0','photo-1600566753086-00f18fb6b3ea','photo-1600566752355-35792bedcfea','photo-1600607687920-4e2a09cf159d'];
const rows=[
['Solstice House','Miami','Florida','Waterfront',18500000,6,7,9200],['The Wilshire Residence','Los Angeles','California','Contemporary',12900000,5,6,7400],['Hudson Sky Penthouse','New York','New York','Penthouse',23900000,4,5,6100],['Cypress Point','Montecito','California','Estate',21500000,7,8,11400],['Atlantic Reverie','Palm Beach','Florida','Waterfront',14750000,5,6,8300],['The Glass Pavilion','Austin','Texas','Contemporary',8900000,5,5,6800],['Canyon House','Scottsdale','Arizona','Villa',11200000,5,6,7700],['Pacific Haven','Malibu','California','Waterfront',28500000,6,7,9600],['North Shore Estate','Chicago','Illinois','Estate',9750000,6,7,8400],['The Parkline','New York','New York','Penthouse',16300000,4,5,5400],['Marina Modern','Miami','Florida','Contemporary',13400000,5,6,7200],['Aspen Ridge','Aspen','Colorado','Ranch',19800000,6,7,10500],
['Desert Light House','Paradise Valley','Arizona','Contemporary',7250000,4,5,5900],['The Crescent Villa','Beverly Hills','California','Villa',31500000,7,9,12300],['Bayview Residence','San Francisco','California','Townhouse',6850000,4,4,4200],['Ocean Terrace','Naples','Florida','Waterfront',12300000,5,6,7100],['The Meridian','Seattle','Washington','Penthouse',7900000,3,4,3900],['Stone & Cedar','Denver','Colorado','Contemporary',5400000,4,5,5100],['The Seabrook Estate','Charleston','South Carolina','Estate',8950000,6,7,8200],['Hillcrest Retreat','Nashville','Tennessee','Estate',6300000,5,6,6800],['The Cove House','San Diego','California','Waterfront',15400000,5,6,7600],['Magnolia Court','Houston','Texas','Estate',4800000,5,6,6300],['The Atelier Loft','New York','New York','Penthouse',8800000,3,3,3400],['Lakeside Pavilion','Lake Tahoe','Nevada','Villa',11250000,5,6,7900],['The Belvedere','Boston','Massachusetts','Townhouse',5850000,4,5,4600],['Coral House','Fort Lauderdale','Florida','Waterfront',9950000,5,5,6100],['Paloma Residence','Santa Fe','New Mexico','Villa',4250000,4,4,5400],['Pine & Peak','Park City','Utah','Ranch',12200000,6,7,9000],['The Horizon House','Portland','Oregon','Contemporary',5100000,4,4,4900],['Sunset Quay','Miami','Florida','Penthouse',11900000,4,5,5200]
];

export const demoProperties=rows.map(([title,city,state,type,price,beds,baths,area],i)=>{
 const slug=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 return {_id:'demo-'+slug,title,slug,city,state,type,beds,baths,area,country:'United States',currency:'USD',price:i%9===0?Math.round(price/1000):price,listingStatus:i%9===0?'For Rent':'For Sale',featured:i<9,published:true,isDemo:true,coverIndex:0,description:`Fictional demonstration property in ${city}, ${state}. The specifications, price, and availability are examples only. This home is not offered for sale or rent. Photography is illustrative.`,amenities:['Outdoor living','Private terrace','Considered interiors'],images:[{url:`https://images.unsplash.com/${photos[i%photos.length]}?w=1600&q=85`,publicId:'demo/'+slug,alt:`Illustrative photograph for ${title}`} ]};
});
export function demoResponse(path){
 const [route,query='']=path.split('?'),q=new URLSearchParams(query);
 if(route==='/properties/featured')return {items:demoProperties.filter(p=>p.featured).slice(0,6)};
 if(route.startsWith('/properties/')){const item=demoProperties.find(p=>p.slug===decodeURIComponent(route.slice(12)));if(!item)throw Object.assign(new Error('Property not found'),{status:404});return {item};}
 let items=demoProperties.filter(p=>{
  if(q.get('search')&&![p.title,p.city,p.state].some(v=>v.toLowerCase().includes(q.get('search').toLowerCase())))return false;
  for(const key of ['city','type','listingStatus'])if(q.get(key)&&q.get(key)!=='All'&&p[key]!==q.get(key))return false;
  for(const key of ['beds','baths'])if(q.get(key)&&p[key]<Number(q.get(key)))return false;
  return (!q.get('minPrice')||p.price>=Number(q.get('minPrice')))&&(!q.get('maxPrice')||p.price<=Number(q.get('maxPrice')));
 });
 if(q.get('sort')==='price_asc')items.sort((a,b)=>a.price-b.price);
 if(q.get('sort')==='price_desc')items.sort((a,b)=>b.price-a.price);
 const page=Math.max(1,parseInt(q.get('page'))||1),limit=Math.max(1,Math.min(24,parseInt(q.get('limit'))||9)),total=items.length;
 return {items:items.slice((page-1)*limit,page*limit),total,page,pages:Math.ceil(total/limit)};
}
