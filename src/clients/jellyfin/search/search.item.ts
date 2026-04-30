import {
  BaseItemDto,
  RemoteImageResult,
  SearchHint as JellyfinSearchHint,
} from '@jellyfin/sdk/lib/generated-client/models';
import { z } from 'zod';

import { JellyfinSearchService } from './jellyfin.search.service';
import { Track } from '../../../models/track';
import { trimStringToFixedLength } from '../../../utils/stringUtils/stringUtils';

export class SearchItem {
  readonly artist: string;

  constructor(
    protected readonly id: string,
    protected readonly name: string,
    protected runtimeInMilliseconds: number,
    remoteImages?: RemoteImageResult,
    artist?: string,
  ) {
    this.artist = artist ?? '';
  }

  toString() {
    return `🎵 ${this.name}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async toTracks(searchService: JellyfinSearchService): Promise<Track[]> {
    return [new Track(this.id, this.name, this.runtimeInMilliseconds, {}, this.artist)];
  }

  getId(): string {
    return this.id;
  }

  static constructFromHint(hint: JellyfinSearchHint) {
    const schema = z.object({
      Id: z.string(),
      Artists: z.array(z.string()),
      Name: z.string(),
      RunTimeTicks: z.number(),
    });

    const result = schema.safeParse(hint);

    if (!result.success) {
      throw new Error(
        `Unable to construct search hint, required properties were undefined: ${JSON.stringify(
          hint,
        )}`,
      );
    }
    let artist = '';
    if (result.data.Artists !== null && result.data.Artists.length > 0) {
      artist = result.data.Artists[0];
      if (result.data.Artists.length > 1) {
        artist += ',...';
      }
    }
    return new SearchItem(
      result.data.Id,
      trimStringToFixedLength(result.data.Name, 70),
      result.data.RunTimeTicks / 10000,
      {},
      artist,
    );
  }

  static constructFromBaseItem(baseItem: BaseItemDto) {
    if (baseItem.Id === undefined || !baseItem.Name || !baseItem.RunTimeTicks) {
      throw new Error(
        'Unable to construct search hint from base item, required properties were undefined',
      );
    }
    const artists = baseItem.Artists ?? [];
    const artist = artists.length > 0 ? artists.join(', ') : (baseItem.AlbumArtist ?? '');
    return new SearchItem(
      baseItem.Id,
      trimStringToFixedLength(baseItem.Name, 70),
      baseItem.RunTimeTicks / 10000,
      {},
      artist,
    );
  }
}
