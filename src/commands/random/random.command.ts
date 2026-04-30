import { SlashCommandPipe } from '@discord-nestjs/common';
import { Command, Handler, IA, InteractionEvent } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import {
  CommandInteraction,
  GuildMember,
  InteractionReplyOptions,
} from 'discord.js';
import { buildMessage } from 'src/clients/discord/discord.message.builder';
import { DiscordVoiceService } from 'src/clients/discord/discord.voice.service';
import { JellyfinSearchService } from 'src/clients/jellyfin/search/jellyfin.search.service';
import { SearchItem } from 'src/clients/jellyfin/search/search.item';
import { PlaybackService } from 'src/playback/playback.service';
import { RandomCommandParams } from './random.params';
import { defaultMemberPermissions } from '../../utils/environment';
import { NowPlayingService } from '../nowplaying/now-playing.service';

@Command({
  name: 'random',
  description: 'Enqueues a random selection of tracks to your playlist',
  defaultMemberPermissions,
})
@Injectable()
export class EnqueueRandomItemsCommand {
  private readonly logger = new Logger(EnqueueRandomItemsCommand.name);

  constructor(
    private readonly playbackService: PlaybackService,
    private readonly discordVoiceService: DiscordVoiceService,
    private readonly jellyfinSearchService: JellyfinSearchService,
    private readonly nowPlayingService: NowPlayingService,
  ) {}

  @Handler()
  async handler(
    @InteractionEvent(SlashCommandPipe) dto: RandomCommandParams,
    @IA() interaction: CommandInteraction,
  ): Promise<void> {
    try {
      await interaction.deferReply();

      const guildMember = interaction.member as GuildMember;

      if (interaction.channelId) {
        this.nowPlayingService.setSourceChannelId(interaction.channelId);
      }

      const tryResult =
        this.discordVoiceService.tryJoinChannelAndEstablishVoiceConnection(
          guildMember,
        );

      if (!tryResult.success) {
        const replyOptions = tryResult.reply as InteractionReplyOptions;
        await interaction.editReply({
          embeds: replyOptions.embeds,
        });
        return;
      }

      const items = await this.jellyfinSearchService.getRandomTracks(dto.count);
      const tracks = await this.getTracks(items);

      this.playbackService.getPlaylistOrDefault().enqueueTracks(tracks);

      await interaction.editReply({
        embeds: [
          buildMessage({
            title: `Added ${tracks.length} tracks to your playlist`,
            description: 'Use ``/playlist`` to see them',
          }),
        ],
      });
    } catch (e) {
      this.logger.error(`Failed to handle /random command: ${e}`);
    }
  }

  private async getTracks(hints: SearchItem[]) {
    const promises = await Promise.all(
      hints.flatMap(async (item) => {
        return await item.toTracks(this.jellyfinSearchService);
      }),
    );

    return promises.flatMap((x) => x);
  }
}
