import {
  BaseItemDto,
  SearchHint as JellyfinSearchHint,
} from '@jellyfin/sdk/lib/generated-client/models';

import { Track } from '../../../models/track';
import { JellyfinSearchService } from './jellyfin.search.service';

import { SearchItem } from './search.item';
import { trimStringToFixedLength } from '../../../utils/stringUtils/stringUtils';

export class AlbumSearchItem extends SearchItem {
  override toString(): string {
    return `🎶 ${this.name}`;
  }

  static constructFromHint(hint: JellyfinSearchHint) {
    if (hint.Id === undefined || !hint.Name || !hint.RunTimeTicks) {
      throw new Error(
        'Unable to construct playlist search hint, required properties were undefined',
      );
    }

    return new AlbumSearchItem(
      hint.Id,
      trimStringToFixedLength(hint.Name, 70),
      hint.RunTimeTicks / 10000,
      {},
      hint.AlbumArtist ?? '',
    );
  }

  static constructFromBaseItem(baseItem: BaseItemDto) {
    if (baseItem.Id === undefined || !baseItem.Name || !baseItem.RunTimeTicks) {
      throw new Error(
        'Unable to construct search hint from base item, required properties were undefined',
      );
    }

    return new AlbumSearchItem(
      baseItem.Id,
      trimStringToFixedLength(baseItem.Name, 70),
      baseItem.RunTimeTicks / 10000,
      {},
      baseItem.AlbumArtist ?? '',
    );
  }

  override async toTracks(
    searchService: JellyfinSearchService,
  ): Promise<Track[]> {
    const remoteImages = await searchService.getRemoteImageById(this.id);
    const albumItems = await searchService.getAlbumItems(this.id);
    const tracks = await Promise.all(
      albumItems.map(async (x) =>
        (await x.toTracks(searchService)).find((x) => x !== null),
      ),
    );
    return tracks.map((track: Track): Track => {
      track.remoteImages = remoteImages;
      return track;
    });
  }
}
