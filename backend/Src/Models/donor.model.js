// models/Donation.js
import mongoose from "mongoose";

const DonationSchema = new mongoose.Schema({
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    request: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RequestBlood",
        required: true
    },
    status: {
        type: String,
        enum: ["scheduled", "completed", "cancelled", "failed"],
        default: "scheduled"
    },
    unitsDonated: {
        type: Number,
        default: 1
    },
    donationDate: {
        type: Date,
        required: true
    },
    scheduledDate: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    notes: {
        type: String
    }
}, { timestamps: true });
DonationSchema.post('save', async function(doc) {
    if (doc.status === 'completed') {
        const User = mongoose.model("User");
        await User.findByIdAndUpdate(doc.donor, {
            lastDonationDate: doc.donationDate
        });
    }
});

export const Donation = mongoose.model("Donation", DonationSchema);