import express from 'express';
import multer from 'multer';
import path from 'path';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
    loginUser,
    registerUser,
    getCases,
    getTasks,
    uploadEvidence
} from '../controllers/nyayaController.js';

const router = express.Router();

// --- LOCAL DISK STORAGE CONFIG ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Save to 'uploads' folder
    },
    filename: function (req, file, cb) {
        // Create unique filename: caseId_timestamp_filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

console.log(`Setting up nyaya routes (Local Storage)`);

// Public
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected
router.get('/cases', verifyToken, getCases);
router.get('/tasks/:case_id', verifyToken, getTasks);

// The 'file' field matches what you send from Flutter
router.post('/upload', verifyToken, upload.single('file'), uploadEvidence);

export default router;