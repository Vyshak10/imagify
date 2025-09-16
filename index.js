const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const app = express();
const port = 3000;

// Basic setup
app.use(express.json());
app.use(express.static('public'));

// Start server
app.listen(port, () => {
  console.log(`Image compression service running on http://localhost:${port}`);
});