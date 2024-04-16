const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const videoQualities = [
  { resolution: '1280x720', bitrate: '2149280', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001f', name: '720' },
  { resolution: '320x184', bitrate: '246440', audioCodec: 'mp4a.40.5', videoCodec: 'avc1.42000d', name: '240' },
  { resolution: '512x288', bitrate: '460560', audioCodec: 'mp4a.40.5', videoCodec: 'avc1.420016', name: '380' },
  { resolution: '848x480', bitrate: '836280', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001f', name: '480' },
  { resolution: '1920x1080', bitrate: '6221600', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028', name: '1080' }
];
// Definir o caminho para o ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

// Função para converter MP4 para M3U8
async function converterMP4paraM3U8(inputFile, outputFile) {
  const videoQualities = [
    { resolution: '1280x720', bitrate: '2149280', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001f', name: '720' },
    { resolution: '320x184', bitrate: '246440', audioCodec: 'mp4a.40.5', videoCodec: 'avc1.42000d', name: '240' },
    { resolution: '512x288', bitrate: '460560', audioCodec: 'mp4a.40.5', videoCodec: 'avc1.420016', name: '380' },
    { resolution: '848x480', bitrate: '836280', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.64001f', name: '480' },
    { resolution: '1920x1080', bitrate: '6221600', audioCodec: 'mp4a.40.2', videoCodec: 'avc1.640028', name: '1080' }
  ];

  const promises = videoQualities.map((quality, index) => {
    const outputFilePath = `${outputFile}_${quality.name}.m3u8`;

    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          `-vf scale=${quality.resolution}`,
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
    const playlist = promises.map((_, index) => `#EXT-X-STREAM-INF:PROGRAM-ID=1,BANDWIDTH=${videoQualities[index].bitrate},CODECS="${videoQualities[index].audioCodec},${videoQualities[index].videoCodec}",RESOLUTION=${videoQualities[index].resolution},NAME="${videoQualities[index].name}" ${outputFile}_${videoQualities[index].name}.m3u8`).join('\n');
    const m3u8Content = `#EXTM3U\n${playlist}`;
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

const outputDirectory = './output';

// Converter MP4 para M3U8
async function converterArquivoFile(inputFile, outputFileName, repositoryUrl) {
  try {

    const outputFileCompletePath = 'output/' + outputFileName + '.m3u8'; // Adicione a extensão corretamente

    await converterMP4paraM3U8(inputFile, outputFileCompletePath);

    const urls = await enviarArquivosParaURL(outputDirectory, repositoryUrl); // Corrija o nome da variável
    return urls;
} catch (error) {
    // Remova os parênteses extras
    console.error('Erro ao converter MP4 para M3U8:', error);
  }
}

async function converterfile(req, res) {
  try {
    const outputFileName = req.file.originalname.replace('.mp4', '');

    const inputFile = req.file;
    const repositoryUrl = req.body.repositoryUrl;

    console.log('repository url '+repositoryUrl);
    const urls = await converterArquivoFile(
      inputFile.path,
      outputFileName,
      repositoryUrl
    );

    res.send(urls);
  } catch (error) {
    res.send(error);
  }
}

module.exports = {
  converterfile
};
