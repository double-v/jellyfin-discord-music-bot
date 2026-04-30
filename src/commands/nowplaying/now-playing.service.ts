import { InjectDiscordClient } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Client, TextChannel } from 'discord.js';

import { Track } from '../../models/track';
import { formatMillisecondsAsHumanReadable } from '../../utils/timeUtils';
import { buildMessage } from '../../clients/discord/discord.message.builder';

@Injectable()
export class NowPlayingService {
  private readonly logger = new Logger(NowPlayingService.name);
  private textChannel: TextChannel | undefined;
  private sourceChannelId: string | undefined;

  constructor(@InjectDiscordClient() private readonly client: Client) {}

  setSourceChannelId(channelId: string) {
    this.sourceChannelId = channelId;
    this.textChannel = undefined;
  }

  @OnEvent('internal.audio.track.announce')
  async handleNewTrack(track: Track) {
    this.updateBotPresence(track);
    await this.sendNowPlaying(track);
  }

  @OnEvent('internal.voice.controls.stop')
  handleStop() {
    this.clearBotPresence();
  }

  private async resolveTextChannel(guildId: string) {
    if (this.textChannel) return;

    try {
      if (this.sourceChannelId) {
        const channel = await this.client.channels.fetch(this.sourceChannelId);
        if (channel && channel.isTextBased()) {
          this.textChannel = channel as TextChannel;
          this.logger.debug(`Resolved text channel from source command: ${this.textChannel.name}`);
          return;
        }
      }

      const guild = await this.client.guilds.fetch(guildId);
      const systemChannel = guild.systemChannel;
      if (systemChannel && systemChannel.isTextBased()) {
        this.textChannel = systemChannel as TextChannel;
        this.logger.debug(`Resolved text channel to system channel: ${systemChannel.name}`);
        return;
      }
      const channels = await guild.channels.fetch();
      const textChannel = channels.find(
        (ch): ch is TextChannel => ch !== null && ch.isTextBased(),
      );
      if (textChannel) {
        this.textChannel = textChannel;
        this.logger.debug(`Resolved text channel: ${textChannel.name}`);
        return;
      }
      this.logger.warn('No suitable text channel found in guild');
    } catch (e) {
      this.logger.warn(`Failed to resolve text channel: ${e}`);
    }
  }

  private async sendNowPlaying(track: Track) {
    const voiceConnections = this.client.voice?.adapters;
    if (!voiceConnections || voiceConnections.size === 0) {
      this.logger.debug('No voice connections, skipping now playing message');
      return;
    }

    const guildId = [...voiceConnections.keys()][0];
    await this.resolveTextChannel(guildId);

    if (!this.textChannel) {
      this.logger.warn('No text channel available, skipping now playing message');
      return;
    }

    const remoteImages = track.getRemoteImages();
    const remoteImage = remoteImages.length > 0 ? remoteImages[0] : undefined;

    try {
      await this.textChannel.send({
        embeds: [
          buildMessage({
            title: `Now Playing: ${track.getDisplayName()}`,
            description: track.getDuration()
              ? `Duration: ${formatMillisecondsAsHumanReadable(track.getDuration())}`
              : undefined,
            mixin(embedBuilder) {
              if (!remoteImage?.Url) return embedBuilder;
              return embedBuilder.setThumbnail(remoteImage.Url);
            },
          }),
        ],
      });
    } catch (e) {
      this.logger.warn(`Failed to send now playing message: ${e}`);
    }
  }

  private updateBotPresence(track: Track) {
    this.client.user?.setActivity(track.getDisplayName(), { type: 2 });
  }

  private clearBotPresence() {
    this.client.user?.setPresence({ activities: [] });
  }
}