import { CacheKey, CacheTTL, Controller, Get, Res } from '@nestjs/common'
import { FastifyReply } from 'fastify'
import xss from 'xss'
import { CacheKeys } from '~/constants/cache.constant'
import { AggregateService } from '../aggregate/aggregate.service'
import { ConfigsService } from '../configs/configs.service'
import { MarkdownService } from '../markdown/markdown.service'

@Controller({ path: 'feed' })
export class FeedController {
  constructor(
    private readonly aggregateService: AggregateService,
    private readonly configs: ConfigsService,
    private readonly markdownService: MarkdownService,
  ) {}

  @Get('/')
  @CacheKey(CacheKeys.RSSCatch)
  @CacheTTL(3600)
  async rss(@Res() res: FastifyReply) {
    const { author, data, url } =
      await this.aggregateService.buildRssStructure()
    const { title } = this.configs.get('seo')
    const { avatar } = await this.configs.getMaster()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>${title}</title>
      <link href="/atom.xml" rel="self"/>
      <link href="/feed" rel="self"/>
      <link href="${xss(url)}"/>
      <updated>${new Date().toISOString()}</updated>
      <id>${xss(url)}</id>
      <author>
        <name>${author}</name>
      </author>
      <generator>${'Mix Space CMS'}</generator>
      <language>zh-CN</language>
      <image>
          <url>${xss(avatar)}</url>
          <title>${title}</title>
          <link>${xss(url)}</link>
      </image>
        ${data.map((item) => {
          return `<entry>
            <title>${item.title}</title>
            <link href="${xss(item.link)}"/>
            <id>${xss(item.link)}</id>
            <published>${item.created}</published>
            <updated>${item.modified}</updated>
            <content type="html"><![CDATA[
              <blockquote>该渲染由 marked 生成, 可能存在部分语句不通或者排版问题, 最佳体验请前往: <a href="${xss(
                item.link,
              )}">${xss(item.link)}</a></blockquote>
              ${this.markdownService.render(item.text)}
              <p>
              <a href="${xss(item.link) + '#comments'}">评论</a>
              </p>
            ]]>
            </content>
            </entry>
          `
        })}
    </feed>`

    return res.type('application/xml').send(xml)
  }
}
