

# LORD X STAR  — Music Selfbot

This is an advanced Discord music selfbot built using discord.js-selfbot-v13 and Rainlink (Lavalink v4).
It includes an owner system, autoplay, filters, queue control, and a fully featured music playback system.

Note: This project is for educational purposes only. Selfbots violate Discord Terms of Service. Use at your own risk.

# THIS IS NO PREFIX VERSION ALL OWNERS CAN USE THIS NO PREFIX SYSTEM
---

## Features

### Music System

* Play music with Lavalink v4 (Rainlink)
* Autoplay system for continuous music
* Lofi audio filter
* Queue management
* Skip, pause, resume, stop controls
* Now playing display with progress bar
* Volume control up to 5000%
* YouTube search and playback support

### Owner System

* Add and remove owners
* owners.json automatically managed
* Only owners can execute commands
* Secure main-owner system

### Voice Channel Enhancements

* Dynamic voice channel playing status
* Auto-updates the voice channel name
* Works for every new track

### Technical Features

* State tracking for sessions
* Automatic queue handling
* Autoplay recommendation system
* Clean logging and crash-prevention
* Token loader from token.txt

---

## Installation

### 1. Clone Repository

```
git clone https://github.com/pushpdevraj/DISCORD-MUSIC-SELFBOT-LL-V4
cd repo
```

### 2. Install Required Packages

```
npm install
```

### 3. Add Tokens

Create a file named `token.txt` and add your tokens (one per line):

```
TOKEN_1
TOKEN_2
TOKEN_3
```

### 4. Lavalink Configuration

Inside index.js, edit:

```js
nodes: [{
    name: 'LAVALINK_V4',
    host: 'vip.visionhost.cloud',
    port: 2000,
    auth: 'lordxdev',
    secure: false,
    driver: 'lavalink'
}]
```

### 5. Start the Selfbot

```
node index.js
```

---

## Commands

### Music Commands

| Command          | Function                   |
| ---------------- | -------------------------- |
| .play <name/url> | Play a song                |
| .pause           | Pause playback             |
| .resume          | Resume playback            |
| .skip            | Skip track                 |
| .stop            | Stop player                |
| .nowplaying      | Show current track         |
| .queue           | Show queue                 |
| .autoplay        | Enable or disable autoplay |
| .volume <1-5000> | Change volume              |
| .lofi            | Apply lofi filter          |

### Owner Commands

| Command            | Function            |
| ------------------ | ------------------- |
| .owneradd <userId> | Add owner           |
| .ownerrem <userId> | Remove owner        |
| .owners            | View list of owners |

---

## File Structure

```
core/
  filters.js
owners.json
token.txt
index.js
README.md
```

---

## Disclaimer

This project uses a selfbot, which is against Discord’s Terms of Service.
Use only for testing or educational purposes.
Avoid running this on your main account.

---

## Credits

Developed By Star:
CREDITS NHI DIA TOH TUMHARI MAA CHUD JAYEGI


