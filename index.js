const Discord = require('discord.js-selfbot-v13');
const { Rainlink, Library } = require('rainlink');
const ytSearch = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const RPC = require('discord-rpc');
const filters = require('./core/filters');

// BRAND / WATERMARK
const BRAND = 'Pushp Dev Raj';
const WATERMARK = '\n\n— Made by @pushp.dev.raj (dc id)';

// ==================== PROFESSIONAL LOGGER ====================
const LOG_LEVELS = {
    DEBUG: '\x1b[36m[DEBUG]\x1b[0m',
    INFO: '\x1b[34m[INFO]\x1b[0m',
    SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
    WARN: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
    SYSTEM: '\x1b[35m[SYSTEM]\x1b[0m',
    COMMAND: '\x1b[38;5;214m[COMMAND]\x1b[0m'
};

function getTimestamp() {
    return new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

// No-console logger (silent)
function log() {
    // Intentionally empty to disable console output
}

// ==================== CONFIGURATION ====================
const config = {
    prefix: '.', // Default prefix
    nodes: [{
        name: 'DEV LAVALINK V4',
        host: 'vip.visionhost.cloud',
        port: 2000,
        auth: 'lordxdev',
        secure: false,
        driver: 'lavalink'
    }],
    mainOwnerId: '1307092197316890634',
    ownerIds: ['1307092197316890634', '1334542899676844045']
};

const OWNERS_FILE = 'owners.json';

// Valid commands list
const VALID_COMMANDS = [
    'ping',
    'play',
    'pause',
    'skip',
    'stop',
    'nowplaying',
    'queue',
    'autoplay',
    'lofi',
    'volume',
    'help',
    'owneradd',
    'ownerrem',
    'owners'
];

// ==================== OWNERS MANAGEMENT ====================
function initializeOwnersFile() {
    if (!fs.existsSync(OWNERS_FILE)) {
        const defaultOwners = {
            mainOwnerId: config.mainOwnerId,
            ownerIds: config.ownerIds
        };
        fs.writeFileSync(OWNERS_FILE, JSON.stringify(defaultOwners, null, 2));
    }
}

function loadOwners() {
    try {
        initializeOwnersFile();
        const data = fs.readFileSync(OWNERS_FILE, 'utf-8');
        const owners = JSON.parse(data);
        config.mainOwnerId = owners.mainOwnerId || config.mainOwnerId;
        config.ownerIds = [...new Set(owners.ownerIds || config.ownerIds)];
    } catch (err) {
        initializeOwnersFile();
    }
}

function saveOwners() {
    try {
        const data = {
            mainOwnerId: config.mainOwnerId,
            ownerIds: config.ownerIds
        };
        fs.writeFileSync(OWNERS_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        // ignore
    }
}

function addOwner(userId) {
    if (!config.ownerIds.includes(userId)) {
        config.ownerIds.push(userId);
        saveOwners();
        return true;
    }
    return false;
}

function removeOwner(userId) {
    if (userId === config.mainOwnerId) return false;
    const index = config.ownerIds.indexOf(userId);
    if (index > -1) {
        config.ownerIds.splice(index, 1);
        saveOwners();
        return true;
    }
    return false;
}

loadOwners();

// ==================== TOKEN MANAGEMENT ====================
const tokens = fs.readFileSync('token.txt', 'utf-8').split('\n').filter(Boolean);
if (!tokens.length) process.exit(1);

// ==================== CLIENT INITIALIZATION ====================
async function initClient(token) {
    const client = new Discord.Client({
        readyStatus: false,
        checkUpdate: false,
        partials: ['CHANNEL', 'MESSAGE']
    });

    const maskedToken = `${token.slice(0, 5)}...${token.slice(-3)}`;
    
    client.once('ready', () => {
        // Set CUSTOM presence with BRAND
        try {
            client.user.setPresence({
                status: 'dnd',
                activities: [{
                    name: `${BRAND} MUSIC`,
                    type: 'CUSTOM',
                    state: `${BRAND} • made by @pushp.dev.raj`
                }]
            });
        } catch (e) {
            // ignore
        }
    });

    const rainlink = new Rainlink({
        library: new Library.DiscordJS(client),
        nodes: config.nodes
    });

    // State management
    const autoplayStatus = new Map();
    const autoplayHistory = new Map();
    const activeTrackMonitors = new Map();
    const lastKnownStates = new Map();
    const lofiStatus = new Map();
    const autoplayInProgress = new Map();

    // ==================== UTILITY FUNCTIONS ====================
    function formatTime(ms) {
        if (!ms || ms <= 0) return '00:00';
        const seconds = Math.floor(ms / 1000) % 60;
        const minutes = Math.floor(ms / 60000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    function createProgressBar(current, total, size = 20) {
        if (!total || total <= 0) return '🔴' + '─'.repeat(size);
        const progress = Math.round((current / total) * size);
        return '▬'.repeat(progress) + '🔘' + '▬'.repeat(size - progress);
    }

    async function fetchYouTubeDuration(videoId) {
        if (!videoId) return 0;
        try {
            const res = await axios.get(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=YOUR_YOUTUBE_API_KEY`);
            const durationISO = res.data.items?.[0]?.contentDetails?.duration;
            if (!durationISO) return 0;

            const match = durationISO.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return 0;

            const hours = parseInt(match[1]) || 0;
            const minutes = parseInt(match[2]) || 0;
            const seconds = parseInt(match[3]) || 0;

            return ((hours * 3600) + (minutes * 60) + seconds) * 1000;
        } catch (err) {
            return 0;
        }
    }

    function startGlobalMonitor() {
        setInterval(() => {
            try {
                const players = rainlink.players.collection;
                if (!players?.size) return;
                players.forEach((player, guildId) => {
                    checkPlayerState(player, guildId);
                });
            } catch (err) {
                // ignore
            }
        }, 2000);
    }

    function checkPlayerState(player, guildId) {
        if (!player || !guildId) return;

        const currentTrack = player.queue.current;
        const newState = {
            trackId: currentTrack?.identifier,
            isPlaying: player.playing,
            queueSize: player.queue.size,
            position: player.position,
            lastUpdate: Date.now()
        };

        const lastState = lastKnownStates.get(guildId) || {};
        
        if (lastState.isPlaying && !newState.isPlaying && newState.queueSize === 0 && 
            autoplayStatus.get(guildId) && currentTrack?.identifier) {
            triggerAutoplay(guildId, player, player.queue.previous || currentTrack).catch(() => {});
        }

        lastKnownStates.set(guildId, newState);
    }

    function startTrackMonitor(player, track) {
        if (!player || !track?.identifier) return;

        const guildId = player.guildId;
        stopTrackMonitor(guildId);

        const fallback = 30000;
        const timeToEnd = (track.length && track.length > 0) ? Math.max(1000, track.length - 10000) : fallback;

        const monitorId = setTimeout(() => {
            const endCheckInterval = setInterval(() => {
                const currentPlayer = rainlink.players.get(guildId);
                if (!currentPlayer) return clearInterval(endCheckInterval);

                if (!currentPlayer.playing || currentPlayer.queue.current?.identifier !== track.identifier) {
                    clearInterval(endCheckInterval);
                    if (autoplayStatus.get(guildId) && currentPlayer.queue.size === 0) {
                        triggerAutoplay(guildId, currentPlayer, track).catch(() => {});
                    }
                }
            }, 500);
            activeTrackMonitors.set(guildId, endCheckInterval);
        }, timeToEnd);

        activeTrackMonitors.set(guildId, monitorId);
    }

    function stopTrackMonitor(guildId) {
        const monitorId = activeTrackMonitors.get(guildId);
        if (monitorId) {
            try {
                clearTimeout(monitorId);
                clearInterval(monitorId);
            } catch {}
            activeTrackMonitors.delete(guildId);
        }
    }

    async function fetchAutoplayRecommendations(videoId, cap = 7) {
        if (!videoId) return [];
        
        try {
            const res = await axios.get(`https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const ytData = JSON.parse(res.data.match(/ytInitialData\s*=\s*(\{.*?\});/s)?.[1] || '{}');
            
            return (ytData?.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents || [])
                .slice(0, cap)
                .map(item => {
                    const v = item.playlistPanelVideoRenderer;
                    if (!v?.videoId || v.videoId === videoId) return null;
                    return {
                        title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'Unknown',
                        identifier: v.videoId,
                        url: `https://www.youtube.com/watch?v=${v.videoId}`
                    };
                })
                .filter(Boolean);
        } catch (err) {
            return [];
        }
    }

    async function triggerAutoplay(guildId, player, seedTrack) {
        if (!player || !guildId || !seedTrack?.identifier) return;
        if (autoplayInProgress.get(guildId)) return;
        autoplayInProgress.set(guildId, true);

        try {
            const seedList = await fetchAutoplayRecommendations(seedTrack.identifier);
            if (!seedList.length) {
                autoplayInProgress.set(guildId, false);
                return;
            }

            let selected = null;
            const history = autoplayHistory.get(guildId) || [];

            for (const r of seedList) {
                try {
                    const found = await player.search(r.url);
                    const candidate = found?.tracks?.[0];
                    if (candidate && !history.includes(candidate.identifier)) {
                        selected = candidate;
                        break;
                    }
                } catch (err) {
                    // ignore
                }
            }

            if (!selected) {
                for (const r of seedList) {
                    try {
                        const found = await player.search(r.url);
                        const candidate = found?.tracks?.[0];
                        if (candidate) {
                            selected = candidate;
                            break;
                        }
                    } catch (err) {
                        // ignore
                    }
                }
            }

            if (!selected) {
                autoplayInProgress.set(guildId, false);
                return;
            }

            player.queue.add(selected);

            try {
                if (!player.playing) {
                    await player.play();
                }
            } catch (err) {
                // ignore
            }

            try {
                startTrackMonitor(player, selected);
            } catch (err) {
                // ignore
            }

            const newHistory = autoplayHistory.get(guildId) || [];
            newHistory.push(selected.identifier);
            if (newHistory.length > 50) newHistory.shift();
            autoplayHistory.set(guildId, newHistory);

            const textChannel = await client.channels.fetch(player.textId).catch(() => null);
            if (textChannel) {
                await textChannel.send(`**↻** Now Autoplaying: **${selected.title}**${WATERMARK}`);
                updateVoiceChannelStatus(player.voiceId, `↻ ${selected.title} - ${BRAND}`);
            }
        } catch (err) {
            // ignore
        } finally {
            setTimeout(() => autoplayInProgress.set(guildId, false), 1500);
        }
    }

    async function updateVoiceChannelStatus(channelId, status) {
        if (!channelId || !status) return;
        
        try {
            await axios.put(`https://discord.com/api/v9/channels/${channelId}/voice-status`, 
                { status },
                { headers: { 'Authorization': token } }
            );
        } catch (error) {
            // ignore
        }
    }

    // ==================== COMMAND HANDLER ====================
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const isOwner = config.ownerIds.includes(message.author.id);
        const isMainOwner = message.author.id === config.mainOwnerId;
        const usesPrefix = message.content.startsWith(config.prefix);

        // Non-owners with prefix = unauthorized
        if (!isOwner) {
            if (usesPrefix) {
                try {
                    await message.reply('❌ You are not allowed to use this bot.' + WATERMARK);
                } catch (err) {
                    // ignore
                }
            }
            return;
        }

        // Parse command
        let content = message.content;
        if (usesPrefix) content = content.slice(config.prefix.length);
        const args = content.trim().split(/ +/).filter(Boolean);
        const command = (args.shift() || '').toLowerCase();

        // Validate command
        if (!VALID_COMMANDS.includes(command)) return;

        try {
            switch (command) {
                case 'ping': {
                    await message.reply('🏓 PONG! Powered by ' + BRAND + WATERMARK);
                    break;
                }

                case 'owneradd': {
                    if (!isMainOwner) {
                        await message.reply('❌ Only the main owner can add owners!' + WATERMARK);
                        return;
                    }

                    const userId = args[0];
                    if (!userId || !/^\d+$/.test(userId)) {
                        await message.reply('❌ Please provide a valid User ID!' + WATERMARK);
                        return;
                    }

                    if (addOwner(userId)) {
                        await message.reply(`✅ User **${userId}** has been added as an owner!` + WATERMARK);
                    } else {
                        await message.reply(`❌ User **${userId}** is already an owner!` + WATERMARK);
                    }
                    break;
                }

                case 'ownerrem': {
                    if (!isMainOwner) {
                        await message.reply('❌ Only the main owner can remove owners!' + WATERMARK);
                        return;
                    }

                    const userId = args[0];
                    if (!userId || !/^\d+$/.test(userId)) {
                        await message.reply('❌ Please provide a valid User ID!' + WATERMARK);
                        return;
                    }

                    if (userId === config.mainOwnerId) {
                        await message.reply('❌ You cannot remove the main owner!' + WATERMARK);
                        return;
                    }

                    if (removeOwner(userId)) {
                        await message.reply(`✅ User **${userId}** has been removed from owners!` + WATERMARK);
                    } else {
                        await message.reply(`❌ User **${userId}** is not an owner!` + WATERMARK);
                    }
                    break;
                }

                case 'owners': {
                    const ownerList = config.ownerIds.map(id => `• ${id}${id === config.mainOwnerId ? ' (Main Owner)' : ''}`).join('\n');
                    await message.reply(`**👑 Current Owners:**\n${ownerList}` + WATERMARK);
                    break;
                }

                case 'play': {
                    if (!message.member?.voice?.channel) {
                        await message.reply('❌ You need to be in a voice channel!' + WATERMARK);
                        return;
                    }

                    const query = args.join(' ');
                    if (!query) {
                        await message.reply('❌ Please provide a song!' + WATERMARK);
                        return;
                    }

                    const player = await rainlink.create({
                        guildId: message.guildId,
                        textId: message.channelId,
                        voiceId: message.member.voice.channel.id,
                        shardId: 0,
                    });

                    let result = await player.search(query);
                    if (!result?.tracks?.length) {
                        const ytResult = await ytSearch(query);
                        if (ytResult?.videos?.[0]?.url) {
                            result = await player.search(ytResult.videos[0].url);
                        }
                    }

                    if (!result?.tracks?.length) {
                        await message.reply('❌ No results found!' + WATERMARK);
                        return;
                    }

                    const track = result.tracks[0];
                    player.queue.add(track);

                    if (!player.playing) {
                        await player.play();
                        startTrackMonitor(player, track);
                    } else {
                        startTrackMonitor(player, track);
                    }

                    await message.reply(`🎵 Added to queue: **${track.title}**` + WATERMARK);
                    updateVoiceChannelStatus(message.member.voice.channel.id, `🎵 ${track.title} | ${BRAND}`);
                    break;
                }

                case 'pause': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player) {
                        await message.reply('❌ No music is playing!' + WATERMARK);
                        return;
                    }
                
                    if (player.paused) {
                        await player.resume();
                        await message.reply('▶️ Resumed playback!' + WATERMARK);
                    } else {
                        await player.pause();
                        await message.reply('⏸️ Playback paused!' + WATERMARK);
                    }
                    break;
                }

                case 'skip': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player) {
                        await message.reply('❌ No music playing!' + WATERMARK);
                        return;
                    }

                    const trackTitle = player.queue.current?.title || 'current song';
                    stopTrackMonitor(message.guildId);
                    await player.skip();

                    await message.reply(`⏭ Skipped **${trackTitle}**` + WATERMARK);

                    if (autoplayStatus.get(message.guildId) && player.queue.size === 0 && player.queue.current?.identifier) {
                        setTimeout(() => triggerAutoplay(message.guildId, player, player.queue.current), 1000);
                    } else if (player.queue.current) {
                        startTrackMonitor(player, player.queue.current);
                    }
                    break;
                }

                case 'stop': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player) {
                        await message.reply('❌ No music playing!' + WATERMARK);
                        return;
                    }

                    stopTrackMonitor(message.guildId);
                    await player.destroy();
                    await message.reply('⏹ Stopped player' + WATERMARK);
                    break;
                }

                case 'nowplaying': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player?.queue?.current) {
                        await message.reply('❌ No music playing!' + WATERMARK);
                        return;
                    }

                    const track = player.queue.current;
                    const duration = track.length > 0 ? track.length : await fetchYouTubeDuration(track.identifier);
                    const progress = Math.min(player.position, duration);

                    await message.reply(`**🎶 Now Playing:** ${track.title}\n\`[${createProgressBar(progress, duration)}]\` ${formatTime(progress)}${duration > 0 ? ` / ${formatTime(duration)}` : ''}` + WATERMARK);
                    break;
                }

                case 'queue': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player) {
                        await message.reply('❌ No music playing!' + WATERMARK);
                        return;
                    }

                    const queueText = player.queue.map((t, i) => 
                        `${i + 1}. ${t.title} [${formatTime(t.length)}]`
                    ).join('\n');

                    await message.reply(`**📜 Queue** (${player.queue.length})\n${player.queue.current ? `Now: ${player.queue.current.title}\n\n` : ''}${queueText || 'Queue is empty'}` + WATERMARK);
                    break;
                }

                case 'autoplay': {
                    const current = autoplayStatus.get(message.guildId) || false;
                    autoplayStatus.set(message.guildId, !current);
                    await message.reply(`🔁 Autoplay ${!current ? 'ENABLED' : 'DISABLED'}` + WATERMARK);
                    break;
                }

                case 'lofi': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player) {
                        await message.reply('❌ No music playing!' + WATERMARK);
                        return;
                    }

                    const current = lofiStatus.get(message.guildId) || false;
                    player.filters = current ? {} : filters.lofi;
                    lofiStatus.set(message.guildId, !current);
                    
                    await message.reply(`🎧 Lofi filter ${current ? 'REMOVED' : 'APPLIED'}` + WATERMARK);
                    break;
                }

                case 'volume': {
                    const player = rainlink.players.get(message.guildId);
                    if (!player) {
                        await message.reply('❌ No music playing!' + WATERMARK);
                        return;
                    }
                
                    const volArg = args[0];
                    if (!volArg) {
                        await message.reply(`🔊 Current Volume: ${player.volume}%` + WATERMARK);
                        return;
                    }
                
                    const volNum = Math.max(1, Math.min(parseInt(volArg) || 100, 5000));
                    player.setVolume(volNum);
                    await message.reply(`🔊 Volume set to: **${volNum}%** (Max: 5000%)` + WATERMARK);
                    break;
                }

                case 'help': {
                    await message.reply(`**🎵 ${BRAND} MUSIC SELFBOT COMMANDS**\nUse commands with prefix \`${config.prefix}\` or owners may omit the prefix.\n\n**Music Commands:**\n\`${config.prefix}play <query>\` - Play a song\n\`${config.prefix}pause\` - Pause/Resume song\n\`${config.prefix}skip\` - Skip current song\n\`${config.prefix}stop\` - Stop player\n\`${config.prefix}nowplaying\` - Current track info\n\`${config.prefix}queue\` - Show queue\n\`${config.prefix}autoplay\` - Toggle autoplay\n\`${config.prefix}lofi\` - Toggle lofi filter\n\`${config.prefix}volume [1-5000]\` - Set volume\n\n**Owner Commands (Main Owner Only):**\n\`${config.prefix}owneradd <userId>\` - Add an owner\n\`${config.prefix}ownerrem <userId>\` - Remove an owner\n\`${config.prefix}owners\` - List all owners` + WATERMARK);
                    break;
                }
            }
        } catch (error) {
            try { await message.reply('❌ An error occurred!' + WATERMARK); } catch (e) { /* ignore */ }
        }
    });

    // Start the client
    await client.login(token).catch(() => {});
    startGlobalMonitor();
}

// ==================== APPLICATION STARTUP ====================
(async () => {
    for (let tk of tokens) {
        try { await initClient(tk); } catch (e) { /* ignore */ }
    }
})();
