<p align="center">
  <a href="https://nestjs.com/" target="blank"><img src="https://github.com/walkxcode/dashboard-icons/blob/main/png/jellyfin.png?raw=true" width="200" alt="Nest Logo" /></a>
</p>

  <br/>
<h1 align="center">Jellyfin Discord Bot</h1>

<p align="center">A simple <a href="https://discord.com" target="_blank">Discord</a> bot that enables you to broadcast<br/>your <a href="https://jellyfin.org/" target="_blank">Jellyfin Media Server</a> music collection to voice channels.<br/>It's Open Source and can easily be hosted by yourself!</p>

<p align="center">
  <small>Thank you <a href="https://github.com/KGT1/jellyfin-discord-music-bot/">KGT1</a> for starting this project!<br/>This is a fork of their original repository and re-uses some of their code.</small>
</p>

<p align="center">
  <a href="https://github.com/manuel-rw/jellyfin-discord-music-bot/wiki/%F0%9F%9A%80-Installation"><img src="https://img.shields.io/badge/-Installation%20Guide-7289da?style=for-the-badge&logo=markdown" alt="badge" /></a>
  <a href="https://discord.gg/hRHZ3q3VDX"><img src="https://img.shields.io/badge/-Community%20Discord-7289da?style=for-the-badge&logo=discord" alt="badge" /></a>
  <a href='https://ko-fi.com/A0A42YZ7W' target='_blank'><img src="https://img.shields.io/badge/-Buy%20me%20a%20coffee-f1f1f1?style=for-the-badge&logo=kofi" alt="badge" /></a>
  <br/>
  <br/>
  <img src="https://github.com/manuel-rw/jellyfin-discord-music-bot/actions/workflows/docker.yml/badge.svg?branch=master" />
  <img src="https://deepsource.io/gh/manuel-rw/jellyfin-discord-music-bot.svg/?label=active+issues&show_trend=true&token=vhfm8cbHaoCyXTf7Gfs9FweR)](https://deepsource.io/gh/manuel-rw/jellyfin-discord-music-bot/?ref=repository-badge" />
</p>

<br/>
<hr/>
<br/>

![](docs/play-command.gif)

## Features

- Easy usage with the Discord command system (e.g. `/play`, `/pause`, ...)
- Can broadcast audio from playlists, albums and songs directly to your audience in Discord
- Control the bot via the player controls from Jellyfin itself (remote / Cast to device)
- Playback reporting (aka. scrobbling)
- Interactive playlist manager and pretty embed messages for user feedback
- Shuffle mode to randomly play through your playlist
- Random mode to add random songs from your library to the playlist
...and more!

## Commands

- `/play <search:string> <next:boolean?> <type:Type?>` Play a song, album or playlist from your media server
- `/playlist <page:number?>` Shows the current playlist in real time in pagination
- `/random <count:number?>` Enqueue a random mix of songs from your media server
- `/volume <volume:number>` Set the volume of the bot
- `/disconnect` Disconnect the bot from voice channels
- `/help` Show a help message with information regarding the bot
- `/next` Skip the current song
- `/pause` Pause or unpause playback
- `/previous` Go back to the previous song
- `/shuffle` Shuffle the current playlist randomly
- `/status` Show the current bot status including connection information for Jellyfin
- `/stop` Stop playback and clear the queue
- `/summon` Summon the bot to your voice channel
- `/bot-status <activity:Activity> <status:Status> <text:string>` Set the bot's status

> [!TIP]
> `<search:string>` -> Equals to a required parameter.<br/>
> `<next:boolean?>` -> Equals to an optional parameter.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DISCORD_CLIENT_TOKEN` | Yes | - | Discord bot token |
| `JELLYFIN_SERVER_ADDRESS` | Yes | - | Jellyfin server URL (e.g. `http://192.168.1.136:8096`) |
| `JELLYFIN_AUTHENTICATION_USERNAME` | Yes | - | Jellyfin user to authenticate as |
| `JELLYFIN_AUTHENTICATION_PASSWORD` | Yes | - | Password for the Jellyfin user |
| `UPDATER_DISABLE_NOTIFICATIONS` | No | `false` | Suppress update nags |
| `ALLOW_EVERYONE_FOR_DEFAULT_PERMS` | No | `false` | If `true`, all Discord members can use bot commands |
| `LOG_LEVEL` | No | `LOG` | One of: `ERROR`, `WARN`, `LOG`, `DEBUG`, `VERBOSE` |
| `PORT` | No | `3000` | HTTP listen port (health checks) |

## Deployment

### Docker Compose (recommended)

Copy `.env.example` to `.env` and fill in your credentials, then:

```bash
docker compose up -d --build
```

This builds the image from local source. No Docker Hub or external registry needed.

### TrueNAS + Dockge

1. Copy the project sources to your TrueNAS stacks directory:

```powershell
# From Windows (PowerShell)
robocopy "D:\path\to\jellyfin-discord-music-bot" "\\TRUENAS\docker\stacks\jellyfin-discord-bot" /E /XD node_modules .git /XF .env
copy "D:\path\to\jellyfin-discord-music-bot\.env" "\\TRUENAS\docker\stacks\jellyfin-discord-bot\.env"
```

2. In Dockge, the stack `jellyfin-discord-bot` will appear automatically (if your stacks path is `/mnt/raid/docker/stacks`)

3. Click **Deploy** in Dockge

### Jellyfin Compatibility

| Jellyfin Version | Status |
|---|---|
| 10.8.x - 10.11.x | Fully supported |
| 10.12.x | Supported (uses `ApiKey` instead of deprecated `api_key`) |
| 10.13+ | Will work (`api_key` legacy param removed, `ApiKey` is already used) |

The bot uses `ApiKey` (uppercase) for both WebSocket and audio stream URLs, which is supported since Jellyfin 10.8.0. The deprecated lowercase `api_key` is disabled by default in Jellyfin 10.12 and will be removed in 10.13.

## About this project

This project was originally started by [KGT1 on GitHub](https://github.com/KGT1/jellyfin-discord-music-bot/) in 2020. I came across this project in late 2021, when I wanted to enjoy my music on Discord. I never got it to run as I wanted it to. Since the original project was created under the MIT license, I decided to make a fork in 2022 with my own version. Although this project re-uses some code of the original project, it has been completely rewritten in other parts using NestJs and features now a module-based approach.

## Limitations

- Bot does not support shards. This means you cannot use it in multiple servers concurrently.
- Album covers are not visible unless they are remote (e.g., provided by an external metadata provider)
- Streaming any video content in voice channels (See [this issue](https://github.com/discordjs/discord.js/issues/4116))
- Seek/Rewind/FastForward from Jellyfin remote controls are not yet implemented (logged as warnings)

## Development

1. Install Node.js 24.x or higher
2. Install FFmpeg (required for audio playback): `choco install ffmpeg` or `scoop install ffmpeg`
3. Fork the repository and clone your fork using Git
4. Run `npm install` in the root directory
5. Copy the `.env.example` file to `.env` and adjust the environment variables
6. Run `npm run start:dev` to start the bot with hot reload

After you made the desired changes, run `npm run build` to build the project.

## Credits

- https://tabler-icons.io/
- https://docs.nestjs.com/
- https://discord.js.org/
- https://github.com/fjodor-rybakov/discord-nestjs
- https://github.com/jellyfin/jellyfin-sdk-typescript
- https://jellyfin.org/
- https://github.com/KGT1/jellyfin-discord-music-bot
- https://gitmoji.dev/