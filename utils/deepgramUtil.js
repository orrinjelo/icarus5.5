const fs = require('fs');
const YoutubeMp3Downloader = require('youtube-mp3-downloader');
// const { Deepgram } = require('@deepgram/sdk'),
// const ffmpeg = require('ffmpeg-static'),
const config = require("../config/config.json");
const Discord = require("discord.js");
const { createClient } = require('@deepgram/sdk');
const deepgram = createClient(config.deepgramSecret);

// const deepgram = new Deepgram(config.deepgramSecret);
// const YD = new YoutubeMp3Downloader({
//   ffmpegPath: '/usr/bin/ffmpeg',
//   outputPath: './temp/',
//   youtubeVideoQuality: 'highestaudio'
// });

// YD.on('progress', (data) => {
//   console.log(data.progress.percentage + '% downloaded');
// });

// YD.on('finished', async (err, video) => {
//   const videoFileName = video.file;
//   console.log(`Downloaded ${videoFileName}`);

//   // Continue on to get transcript here
// });

function youtube_parser(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length == 11) ? match[7] : false;
}

const Downloader = function() {

  const self = this;

  // Configure YoutubeMp3Downloader with your settings
  self.YD = new YoutubeMp3Downloader({
    "ffmpegPath": "/usr/bin/ffmpeg", // FFmpeg binary location
    "outputPath": "/var/tmp", // Output file location (default: the home directory)
    "youtubeVideoQuality": "highestaudio", // Desired video quality (default: highestaudio)
    "queueParallelism": 2, // Download parallelism (default: 1)
    "progressTimeout": 2000, // Interval in ms for the progress reports (default: 1000)
    "outputOptions" : ["-af", "silenceremove=1:0:-50dB"] // Additional output options passend to ffmpeg
  });

  self.callbacks = {};

  self.YD.on("finished", function(error, data) {
    if (self.callbacks[data.videoId]) {
      self.callbacks[data.videoId](error, data);
    } else {
      console.log("Error: No callback for videoId!");
    }
  });

  self.YD.on("error", function(error, data) {
    console.error(error + " on videoId " + data?.videoId);
    if (self.callbacks[data?.videoId]) {
      self.callbacks[data?.videoId](error, data);
    } else {
      console.log("Error: No callback for videoId!");
    }
  });

};

Downloader.prototype.getMP3 = function(track, callback) {

  const self = this;

  // Register callback
  self.callbacks[track.videoId] = callback;
  // Trigger download
  self.YD.download(track.videoId, track.name);

};

async function transcribe(videoUrl) {
  const videoId = youtube_parser(videoUrl);
  let videoFileName = "temp.mp3";
  if (videoId) {
    let i = 0;
    const dl = new Downloader();
    dl.getMP3({ videoId: videoId, name: videoFileName }, async function(err, res) {
      i++;
      if (err) {
        throw err;
      } else {
        console.log("Song " + i + " was downloaded: " + res.file);
        // const file = {
        //   buffer: fs.readFileSync(`${res.file}`),
        //   mimetype: 'audio/mp3',
        // };

        // const options = {
        //   punctuate: true,
        // };

        const result = await deepgram.listen.prerecorded.transcribeFile(
          fs.createReadStream(res.file),
          {
            punctuate: true,
            model: "nova-2"
          })
          .catch((e) => console.log(e));

        // console.log(result);
        // console.log(result.result?.metadata);
        // console.log(result.result?.error);
        // console.log(result.result?.metadata?.models);
        // console.log(result.result?.metadata?.model_info);
        // console.log(result.result?.results);
        const webhook = new Discord.WebhookClient({ url: config.error.url });

        try {
          console.log(result.result?.results?.channels[0].alternatives[0].transcript);
          webhook.send(result.result?.results?.channels[0].alternatives[0].transcript);
        } catch (e) {
          webhook.send("Errors in transcribing.  Sorry. :(");
        }

      }
    });
  } else {
    console.log("Unable to produce transcript.");
  }
}

const deepgramUtil = {
  transcribe: transcribe
};

module.exports = deepgramUtil;