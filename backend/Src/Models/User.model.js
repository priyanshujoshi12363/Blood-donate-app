import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    profilePic: {
        url: {
            type: String,
            default: "https://res.cloudinary.com/demo/image/upload/v1697123456/default-user.png"
        },
        public_id: {
            type: String,
            default: null
        }
    },
    username: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    phone: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    },

    age: {
        type: Number,
        required: true
    },

    bloodGroup: {
        type: String,
        enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
        required: true
    },

    gender: {
        type: String,
        enum: ["male", "female", "other"],
        required: true
    },

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },

        coordinates: {
            type: [Number],
        },
    },
    isDonor: {
        type: Boolean,
        default: false
    },

    lastDonationDate: {
        type: Date
    },
    sessionId: {
    type: String,
    default: null
},
   FCMtoken:{
    type:String
   }
}, { timestamps: true });

export const User = mongoose.model("User", UserSchema);
