import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiOperation } from '@nestjs/swagger'
import { Types } from 'mongoose'
import { Auth } from '~/common/decorator/auth.decorator'
import { HttpCache } from '~/common/decorator/cache.decorator'
import { Paginator } from '~/common/decorator/http.decorator'
import { IpLocation, IpRecord } from '~/common/decorator/ip.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { IsMaster } from '~/common/decorator/role.decorator'
import { UpdateDocumentCount } from '~/common/decorator/update-count.decorator'
import { CannotFindException } from '~/common/exceptions/cant-find.exception'
import { CountingService } from '~/processors/helper/helper.counting.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { SearchDto } from '~/shared/dto/search.dto'
import {
  addConditionToSeeHideContent,
  addYearCondition,
} from '~/utils/query.util'
import { CategoryAndSlugDto, PostQueryDto } from './post.dto'
import { PartialPostModel, PostModel } from './post.model'
import { PostService } from './post.service'

@Controller('posts')
@ApiName
export class PostController {
  constructor(
    private readonly postService: PostService,
    private readonly countingService: CountingService,
  ) {}

  @Get('/')
  @Paginator
  async getPaginate(@Query() query: PostQueryDto, @IsMaster() master: boolean) {
    const { size, select = '-text', page, year, sortBy, sortOrder } = query

    return await this.postService.findWithPaginator(
      {
        ...addYearCondition(year),
        ...addConditionToSeeHideContent(master),
      },
      {
        limit: size,
        page,
        select,
        sort: sortBy ? { [sortBy]: sortOrder || -1 } : { created: -1 },
        populate: 'category',
      },
    )
  }

  @Get('/:id')
  @UpdateDocumentCount('Post')
  async getById(@Param() params: MongoIdDto, @IsMaster() isMaster: boolean) {
    const { id } = params
    const doc = await this.postService.model.findById(id)
    if (!doc || (doc.hide && !isMaster)) {
      throw new CannotFindException()
    }
    return doc
  }

  @Get('/latest')
  @UpdateDocumentCount('Post')
  async getLatest(@IsMaster() isMaster: boolean) {
    return this.postService.model
      .findOne({ ...addConditionToSeeHideContent(isMaster) })
      .sort({ created: -1 })
      .lean()
  }

  @Get('/:category/:slug')
  @ApiOperation({ summary: '根据分类名和自定义别名获取' })
  @UpdateDocumentCount('Post')
  async getByCateAndSlug(
    @Param() params: CategoryAndSlugDto,
    @IsMaster() isMaster: boolean,
  ) {
    const { category, slug } = params

    const categoryDocument = await this.postService.getCategoryBySlug(category)
    if (!categoryDocument) {
      throw new NotFoundException('该分类未找到 (｡•́︿•̀｡)')
    }

    const postDocument = await this.postService.model
      .findOne({
        slug,
        categoryId: categoryDocument._id,
        // ...condition,
      })
      .populate('category')

    if (!postDocument || (postDocument.hide && !isMaster)) {
      throw new CannotFindException()
    }
    return postDocument.toJSON()
  }

  @Post('/')
  @Auth()
  @HttpCode(201)
  async create(@Body() body: PostModel) {
    const _id = Types.ObjectId()

    return await this.postService.create({
      ...body,
      created: new Date(),
      modified: null,
      slug: body.slug ?? _id.toHexString(),
    })
  }

  @Put('/:id')
  @Auth()
  async update(@Param() params: MongoIdDto, @Body() body: PostModel) {
    await this.postService.updateById(params.id, body)
    return this.postService.findById(params.id)
  }

  @Patch('/:id')
  @Auth()
  async patch(@Param() params: MongoIdDto, @Body() body: PartialPostModel) {
    return await this.postService.updateById(params.id, body)
  }

  @Delete('/:id')
  @Auth()
  @HttpCode(204)
  async deletePost(@Param() params: MongoIdDto) {
    const { id } = params
    await this.postService.deletePost(id)

    return
  }

  @Get('/search')
  @HttpCache.disable
  @Paginator
  async searchPost(@Query() query: SearchDto, @IsMaster() isMaster: boolean) {
    const { keyword, page, size } = query
    const select = '_id title created modified categoryId slug'
    const keywordArr = keyword
      .split(/\s+/)
      .map((item) => new RegExp(String(item), 'ig'))
    return await this.postService.findWithPaginator(
      {
        $or: [{ title: { $in: keywordArr } }, { text: { $in: keywordArr } }],
        $and: [{ ...addConditionToSeeHideContent(isMaster) }],
      },
      {
        limit: size,
        page,
        select,
        populate: 'categoryId',
      },
    )
  }

  @Get('/_thumbs-up')
  @HttpCode(204)
  async thumbsUpArticle(
    @Query() query: MongoIdDto,
    @IpLocation() location: IpRecord,
  ) {
    const { ip } = location
    const { id } = query
    try {
      const res = await this.countingService.updateLikeCount('Post', id, ip)
      if (!res) {
        throw new BadRequestException('你已经支持过啦!')
      }
    } catch (e: any) {
      throw new BadRequestException(e)
    }

    return
  }
}
