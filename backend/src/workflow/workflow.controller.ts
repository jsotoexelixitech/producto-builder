import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import {
  ApproveProductDto,
  TransitionStatusDto,
} from '../products/dto/product.dto';

@Controller('products/:productId/workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('validate-submission')
  validate(@Param('productId') productId: string) {
    return this.workflowService.validateSubmission(productId);
  }

  @Post('transition')
  transition(
    @Param('productId') productId: string,
    @Body() dto: TransitionStatusDto,
  ) {
    return this.workflowService.transition(productId, dto);
  }

  @Post('approve')
  approve(
    @Param('productId') productId: string,
    @Body() dto: ApproveProductDto,
  ) {
    return this.workflowService.approve(productId, dto);
  }
}
