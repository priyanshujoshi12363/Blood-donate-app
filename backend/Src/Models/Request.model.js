import mongoose from "mongoose";

const RequestBloodSchema = new mongoose.Schema({

    RequestPerson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    BloodType: {
        type: String,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        required: true
    },
    description:{
        type:String
    },
    HospitalAddress:{
        type:String,
        required:true
    },
    unitRequired:{
        type:Number,
        required:true
    },
    ContactPhone:{
        type:String,
        required:true
    },
     donations: [{
        donor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        unitsDonated: {
            type: Number,
            default: 1
        },
        donationDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ["scheduled", "completed", "cancelled"],
            default: "scheduled"
        }
    }],
}, { timestamps: true })


export const RequestBlood = mongoose.model("RequestBlood", RequestBloodSchema)