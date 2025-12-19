import express from "express";
import { configDotenv } from "dotenv";
import { xss } from "express-xss-sanitizer";
import path from 'path'; // Import path
import { fileURLToPath } from 'url'; // Needed for ES Modules
import nyayaRoutes from './routes/nyayaRoutes.js';

configDotenv();

const app = express();
const PORT = process.env.PORT || 3000;

// --- FIX FOR DIRECTORY PATH IN ES MODULES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(xss());
app.use(express.json());

// --- SERVE UPLOADS FOLDER PUBLICLY ---
// This allows you to access images via http://localhost:PORT/uploads/filename.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/nyaya', nyayaRoutes);

app.get('/', (req, res) => { res.send("Nyaya-Lite Backend Running") });

app.listen(PORT, () => {
    console.log(`App is Running on ${PORT}`);
});