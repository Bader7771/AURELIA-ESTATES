import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import dns from 'node:dns/promises';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import{connectDb}from'../api/lib/db.js';

const envPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.env');
const shellUriPresent=Boolean(process.env.MONGODB_URI);
const filePresent=fs.existsSync(envPath);
const parsed=filePresent?dotenv.parse(fs.readFileSync(envPath)):{};
if(filePresent)dotenv.config({path:envPath,quiet:true});
const raw=process.env.MONGODB_URI||'';
console.log('ENV_FILE_PRESENT',filePresent);
console.log('URI_SOURCE',shellUriPresent?'shell environment':filePresent?'project .env':'missing');
console.log('ENV_FILE_URI_PRESENT',Boolean(parsed.MONGODB_URI));
console.log('NESTED_ENV_PREFIX',raw.startsWith('MONGODB_URI='));
console.log('TRAILING_BACKSLASH',raw.endsWith('\\'));
console.log('LEADING_OR_TRAILING_SPACE',raw!==raw.trim());
let uri;
try{uri=new URL(raw);if(!['mongodb:','mongodb+srv:'].includes(uri.protocol))throw Error('scheme')}catch{console.log('URI_FORMAT','INVALID');process.exit(1)}
console.log('URI_FORMAT','VALID');
console.log('SCHEME',uri.protocol.slice(0,-1));
console.log('HOSTNAME',uri.hostname);
console.log('DATABASE_NAME_PRESENT',uri.pathname.length>1);
console.log('USERNAME_PRESENT',Boolean(uri.username));
console.log('PASSWORD_PRESENT',Boolean(uri.password));
const lookup=async(label,fn)=>{try{const result=await fn();console.log(label,'OK',Array.isArray(result)?result.length:1);return result}catch(error){console.log(label,'FAIL',error.code||error.name);return null}};
await lookup('CONTROL_DNS_A',()=>dns.resolve4('example.com'));
let targets=[];
if(uri.protocol==='mongodb+srv:'){
 const srv=await lookup('ATLAS_SRV',()=>dns.resolveSrv('_mongodb._tcp.'+uri.hostname));
 await lookup('ATLAS_TXT',()=>dns.resolveTxt(uri.hostname));
 if(srv)targets=srv.map(item=>({host:item.name,port:item.port}));
}else targets=[{host:uri.hostname,port:Number(uri.port)||27017}];
function tcp(host,port){return new Promise(resolve=>{const socket=net.connect({host,port,timeout:3000});let done=false;const finish=(result)=>{if(done)return;done=true;socket.destroy();resolve(result)};socket.once('connect',()=>finish('OK'));socket.once('error',error=>finish('FAIL '+(error.code||error.name)));socket.once('timeout',()=>finish('FAIL TIMEOUT'))})}
for(const target of targets.slice(0,3)){
 const a=await lookup('NODE_A',()=>dns.resolve4(target.host));
 const aaaa=await lookup('NODE_AAAA',()=>dns.resolve6(target.host));
 if(a||aaaa)console.log('NODE_TCP',target.host,target.port,await tcp(target.host,target.port));
}
const started=Date.now();
try{await connectDb();await mongoose.connection.db.admin().ping();console.log('MONGODB_DRIVER','CONNECTED');await mongoose.disconnect()}catch(error){console.log('MONGODB_DRIVER','FAILED');console.log('DRIVER_ERROR_NAME',error.name);console.log('DRIVER_ERROR_CODE',error.code||error.cause?.code||'none');console.log('DRIVER_ERROR_SYSCALL',error.syscall||error.cause?.syscall||'none');console.log('DRIVER_ERROR_STAGE',error.syscall==='querySrv'?'SRV DNS lookup':error.name==='MongoServerSelectionError'?'server selection':'configuration or other');console.log('DRIVER_ELAPSED_MS',Date.now()-started);process.exitCode=1}
