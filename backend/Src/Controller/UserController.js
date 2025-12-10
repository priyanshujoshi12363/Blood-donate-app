import { User } from "../Models/User.model.js";
import bcrypt from "bcrypt";
import cloudinary from "../Utils/cloudinary.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const register = async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            phone,
            age,
            bloodGroup,
            gender
        } = req.body;

        if (!username || !email || !password || !phone || !age || !bloodGroup || !gender) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (await User.findOne({ email })) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }

        if (await User.findOne({ phone })) {
            return res.status(400).json({ success: false, message: "Phone already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        let profilePic = {
            url: "https://res.cloudinary.com/demo/image/upload/v1697123456/default-user.png",
            public_id: null
        };

        if (req.file) {
            const uploaded = await cloudinary.uploader.upload(req.file.path, {
                folder: "blood-users"
            });

            profilePic = {
                url: uploaded.secure_url,
                public_id: uploaded.public_id
            };
        }

        const sessionId = crypto.randomBytes(32).toString("hex");

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            phone,
            age,
            bloodGroup,
            gender,
            profilePic,
            sessionId
        });

        const token = jwt.sign(
            { userId: user._id, sessionId },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            sessionId,
            user
        });

    } catch (error) {
        console.error("REGISTER ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};
