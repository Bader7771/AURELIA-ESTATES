import '../api/lib/load-env.js';
import bcrypt from 'bcryptjs';
import {connectDb} from '../api/lib/db.js';
import Admin from '../api/models/Admin.js';
import mongoose from 'mongoose';

try {
  await connectDb();
  if (mongoose.connection.name !== 'aurelia') {
    throw Object.assign(new Error('Setup requires the aurelia database'), {code:'WRONG_DATABASE'});
  }
  const exists = Boolean(await Admin.exists({}));
  if (process.argv.includes('--check')) {
    console.log('DATABASE_CONNECTED true');
    console.log('DATABASE_IS_AURELIA true');
    console.log('ADMIN_ACCOUNT_EXISTS', exists);
  } else if (exists) {
    console.log('An administrator already exists. No account or password was changed.');
  } else {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
      throw Object.assign(new Error('Set a valid ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters in the project .env'), {code:'ADMIN_CONFIGURATION_REQUIRED'});
    }
    const passwordHash = await bcrypt.hash(password,12);
    await Admin.create({email,passwordHash,role:'admin',active:true});
    console.log('Administrator created successfully. Credentials were not printed.');
  }
} catch (error) {
  const code=error.code||error.cause?.code||error.name;
  console.error('Admin setup failed:',code);
  if (['ADMIN_CONFIGURATION_REQUIRED','WRONG_DATABASE'].includes(code)) console.error(error.message);
  process.exitCode=1;
} finally {
  await mongoose.disconnect();
}
