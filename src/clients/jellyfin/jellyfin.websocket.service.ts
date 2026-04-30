import {
  PlaystateCommand,
  SessionMessageType,
} from '@jellyfin/sdk/lib/generated-client/models';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { flatMapTrackItems } from '../../utils/trackConverter';

import { WebSocket } from 'ws';

import { PlaybackService } from '../../playback/playback.service';
import {
  PlayNowCommand,
  SessionApiSendPlayStateCommandRequest,
} from '../../types/websocket';

import { JellyfinSearchService } from './search/jellyfin.search.service';
import { JellyfinService } from './jellyfin.service';
import { z } from 'zod';
import { EventNames } from '../../events/names';

@Injectable()
export class JellyfinWebSocketService implements OnModuleDestroy {
  private webSocket: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private isManuallyClosed = false;
  private isConnecting = false;
  private reconnectAttempts = 0;

  private readonly logger = new Logger(JellyfinWebSocketService.name);

  constructor(
    private readonly jellyfinService: JellyfinService,
    private readonly playbackService: PlaybackService,
    private readonly jellyfinSearchService: JellyfinSearchService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/30 * * * * *')
  private handlePeriodicAliveMessage() {
    if (
      this.webSocket === undefined ||
      this.webSocket.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    this.sendMessage('KeepAlive');
    this.logger.debug('Sent a KeepAlive package to the server');
  }

  initializeAndConnect() {
    if (this.isConnecting) {
      this.logger.debug('WebSocket is already connecting, skipping.');
      return;
    }
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.logger.debug('WebSocket already open, skipping connect.');
      return;
    }

    this.isManuallyClosed = false;
    this.isConnecting = true;

    const deviceId = this.jellyfinService.getJellyfin().deviceInfo.id;
    const url = JellyfinWebSocketService.buildSocketUrl(
      this.jellyfinService.getApi().basePath,
      this.jellyfinService.getApi().accessToken,
      deviceId,
    );

    this.logger.debug(`Opening WebSocket with client id ${deviceId}...`);

    this.webSocket = new WebSocket(url);
    this.bindWebSocketEvents();
  }

  disconnect() {
    this.isManuallyClosed = true;
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (!this.webSocket) {
      this.logger.warn(
        'Tried to disconnect but WebSocket was unexpectedly undefined',
      );
      return;
    }

    this.logger.debug('Closing WebSocket...');
    try {
      this.webSocket.close();
    } catch (e) {
      this.logger.warn(`Error while closing WebSocket: ${e}`);
    }
  }

  sendMessage(type: string, data?: any) {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      throw new Error('Socket not open');
    }

    const obj: Record<string, any> = { MessageType: type };
    if (data) obj.Data = data;

    this.webSocket.send(JSON.stringify(obj));
  }

  protected async messageHandler(data: any) {
    let msg: JellyMessage<unknown>;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      this.logger.warn(`Failed to parse WebSocket message: ${e}`);
      return;
    }

