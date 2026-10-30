import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {v2 as cloudinary} from 'cloudinary';
import {z} from 'zod';
import {connectDb} from './lib/db.js';
import Property from './models/Property.js';
import Admin from './models/Admin.js';
import Inquiry from './models/Inquiry.js';
import SiteSettings from './models/SiteSettings.js';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.use((_req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});next()});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fail=(status,message)=>Object.assign(new Error(message),{status});
const secret=()=>{if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw fail(503,'Authentication is not configured');return process.env.JWT_SECRET};
const csrf=(req,res,next)=>{try{const origin=req.get('origin');if(origin&&new URL(origin).host!==req.get('host'))throw Error();next()}catch{next(fail(403,'Invalid request origin'))}};
const auth=wrap(async(req,res,next)=>{const token=req.cookies.aurelia_session;if(!token)throw fail(401,'Authentication required');let decoded;try{decoded=jwt.verify(token,secret())}catch{throw fail(401,'Session expired')}await connectDb();const admin=await Admin.findById(decoded.sub).lean();if(!admin||admin.role!=='admin'||admin.active===false)throw fail(403,'Access denied');req.admin=admin;next()});
const loginLimit=rateLimit({
 windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,
 skipSuccessfulRequests:true,
 requestWasSuccessful:(_req,res)=>res.statusCode<400||res.statusCode>=500,
 handler:(req,res)=>{
  const retryAfter=Math.max(1,Math.ceil(((req.rateLimit.resetTime?.getTime()||Date.now()+900000)-Date.now())/1000));
  res.set('Retry-After',String(retryAfter)).status(429).json({error:'Too many login attempts. Please wait before trying again.',retryAfter});
 }
});
const inquiryLimit=rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many inquiries. Please try again later.'}});
const url=z.string().url().refine(v=>v.startsWith('https://'),'Use an HTTPS URL');
const image=z.object({url:url.refine(v=>new URL(v).hostname==='res.cloudinary.com','Use a Cloudinary image URL'),publicId:z.string().min(1).max(240),alt:z.string().max(160).optional()});
const propertyInput=z.object({title:z.string().trim().min(3).max(140),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),price:z.coerce.number().positive(),currency:z.literal('USD').default('USD'),listingStatus:z.enum(['For Sale','For Rent']).default('For Sale'),country:z.string().trim().min(2).max(100).default('United States'),state:z.string().trim().min(2).max(100),city:z.string().trim().min(2).max(100),neighborhood:z.string().trim().max(140).optional().default(''),address:z.string().trim().max(240).optional().default(''),type:z.enum(['Estate','Contemporary','Penthouse','Villa','Waterfront','Ranch','Townhouse']),beds:z.coerce.number().int().min(0).max(100),baths:z.coerce.number().min(0).max(100),area:z.coerce.number().positive(),lotSize:z.string().trim().max(100).optional().default(''),description:z.string().trim().min(30).max(10000),amenities:z.array(z.string().trim().min(1).max(120)).max(50).default([]),images:z.array(image).max(30).default([]),coverIndex:z.coerce.number().int().min(0).default(0),featured:z.boolean().default(false),published:z.boolean().default(false)}).refine(v=>!v.published||v.images.length>0,{path:['images'],message:'A published property needs a photograph'}).refine(v=>v.images.length===0||v.coverIndex<v.images.length,{path:['coverIndex'],message:'Choose a valid cover image'});
const inquiryInput=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(254),phone:z.string().trim().max(40).optional().default(''),category:z.enum(['General','Buying','Selling','Investment','Viewing','Other']).default('General'),propertyId:z.string().optional(),message:z.string().trim().min(20).max(3000),website:z.string().optional().default('')});
const settingsInput=z.object({companyName:z.string().trim().min(2).max(100),tagline:z.string().trim().max(180),email:z.union([z.string().email(),z.literal('')]),phone:z.string().trim().max(40),officeAddress:z.string().trim().max(240),logoUrl:z.union([url,z.literal('')]),aboutIntro:z.string().trim().min(20).max(1200),aboutBody:z.string().trim().min(20).max(3000),services:z.array(z.object({title:z.string().trim().min(2).max(100),description:z.string().trim().min(10).max(600)})).min(1).max(12),socialLinks:z.object({instagram:z.union([url,z.literal('')]),linkedin:z.union([url,z.literal('')]),facebook:z.union([url,z.literal('')])})});
function queryParams(q){
 for(const k of ['page','limit','minPrice','maxPrice','beds','baths'])if(q[k]!==undefined&&(!Number.isFinite(Number(q[k]))||Number(q[k])<0))throw fail(400,'Invalid '+k);
 const page=Math.max(1,Math.min(10000,parseInt(q.page)||1)),limit=Math.max(1,Math.min(24,parseInt(q.limit)||9));
 const filter={};if(q.search){const s=String(q.search).slice(0,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=['title','city','state','neighborhood'].map(k=>({[k]:{$regex:s,$options:'i'}}))}
 if(q.type&&q.type!=='All'){if(!Property.schema.path('type').enumValues.includes(String(q.type)))throw fail(400,'Invalid property type');filter.type=String(q.type)}
 if(q.city)filter.city=String(q.city).slice(0,100);
 if(q.listingStatus){if(!['For Sale','For Rent'].includes(q.listingStatus))throw fail(400,'Invalid listing status');filter.listingStatus=q.listingStatus}
 if(q.minPrice)filter.price={...filter.price,$gte:Number(q.minPrice)};if(q.maxPrice)filter.price={...filter.price,$lte:Number(q.maxPrice)};
 if(q.beds)filter.beds={$gte:Number(q.beds)};if(q.baths)filter.baths={$gte:Number(q.baths)};
 const sort=q.sort==='price_asc'?{price:1}:q.sort==='price_desc'?{price:-1}:{createdAt:-1};return{page,limit,filter,sort};
}
function cloud(){if(!process.env.CLOUDINARY_CLOUD_NAME||!process.env.CLOUDINARY_API_KEY||!process.env.CLOUDINARY_API_SECRET)throw fail(503,'Image uploads are not configured');cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET});return cloudinary}
async function cleanupImages(oldImages=[],newImages=[]){const current=new Set(newImages.map(i=>i.publicId));for(const img of oldImages){if(current.has(img.publicId)||img.publicId.startsWith('demo/'))continue;const used=await Property.exists({'images.publicId':img.publicId});if(!used)await cloud().uploader.destroy(img.publicId,{resource_type:'image'})}}
const pageResult=(items,total,page,limit)=>({items,total,page,pages:Math.ceil(total/limit)});

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'aurelia-api'}));
app.get('/api/settings',wrap(async(_req,res)=>{await connectDb();const item=await SiteSettings.findOne({key:'main'}).lean();res.json({item:item||new SiteSettings().toObject()})}));
app.get('/api/properties',wrap(async(req,res)=>{await connectDb();const {page,limit,filter,sort}=queryParams(req.query);filter.published=true;const [items,total]=await Promise.all([Property.find(filter).sort(sort).skip((page-1)*limit).limit(limit).lean(),Property.countDocuments(filter)]);res.json(pageResult(items,total,page,limit))}));
app.get('/api/properties/featured',wrap(async(_req,res)=>{await connectDb();res.json({items:await Property.find({published:true,featured:true}).sort({createdAt:-1}).limit(6).lean()})}));
app.get('/api/properties/:slug',wrap(async(req,res)=>{await connectDb();const item=await Property.findOne({slug:req.params.slug,published:true}).lean();if(!item)throw fail(404,'Property not found');res.json({item})}));
app.post('/api/inquiries',inquiryLimit,csrf,wrap(async(req,res)=>{const parsed=inquiryInput.safeParse(req.body);if(!parsed.success)return res.status(422).json({error:'Please check your inquiry',fields:parsed.error.flatten().fieldErrors});if(parsed.data.website)return res.status(201).json({ok:true});await connectDb();let property=null;if(parsed.data.propertyId){if(!mongoose.isValidObjectId(parsed.data.propertyId))throw fail(400,'Invalid property');property=await Property.findOne({_id:parsed.data.propertyId,published:true}).select('_id').lean();if(!property)throw fail(404,'Property not found')}const {website,propertyId,...input}=parsed.data;await Inquiry.create({...input,property:property?._id||null});res.status(201).json({ok:true})}));
app.post('/api/admin/login',csrf,loginLimit,wrap(async(req,res)=>{const parsed=z.object({email:z.string().trim().email(),password:z.string().min(1)}).safeParse(req.body);if(!parsed.success)throw fail(400,'Enter a valid email and password');await connectDb();const admin=await Admin.findOne({email:parsed.data.email.toLowerCase()}).select('+passwordHash');if(!admin||admin.active===false||!(await bcrypt.compare(parsed.data.password,admin.passwordHash)))throw fail(401,'Invalid credentials');const token=jwt.sign({sub:admin.id},secret(),{expiresIn:'12h'});res.cookie('aurelia_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:12*3600*1000,path:'/'}).json({admin:{email:admin.email}})}));
app.post('/api/admin/logout',csrf,(_req,res)=>res.clearCookie('aurelia_session',{path:'/',httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict'}).json({ok:true}));
app.get('/api/admin/me',auth,(req,res)=>res.json({admin:{email:req.admin.email}}));
app.get('/api/admin/dashboard',auth,wrap(async(_req,res)=>{const [total,published,featured,newInquiries,pendingInquiries,recentProperties,recentInquiries]=await Promise.all([Property.countDocuments(),Property.countDocuments({published:true}),Property.countDocuments({featured:true}),Inquiry.countDocuments({status:'New'}),Inquiry.countDocuments({status:{$in:['New','In Progress']}}),Property.find().sort({createdAt:-1}).limit(5).lean(),Inquiry.find().sort({createdAt:-1}).limit(5).populate('property','title slug').lean()]);res.json({stats:{total,published,draft:total-published,featured,newInquiries,pendingInquiries},recentProperties,recentInquiries})}));
app.get('/api/admin/properties',auth,wrap(async(req,res)=>{const {page,limit,filter,sort}=queryParams(req.query);if(req.query.status==='published')filter.published=true;if(req.query.status==='draft')filter.published=false;const [items,total]=await Promise.all([Property.find(filter).sort(sort).skip((page-1)*limit).limit(limit).lean(),Property.countDocuments(filter)]);res.json(pageResult(items,total,page,limit))}));
app.get('/api/admin/properties/:id',auth,wrap(async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw fail(400,'Invalid property ID');const item=await Property.findById(req.params.id).lean();if(!item)throw fail(404,'Property not found');res.json({item})}));
app.post('/api/admin/properties',auth,csrf,wrap(async(req,res)=>{const parsed=propertyInput.safeParse(req.body);if(!parsed.success)return res.status(422).json({error:'Check the highlighted fields',fields:parsed.error.flatten().fieldErrors});const item=await Property.create(parsed.data);res.status(201).json({item})}));
app.patch('/api/admin/properties/:id',auth,csrf,wrap(async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw fail(400,'Invalid property ID');const parsed=propertyInput.safeParse(req.body);if(!parsed.success)return res.status(422).json({error:'Check the highlighted fields',fields:parsed.error.flatten().fieldErrors});const old=await Property.findById(req.params.id).lean();if(!old)throw fail(404,'Property not found');const item=await Property.findByIdAndUpdate(req.params.id,parsed.data,{new:true,runValidators:true}).lean();await cleanupImages(old.images,item.images).catch(console.error);res.json({item})}));
app.delete('/api/admin/properties/:id',auth,csrf,wrap(async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw fail(400,'Invalid property ID');const item=await Property.findByIdAndDelete(req.params.id).lean();if(!item)throw fail(404,'Property not found');await cleanupImages(item.images,[]).catch(console.error);res.json({ok:true})}));
app.get('/api/admin/inquiries',auth,wrap(async(req,res)=>{const page=Math.max(1,parseInt(req.query.page)||1),limit=20,filter={};if(req.query.status&&['New','In Progress','Resolved'].includes(req.query.status))filter.status=req.query.status;if(req.query.search){const search=String(req.query.search).slice(0,100).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=['name','email','message'].map(k=>({[k]:{$regex:search,$options:'i'}}))}const [items,total]=await Promise.all([Inquiry.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate('property','title slug').lean(),Inquiry.countDocuments(filter)]);res.json(pageResult(items,total,page,limit))}));
app.patch('/api/admin/inquiries/:id',auth,csrf,wrap(async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw fail(400,'Invalid inquiry ID');const parsed=z.object({status:z.enum(['New','In Progress','Resolved'])}).safeParse(req.body);if(!parsed.success)throw fail(422,'Invalid inquiry status');const item=await Inquiry.findByIdAndUpdate(req.params.id,parsed.data,{new:true,runValidators:true}).populate('property','title slug').lean();if(!item)throw fail(404,'Inquiry not found');res.json({item})}));
app.delete('/api/admin/inquiries/:id',auth,csrf,wrap(async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))throw fail(400,'Invalid inquiry ID');const item=await Inquiry.findByIdAndDelete(req.params.id).lean();if(!item)throw fail(404,'Inquiry not found');res.json({ok:true})}));
app.get('/api/admin/settings',auth,wrap(async(_req,res)=>{res.json({item:await SiteSettings.findOne({key:'main'}).lean()||new SiteSettings().toObject()})}));
app.put('/api/admin/settings',auth,csrf,wrap(async(req,res)=>{const parsed=settingsInput.safeParse(req.body);if(!parsed.success)return res.status(422).json({error:'Check the highlighted fields',fields:parsed.error.flatten().fieldErrors});const item=await SiteSettings.findOneAndUpdate({key:'main'},{$set:parsed.data},{upsert:true,new:true,runValidators:true}).lean();res.json({item})}));
app.post('/api/admin/uploads/sign',auth,csrf,(_req,res)=>{const c=cloud(),timestamp=Math.round(Date.now()/1000),folder='aurelia/properties';const signature=c.utils.api_sign_request({timestamp,folder},process.env.CLOUDINARY_API_SECRET);res.json({cloudName:process.env.CLOUDINARY_CLOUD_NAME,apiKey:process.env.CLOUDINARY_API_KEY,timestamp,folder,signature})});
app.use((err,req,res,_next)=>{if(err.code===11000)return res.status(409).json({error:'This URL slug or email already exists'});if(err.name==='ValidationError')return res.status(422).json({error:'Invalid data'});if(err.name==='CastError')return res.status(400).json({error:'Invalid identifier'});if(!err.status||err.status>=500)console.error('API error',{name:err.name,code:err.code||err.cause?.code||'UNKNOWN',path:req.path});res.status(err.status||500).json({error:err.status?err.message:'An unexpected error occurred'})});
export default app;
