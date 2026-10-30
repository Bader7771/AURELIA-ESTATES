import mongoose from 'mongoose';
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:120},email:{type:String,required:true,lowercase:true,trim:true,maxlength:254},phone:{type:String,trim:true,maxlength:40,default:''},category:{type:String,enum:['General','Buying','Selling','Investment','Viewing','Other'],default:'General'},property:{type:mongoose.Schema.Types.ObjectId,ref:'Property',default:null},message:{type:String,required:true,trim:true,maxlength:3000},status:{type:String,enum:['New','In Progress','Resolved'],default:'New'}},{timestamps:true});
schema.index({status:1,createdAt:-1});schema.index({email:1,createdAt:-1});
export default mongoose.models.Inquiry||mongoose.model('Inquiry',schema);
