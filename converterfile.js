const AWS = require('aws-sdk');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const videoQualities = [
  { bitrate: '6221600', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028', name: '1080' },
  { bitrate: '2149280', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001f', name: '720' },
  { bitrate: '1000000', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001e', name: '480' },
  { bitrate: '460560', audioCodec: 'mp4a.40.5', videoCodec: 'avc1.420016', name: '360' }
];
// Definir o caminho para o ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Função para converter MP4 para M3U8
async function converterMP4paraM3U8(inputFile, outputFile, videoUrl) {
  const videoQualities = [
    { bitrate: '6221600', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028', name: '1080' },
    { bitrate: '2149280', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001f', name: '720' },
    { bitrate: '1000000', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001e', name: '480' },
    { bitrate: '460560', audioCodec: 'mp4a.40.5', videoCodec: 'avc1.420016', name: '360' }
  ];

  const promises = videoQualities.map((quality, index) => {
    const outputFilePath = `${outputFile}_${quality.name}.m3u8`;

    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-b:v ${quality.bitrate}`,
          '-hls_time 5',
          '-hls_playlist_type vod'
        ])
        .output(outputFilePath)
        .on('end', () => resolve(outputFilePath))
        .on('error', (err) => reject(err))
        .run();
    });
  });

  try {
    await Promise.all(promises);
    const playlistEntries = videoQualities.map((quality, index) => `#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=${quality.bitrate},CODECS="${quality.audioCodec},${quality.videoCodec}",RESOLUTION=${quality.resolution},NAME="${quality.name}"\n${videoUrl}${outputFile}_${quality.name}.m3u8`);
    const m3u8Content = `#EXTM3U\n${playlistEntries.join('\n')}`;
    const m3u8File = `${outputFile}_playlist.m3u8`;
    require('fs').writeFileSync(m3u8File, m3u8Content);
    console.log(`Arquivo m3u8 gerado em: ${m3u8File}`);
    return m3u8File;
  } catch (error) {
    console.error('Ocorreu um erro ao converter o vídeo:', error);
    throw error;
  }
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
    // for (const file of files) {
    //   const filePath = path.join(pasta, file);

    //    fs.unlink(filePath, err => {
    //         if (err) {
    //             console.error('Erro ao apagar o arquivo:', err);
    //             return;
    //         }
    //         console.log(`Arquivos apagados com sucesso.`);
    //     });
    // }

    return response.data.response;

  } catch (error) {
    console.error('Erro ao enviar arquivos para URL:', error);
  }
}

async function getPlaylistsUrls(videoUrl, pasta) {
  try {

    let playslitsUrls = [];
    const files = fs.readdirSync(pasta);
    for (let file of files) {
      let filePath = path.join(pasta, file);
      let { name } = path.parse(filePath);

      console.log(name);
      if (name.includes("_playlist")){
        let playlistUrl = videoUrl +'out/' +name+'.m3u8';
        playslitsUrls.push(playlistUrl);
      }

    }

    return playslitsUrls;
  } catch (error) {
    console.error('Erro para trazer urls das playlists:', error);
  }
}

const outputDirectory = './out';

// Converter MP4 para M3U8
async function converterArquivoFile(inputFile, outputFileName, videoUrl) {
  try {

    const outputFileCompletePath = 'out/' + outputFileName + '.m3u8'; // Adicione a extensão corretamente

    await converterMP4paraM3U8(inputFile, outputFileCompletePath, videoUrl);

   // const urls = await enviarArquivosParaURL(outputDirectory, repositoryUrl); // Corrija o nome da variável

   const urls = await getPlaylistsUrls(videoUrl, outputDirectory);

   return urls;
} catch (error) {
    // Remova os parênteses extras
    console.error('Erro ao converter MP4 para M3U8:', error);
  }
}

async function enviarParaBucketS3(req){
  AWS.config.update({
    accessKeyId: req.accessKeyId,
    secretAccessKey: req.secretAccessKey,
    region: req.region // ex: 'us-east-1'
  });
  const s3 = new AWS.S3();

  const bucketName = req.bucketName;
  const files = fs.readdirSync(outputDirectory);

  console.log('---> '+outputDirectory)
  for (const file of files) {
    let filePath = path.join(outputDirectory, file);
    let { fileName } = path.parse(filePath);
    const fileContent = fs.readFileSync(filePath);

    const params = {
      Bucket: bucketName,
      Key: `/out/${fileName}`,
      Body: fileContent
    };
    // Enviar arquivo para o S3
    s3.upload(params).promise();
    console.log('Arquivos enviados com sucesso para bucket:', bucketName);
  }
}
async function converterfile(req, res) {
  try {
    const outputFileName = req.file.originalname.replace('.mp4', '');
    const inputFile = req.file;
    const videoUrl = req.body.videoUrl;

    const urls = await converterArquivoFile(
      inputFile.path,
      outputFileName,
      videoUrl
    );

    //enviarParaBucketS3(req.body);

    res.send({});
  } catch (error) {
    res.send(error);
  }
}

module.exports = {
  converterfile
};
