require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const play = require("play-dl");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const PREFIX = "!";
const queue = new Map();

client.once("ready", () => {
  console.log(`✅ Bot online: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    playCommand(message, args);
  }
});

async function playCommand(message, args) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply("❌ Pehle voice channel join karo");
  }

  const query = args.join(" ");
  if (!query) {
    return message.reply("❌ Song name ya YouTube link do");
  }

  let songInfo;

  try {
    if (play.yt_validate(query) === "video") {
      songInfo = await play.video_info(query);
    } else {
      const search = await play.search(query, { limit: 1 });
      if (!search.length) return message.reply("❌ Song nahi mila");
      songInfo = await play.video_info(search[0].url);
    }
  } catch (err) {
    console.log(err);
    return message.reply("❌ Song load karne me error aaya");
  }

  const song = {
    title: songInfo.video_details.title,
    url: songInfo.video_details.url
  };

  let serverQueue = queue.get(message.guild.id);

  if (!serverQueue) {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    serverQueue = {
      voiceChannel,
      connection: null,
      player,
      songs: []
    };

    queue.set(message.guild.id, serverQueue);
    serverQueue.songs.push(song);

    try {
      serverQueue.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });

      serverQueue.connection.subscribe(player);
      playSong(message.guild.id);

      message.reply(`🎶 **Now Playing:** ${song.title}`);
    } catch (error) {
      console.log(error);
      queue.delete(message.guild.id);
      return message.reply("❌ Voice channel join nahi ho paya");
    }
  } else {
    serverQueue.songs.push(song);
    message.reply(`➕ Queue me add hua: **${song.title}**`);
  }
}

async function playSong(guildId) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue) return;

  const song = serverQueue.songs[0];
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guildId);
    return;
  }

  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    serverQueue.player.play(resource);

    serverQueue.player.once(AudioPlayerStatus.Idle, () => {
      serverQueue.songs.shift();
      playSong(guildId);
    });
  } catch (err) {
    console.log(err);
    serverQueue.songs.shift();
    playSong(guildId);
  }
}

client.login(process.env.TOKEN);
        
