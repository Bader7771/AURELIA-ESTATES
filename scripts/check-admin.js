import '../api/lib/load-env.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {connectDb} from '../api/lib/db.js';
import Admin from '../api/models/Admin.js';

try {
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if(!email){console.error('CHECK_RESULT ADMIN_EMAIL_MISSING');process.exitCode=1}
  else {
    await connectDb();
    if(mongoose.connection.name!=='aurelia')throw Object.assign(new Error(),{code:'WRONG_DATABASE'});
    const account=await Admin.findOne({email}).select('+passwordHash').lean();
    if(!account)console.log('CHECK_RESULT ACCOUNT_NOT_FOUND');
    else if(account.active===false||account.role!=='admin')console.log('CHECK_RESULT ACCOUNT_DISABLED');
    else if(!/^\$2[aby]\$\d\d\$/.test(account.passwordHash||''))console.log('CHECK_RESULT INVALID_PASSWORD_HASH');
    else if(!process.env.ADMIN_PASSWORD)console.log('CHECK_RESULT PASSWORD_NOT_SET_IN_ENV');
    else console.log('CHECK_RESULT',await bcrypt.compare(process.env.ADMIN_PASSWORD,account.passwordHash)?'PASSWORD_MATCHES':'PASSWORD_DOES_NOT_MATCH');
  }
} catch(error){console.error('CHECK_FAILED',error.code||error.cause?.code||error.name);process.exitCode=1}
finally {await mongoose.disconnect()}
