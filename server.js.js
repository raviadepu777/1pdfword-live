const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { promisify } = require('util');

const app = express();
// The PORT number is provided by Render, so we use `process.env.PORT`
const port = process.env.PORT || 3000;

// Promisify the convert function for async/await
const convertAsync = promisify(libre.convert);

// Enable CORS for all routes
app.use(cors());

// Serve the static index.html file from a 'public' directory
// This is how Render serves your front-end
app.use(express.static('public'));

// Create an 'uploads' directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage: storage });

// The main conversion API endpoint
app.post('/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const inputPath = req.file.path;
    const outputFormat = req.body.to || 'docx';
    const outputPath = path.join(uploadsDir, `${Date.now()}.${outputFormat}`);

    try {
        console.log(`Converting ${inputPath} to ${outputFormat}`);
        const fileBuffer = fs.readFileSync(inputPath);
        const convertedBuffer = await convertAsync(fileBuffer, `.${outputFormat}`, undefined);
        fs.writeFileSync(outputPath, convertedBuffer);

        res.download(outputPath, (err) => {
            if (err) console.error(`Error sending file:`, err);
            // Clean up both temporary files
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        });

    } catch (err) {
        console.error(`Conversion Error:`, err);
        fs.unlinkSync(inputPath); // Clean up on error
        res.status(500).send('Error during file conversion.');
    }
});

// A special route to serve the main HTML page for any other request
// This allows your single-page app to work correctly
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ Server is running on port ${port}`);
});