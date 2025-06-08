const express = require('express');
const multer = require('multer');
const libre = require('libreoffice-convert');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { promisify } = require('util');

const app = express();
const port = process.env.PORT || 3000;

const convertAsync = promisify(libre.convert);

app.use(cors());

// Serve static files from the 'public' directory
// We will create this directory in our Dockerfile
app.use(express.static(path.join(__dirname, 'public')));

const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

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
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);
        });
    } catch (err) {
        console.error(`Conversion Error:`, err);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        res.status(500).send('Error during file conversion.');
    }
});

// A catch-all to serve index.html for any other GET request
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`✅ Server is running on port ${port}`);
});