    switch (msg.MessageType) {
      case SessionMessageType[SessionMessageType.KeepAlive]:
      case SessionMessageType[SessionMessageType.ForceKeepAlive]: {
        this.logger.debug(
          `Received a ${msg.MessageType} package from the server`,
        );
        break;
      }
      case SessionMessageType[SessionMessageType.Play]: {
        const data = msg.Data as PlayNowCommand;
        data.hasSelection = PlayNowCommand.prototype.hasSelection;
        data.getSelection = PlayNowCommand.prototype.getSelection;
        const ids = data.getSelection();
        this.logger.log(
          `Processing ${ids.length} ids received via websocket and adding them to the queue`,
        );
        const searchHints = await this.jellyfinSearchService.getAllById(ids);
        const tracks = await flatMapTrackItems(
          searchHints,
          this.jellyfinSearchService,
        );
        this.logger.debug(`Mapped ${tracks.length} tracks to Jellyfin`);
        this.playbackService.getPlaylistOrDefault().enqueueTracks(tracks);
        break;
      }
      case SessionMessageType[SessionMessageType.Playstate]: {
        const sendPlayStateCommandRequest =
          msg.Data as SessionApiSendPlayStateCommandRequest;
        this.handleSendPlayStateCommandRequest(sendPlayStateCommandRequest);
        break;
      }
      case SessionMessageType[SessionMessageType.UserDataChanged]:
        break;
      case SessionMessageType[SessionMessageType.GeneralCommand]:
        this.handleGeneralCommand(msg);
        break;
      default:
        this.logger.warn(
          `Received a package from the socket of unknown type: ${msg.MessageType}`,
        );
        break;
    }
  }

  private handleSendPlayStateCommandRequest(
    request: SessionApiSendPlayStateCommandRequest,
  ) {
    switch (request.Command) {
      case PlaystateCommand.PlayPause:
        this.eventEmitter.emit(EventNames.Controls.TogglePause);
        break;
      case PlaystateCommand.Pause:
        this.eventEmitter.emit(EventNames.Controls.Pause);
        break;
      case PlaystateCommand.Unpause:
        this.eventEmitter.emit('internal.voice.controls.unpause');
        break;
      case PlaystateCommand.Stop:
        this.eventEmitter.emit(EventNames.Controls.Stop);
        break;
      case PlaystateCommand.NextTrack:
        this.eventEmitter.emit(EventNames.Circuit.NextTrack);
        break;
      case PlaystateCommand.PreviousTrack:
        this.eventEmitter.emit(EventNames.Circuit.PreviousTrack);
        break;
      case PlaystateCommand.Seek:
        this.logger.warn(
          'Seek command received from Jellyfin but is not yet supported',
        );
        break;
      case PlaystateCommand.Rewind:
        this.logger.warn(
          'Rewind command received from Jellyfin but is not yet supported',
        );
        break;
      case PlaystateCommand.FastForward:
        this.logger.warn(
          'FastForward command received from Jellyfin but is not yet supported',
        );
        break;
      default:
        this.logger.warn(
          `Unable to process incoming play state command request: ${request.Command}`,
        );
        break;
    }
  }

  private bindWebSocketEvents() {
    this.webSocket.on('open', () => {
      this.logger.log('Jellyfin WebSocket connected');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
    });

    this.webSocket.on('message', this.messageHandler.bind(this));

    this.webSocket.on('close', (code, reason) => {
      this.logger.warn(`Jellyfin WebSocket closed (code=${code}, reason=${reason?.toString?.() || ''})`);
      this.isConnecting = false;
      if (!this.isManuallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.webSocket.on('error', (err) => {
      this.logger.error(`Jellyfin WebSocket error: ${err?.message || err}`);
      // Let the 'close' handler manage reconnection; but if it's stuck, schedule one.
      if (!this.isManuallyClosed) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect() {
    if (this.isConnecting) return;
    if (this.reconnectTimer) return;

    this.reconnectAttempts += 1;
    const baseDelay = 1000; // 1s
    const maxDelay = 30000; // 30s
    const jitter = Math.floor(Math.random() * 250); // up to 250ms jitter
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, this.reconnectAttempts)) + jitter;

    this.logger.warn(`Attempting to reconnect Jellyfin WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.isManuallyClosed) {
        this.logger.debug('Reconnect aborted: socket manually closed.');
        return;
      }
      this.initializeAndConnect();
    }, delay);
  }

  private static buildSocketUrl(
    baseName: string,
    apiToken: string,
    device: string,
  ) {
    const url = new URL(baseName);
    url.pathname += '/socket';
    url.protocol = url.protocol.replace('http', 'ws');
    url.search = `?ApiKey=${apiToken}&deviceId=${device}`;
    return url;
  }

  onModuleDestroy() {
    this.disconnect();
  }

  private handleGeneralCommand(msg: JellyMessage<unknown>) {
    this.logger.warn(JSON.stringify(msg));
    const data = z
      .xor([
        z.object({
          Name: z.literal('SetVolume'),
          Arguments: z.object({
            Volume: z.string().transform((value) => Number(value) / 100),
          }),
        }),
      ])
      .parse(msg.Data);

    switch (data.Name) {
      case 'SetVolume':
        this.eventEmitter.emit(EventNames.Controls.SetVolume, {
          volume: data.Arguments.Volume,
        });
        break;
      default:
        this.logger.debug(
          `Unable to handle message: '${data.Name}': ${msg.Data}`,
        );
        break;
    }
  }
}

export interface JellyMessage<T> {
  MessageType: string;
  MessageId?: string;
  Data: T;
}

interface JellySockEvents {
  connected: (s: JellySock, ws: WebSocket) => any;
  message: (s: JellySock, msg: JellyMessage<any>) => any;
  disconnected: () => any;
}

export declare interface JellySock {
  on<U extends keyof JellySockEvents>(
    event: U,
    listener: JellySockEvents[U],
  ): this;

  once<U extends keyof JellySockEvents>(
    event: U,
    listener: JellySockEvents[U],
  ): this;

  emit<U extends keyof JellySockEvents>(
    event: U,
    ...args: Parameters<JellySockEvents[U]>
  ): boolean;
}
