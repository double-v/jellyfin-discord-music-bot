import { Command, Handler, IA } from '@discord-nestjs/core';

import { Injectable, Logger } from '@nestjs/common';

import { CommandInteraction } from 'discord.js';

import { buildErrorMessage, buildMessage } from '../../clients/discord/discord.message.builder';
import { JellyfinSearchService } from '../../clients/jellyfin/search/jellyfin.search.service';
import { PlaybackService } from '../../playback/playback.service';
import { formatMillisecondsAsHumanReadable } from '../../utils/timeUtils';
import { defaultMemberPermissions } from '../../utils/environment';

@Command({
  name: 'nowplaying',
  description: 'Show info about the currently playing track',
  defaultMemberPermissions,
})
@Injectable()
export class NowPlayingCommand {
  private readonly logger = new Logger(NowPlayingCommand.name);

  constructor(
    private readonly playbackService: PlaybackService,
    private readonly jellyfinSearchService: JellyfinSearchService,
  ) {}

  @Handler()
  async handler(@IA() interaction: CommandInteraction): Promise<void> {
    try {
      const track = this.playbackService.getPlaylistOrDefault().getActiveTrack();

      if (!track) {
        await interaction.reply({
          embeds: [
            buildErrorMessage({
              title: 'Nothing is playing',
              description: 'Use ``/play`` or ``/random`` to start playing music',
            }),
          ],
        });
        return;
      }

      const api = this.jellyfinSearchService.getApi();
      const { getItemsApi } = await import('@jellyfin/sdk/lib/utils/api/items-api');
      const itemsApi = getItemsApi(api);
      const { data } = await itemsApi.getItems({
        ids: [track.id],
        userId: this.jellyfinSearchService.getUserId(),
      });

      const item = data.Items?.[0];
      const album = item?.Album ?? '';
      const year = item?.ProductionYear;
      const remoteImages = track.getRemoteImages();
      const remoteImage = remoteImages.length > 0 ? remoteImages[0] : undefined;

      let description = '';
      if (track.artist) description += `**Artist:** ${track.artist}\n`;
      if (album) description += `**Album:** ${album}\n`;
      if (year) description += `**Year:** ${year}\n`;
      if (track.getDuration()) {
        description += `**Duration:** ${formatMillisecondsAsHumanReadable(track.getDuration())}\n`;
      }

      await interaction.reply({
        embeds: [
          buildMessage({
            title: `Now Playing: ${track.getDisplayName()}`,
            description: description || undefined,
            mixin(embedBuilder) {
              if (!remoteImage?.Url) return embedBuilder;
              return embedBuilder.setThumbnail(remoteImage.Url);
            },
          }),
        ],
      });
    } catch (e) {
      this.logger.error(`Failed to handle /nowplaying command: ${e}`);
      await interaction.reply({
        embeds: [
          buildErrorMessage({
            title: 'Failed to get track info',
          }),
        ],
      });
    }
  }
}