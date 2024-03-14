const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// Definir o caminho para o ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Função para converter MP4 para M3U8
async function converterMP4paraM3U8(inputFile, outputFile) {
  return await new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .outputOptions('-hls_time 5')
      .output(outputFile)
      .on('end', () => resolve(outputFile))
      .on('error', (err) => reject(err))
      .run();
  });
}

async function enviarArquivosParaURL(pasta, url) {
  try {
    const files = fs.readdirSync(pasta);
    const formData = new FormData();
    for (const file of files) {
      const filePath = path.join(pasta, file);

      // Verifica se o caminho é um arquivo
      if (fs.statSync(filePath).isFile()) {
        formData.append('file', fs.createReadStream(filePath));
      }
    }
    const response = await axios.post(url, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });


    console.log('Arquivos enviados com sucesso para:', url);
    console.log('Resposta do servidor:', response.data);

    //apagar arquivos da pasta apos enviar
    for (const file of files) {
      const filePath = path.join(pasta, file);

       fs.unlink(filePath, err => {
            if (err) {
                console.error('Erro ao apagar o arquivo:', err);
                return;
            }
            console.log(`Arquivos apagados com sucesso.`);
        });
    }

    return response.data.response;

  } catch (error) {
    console.error('Erro ao enviar arquivos para URL:', error);
  }
}

const outputDirectory = './output';

// Converter MP4 para M3U8
async function converterArquivo(inputFile, outputFileName, repositoryUrl) {
  try {
    const outputFileCompletePath = 'output/' + outputFileName + '.m3u8';
    await converterMP4paraM3U8(inputFile, outputFileCompletePath);

    const urls = await enviarArquivosParaURL(outputDirectory, repositoryUrl);
    return urls;
} catch (error) {
    console.error('Erro ao converter MP4 para M3U8:', error);
  }
}

async function converter(req, res) {
  try {
    const body = req.body;

    const inputFile = body.videoUrl;
    const repositoryUrl = body.repositoryUrl;

    const parts = inputFile.split('/');
    const fileNameWithExtension = parts[parts.length - 1];
    const outputFileName = fileNameWithExtension.split('.')[0];

    const urls = await converterArquivo(
      inputFile,
      outputFileName,
      repositoryUrl
    );

    res.send(urls);
  } catch (error) {
    res.send(error);
  }
}

module.exports = {
  converter
};
