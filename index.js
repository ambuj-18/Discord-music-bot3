const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const ytdl = require("ytdl-core");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const queue = new Map();

client.once("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.split(" ");
  const command = args.shift().toLowerCase();

  /* ================= JOIN ================= */
  if (command === "!join") {
    if (!message.member.voice.channel) {
      return message.reply("❌ Pehle voice channel join karo");
    }

    joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    return message.reply("✅ Voice channel join kar liya");
  }

  /* ================= PLAY ================= */
  if (command === "!play") {
    if (!message.member.voice.channel) {
      return message.reply("❌ Pehle voice channel join karo");
    }

    const songURL = args[0];
    if (!songURL || !ytdl.validateURL(songURL)) {
      return message.reply("❌ Valid YouTube URL do");
    }

    const serverQueue = queue.get(message.guild.id);

    const song = {
      url: songURL,
    };

    if (!serverQueue) {
      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Play,
        },
      });

      const connection = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const queueConstruct = {
        textChannel: message.channel,
        voiceChannel: message.member.voice.channel,
        connection,
        player,
        songs: [],
      };

      queue.set(message.guild.id, queueConstruct);
      queueConstruct.songs.push(song);

      playSong(message.guild.id);
      return message.reply("▶️ Song play ho raha hai");
    } else {
      serverQueue.songs.push(song);
      return message.reply("➕ Song queue me add ho gaya");
    }
  }

  /* ================= SKIP ================= */
  if (command === "!skip") {
    const serverQueue = queue.get(message.guild.id);
    if (!serverQueue) return message.reply("❌ Koi song play nahi ho raha");

    serverQueue.player.stop();
    return message.reply("⏭️ Song skip kar diya");
  }

  /* ================= DISCONNECT ================= */
  if (command === "!disconnect") {
    const serverQueue = queue.get(message.guild.id);
    const connection = getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply("❌ Bot voice me nahi hai");
    }

    serverQueue?.player.stop();
    queue.delete(message.guild.id);
    connection.destroy();

    return message.reply("👋 Voice channel se disconnect ho gaya");
  }
});

/* ================= PLAY FUNCTION ================= */
async function playSong(guildId) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue) return;

  const song = serverQueue.songs[0];
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guildId);
    return;
  }

  const stream = ytdl(song.url, {
    filter: "audioonly",
    highWaterMark: 1 << 25,
  });

  const resource = createAudioResource(stream);
  serverQueue.player.play(resource);
  serverQueue.connection.subscribe(serverQueue.player);

  serverQueue.player.once(AudioPlayerStatus.Idle, () => {
    serverQueue.songs.shift();
    playSong(guildId);
  });
}

/* ================= LOGIN ================= */
client.login("YOUR_BOT_TOKEN_HERE");

