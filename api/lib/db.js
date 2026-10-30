import mongoose from 'mongoose';
const cached=globalThis.__aureliaDb||(globalThis.__aureliaDb={conn:null,promise:null});
function validatedUri(){
 const raw=process.env.MONGODB_URI;
 if(!raw)throw Object.assign(new Error('Database is not configured'),{status:503});
 if(raw!==raw.trim()||raw.endsWith('\\')||raw.startsWith('MONGODB_URI='))throw Object.assign(new Error('Invalid MONGODB_URI format'),{status:503});
 try{const uri=new URL(raw);if(!['mongodb:','mongodb+srv:'].includes(uri.protocol)||!uri.hostname)throw Error();return raw}catch{throw Object.assign(new Error('Invalid MONGODB_URI format'),{status:503})}
}
export async function connectDb(){
 const uri=validatedUri();
 if(cached.conn?.connection?.readyState===1)return cached.conn;
 if(cached.conn?.connection?.readyState!==1){cached.conn=null;cached.promise=null}
 if(!cached.promise)cached.promise=mongoose.connect(uri,{bufferCommands:false,serverSelectionTimeoutMS:8000}).catch(error=>{cached.promise=null;throw error});
 cached.conn=await cached.promise;return cached.conn;
}
