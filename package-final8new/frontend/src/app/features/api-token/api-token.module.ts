/**
 * Angular Feature Module: ApiTokenModule
 * Tách module riêng theo quy tắc quytac.md để gom component + service cho chức năng API Token.
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiTokenComponent } from './api-token.component';

@NgModule({
  imports: [CommonModule, FormsModule, ApiTokenComponent],
  exports: [ApiTokenComponent]
})
export class ApiTokenModule {}
