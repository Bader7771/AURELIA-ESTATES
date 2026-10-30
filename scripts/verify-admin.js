import '../api/lib/load-env.js';
const email=process.env.ADMIN_EMAIL?.trim();
const password=process.env.ADMIN_PASSWORD;
const origin='http://localhost:5173';
if(!email||!password||password.length<12){console.error('Set ADMIN_EMAIL and a password of at least 12 characters in the ignored .env before verification.');process.exit(1)}
try{
  const login=await fetch(origin+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({email,password})});
  console.log('LOGIN_HTTP_STATUS',login.status);
  if(!login.ok){const data=await login.json().catch(()=>({}));const safe=['Invalid credentials','Invalid request origin','Authentication is not configured','Too many login attempts. Please try again later.'];console.log('LOGIN_ERROR',safe.includes(data.error)?data.error:'Request failed; inspect the API server locally.');process.exitCode=1}
  else {
    const cookie=login.headers.get('set-cookie');
    if(!cookie)throw Error('SESSION_COOKIE_MISSING');
    console.log('HTTPONLY_COOKIE',cookie.toLowerCase().includes('httponly'));
    const headers={Cookie:cookie.split(';')[0],Origin:origin};
    const me=await fetch(origin+'/api/admin/me',{headers});
    console.log('SESSION_VERIFICATION_HTTP_STATUS',me.status);
    const logout=await fetch(origin+'/api/admin/logout',{method:'POST',headers});
    console.log('LOGOUT_HTTP_STATUS',logout.status);
    if(me.status!==200||logout.status!==200)process.exitCode=1;
  }
}catch(error){console.error('LOGIN_VERIFICATION_FAILED',error.cause?.code||error.code||'LOCAL_API_UNREACHABLE');process.exitCode=1}
