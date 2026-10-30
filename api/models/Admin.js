import mongoose from 'mongoose';
const schema=new mongoose.Schema({email:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true,select:false},role:{type:String,default:'admin',enum:['admin']},active:{type:Boolean,default:true}},{timestamps:true});
export default mongoose.models.Admin||mongoose.model('Admin',schema);
