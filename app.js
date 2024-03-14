const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const multer = require('multer');

const conversaoDeArquivos = require('./converter');
const conversaoDeArquivosFile = require('./converterfile');
app.use(bodyParser.json());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Diretório onde os arquivos serão salvos
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

//file e repositoryUrl como param
app.post('/converterfile', upload.single('file'), (req, res) => {
    if (!req.file || req.repositoryUrl) {
        return res.status(400).send('Nenhum arquivo ou repositoryUrl enviado.');
    }
    conversaoDeArquivosFile.converterfile(req, res);
});

//videoUrl e repositoryUrl como param
app.post('/converter', (req, res) => {
    conversaoDeArquivos.converter(req, res);
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
