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
       expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 48 hours from now
        index: { expires: 0 } 
    },
}, { timestamps: true })

RequestBloodSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

RequestBloodSchema.index({ location: "2dsphere" });

RequestBloodSchema.index({ status: 1, expiresAt: 1 });

RequestBloodSchema.virtual('isExpired').get(function() {
    return this.expiresAt && new Date() > this.expiresAt;
});

RequestBloodSchema.methods.updateStatus = function() {
    if (new Date() > this.expiresAt && this.status === 'active') {
        this.status = 'expired';
    }
    return this.status;
};

RequestBloodSchema.statics.findActive = function() {
    return this.find({
        status: 'active',
        expiresAt: { $gt: new Date() }
    });
};

RequestBloodSchema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({
        expiresAt: { $lt: new Date() },
        status: { $in: ['active', 'expired'] }
    });
    return result.deletedCount;
};

export const RequestBlood = mongoose.model("RequestBlood", RequestBloodSchema)