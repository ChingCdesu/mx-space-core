import type { SocketMetadata } from '~/utils/socket.util'
import type { RemoteSocket, Socket } from 'socket.io'
import type {
  DecorateAcknowledgementsWithMultipleResponses,
  DefaultEventsMap,
} from 'socket.io/dist/typed-events'

import { Injectable } from '@nestjs/common'

import { RedisKeys } from '~/constants/cache.constant'
import { getRedisKey, safeJSONParse } from '~/utils'

import { CacheService } from '../redis/cache.service'

type SocketType =
  | Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
  | RemoteSocket<
      DecorateAcknowledgementsWithMultipleResponses<DefaultEventsMap>,
      any
    >

@Injectable()
export class GatewayService {
  constructor(private readonly cacheService: CacheService) {
    cacheService.getClient().del(getRedisKey(RedisKeys.Socket))
  }

  async setSocketMetadata(socket: SocketType, value: object) {
    const existValue = await this.getSocketMetadata(socket)

    const client = this.cacheService.getClient()
    await client.hset(
      getRedisKey(RedisKeys.Socket),
      socket.id,
      JSON.stringify({
        ...existValue,
        ...value,
      }),
    )
  }

  async getSocketMetadata(socket: SocketType): Promise<SocketMetadata> {
    const client = this.cacheService.getClient()
    const data = await client.hget(getRedisKey(RedisKeys.Socket), socket.id)
    return safeJSONParse(data) || {}
  }

  async clearSocketMetadata(socket: SocketType) {
    const client = this.cacheService.getClient()
    await client.hdel(getRedisKey(RedisKeys.Socket), socket.id)
  }
}
