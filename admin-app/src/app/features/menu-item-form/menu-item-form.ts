import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminApi } from '../../core/admin-api.service';
import { apiError } from '../../core/http-error';
import { Category } from '../../core/models';
import { ToastService } from '../../core/toast.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Same form for add and edit (pre-filled when editing). */
@Component({
  selector: 'app-menu-item-form',
  imports: [FormsModule, RouterLink],
  template: `
    <a routerLink="/menu" class="small">← My food list</a>
    <h1>{{ id() ? 'Edit item' : 'Add new item' }}</h1>

    <form class="card stack form" (ngSubmit)="save()">
      <label class="field">Item name
        <input name="name" [(ngModel)]="name" maxlength="120" required />
      </label>
      <label class="field">Category
        <select name="categoryId" [(ngModel)]="categoryId" required>
          <option value="" disabled>Choose a category</option>
          @for (c of categories(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
        </select>
        @if (categories().length === 0) { <span class="small muted">No categories yet — <a routerLink="/categories">create one</a> first.</span> }
      </label>

      <div class="field">Photo
        <div class="row">
          @if (preview()) {
            <img class="thumb big" [src]="preview()" alt="Preview" />
          } @else {
            <div class="thumb big">🍽️</div>
          }
          <label class="btn btn-outline">
            {{ preview() ? 'Change photo' : 'Upload photo' }}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden (change)="pick($event)" />
          </label>
        </div>
        <span class="small muted">JPEG, PNG or WebP, up to 5 MB.</span>
      </div>

      <label class="field">Price (₹)
        <input name="price" type="number" inputmode="decimal" min="1" step="0.01" [(ngModel)]="price" required />
      </label>
      <label class="field">Description
        <textarea name="description" rows="3" maxlength="1000" [(ngModel)]="description"></textarea>
      </label>
      <label class="switch">
        <input type="checkbox" name="isAvailable" [(ngModel)]="isAvailable" />
        <span class="track"></span>
        <span>Available for ordering</span>
      </label>

      @if (error()) { <p class="error">{{ error() }}</p> }
      <button class="btn" type="submit" [disabled]="busy() || !valid()">{{ busy() ? 'Saving…' : 'Save' }}</button>
    </form>
  `,
  styles: `
    .form { max-width: 560px; }
    .field { display: flex; flex-direction: column; gap: 0.4rem; font-weight: 600; font-size: 0.9rem; }
    .big { width: 96px; height: 96px; }
  `,
})
export class MenuItemForm implements OnInit, OnDestroy {
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly id = input<string>();
  protected readonly categories = signal<Category[]>([]);
  protected readonly preview = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected name = '';
  protected categoryId = '';
  protected price: number | null = null;
  protected description = '';
  protected isAvailable = true;
  private file: File | null = null;
  private objectUrl: string | null = null;

  ngOnInit() {
    this.api.categories().subscribe((c) => {
      this.categories.set(c);
      if (!this.id() && c.length === 1) this.categoryId = c[0].id;
    });
    const id = this.id();
    if (id) {
      this.api.menuItem(id).subscribe({
        next: (item) => {
          this.name = item.name;
          this.categoryId = item.categoryId;
          this.price = Number(item.price);
          this.description = item.description ?? '';
          this.isAvailable = item.isAvailable;
          this.preview.set(item.imageUrl);
        },
        error: (e) => this.error.set(apiError(e)),
      });
    }
  }

  protected valid = () => this.name.trim().length > 0 && !!this.categoryId && (this.price ?? 0) > 0;

  pick(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      this.error.set('Image must be 5 MB or smaller');
      return;
    }
    this.error.set('');
    this.file = file;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    this.preview.set(this.objectUrl);
  }

  save() {
    if (!this.valid()) return;
    const form = new FormData();
    form.set('name', this.name.trim());
    form.set('categoryId', this.categoryId);
    form.set('price', String(this.price));
    form.set('description', this.description.trim());
    form.set('isAvailable', String(this.isAvailable));
    if (this.file) form.set('image', this.file);

    this.busy.set(true);
    this.error.set('');
    const id = this.id();
    (id ? this.api.updateMenuItem(id, form) : this.api.createMenuItem(form)).subscribe({
      next: (item) => {
        this.toast.show(`${item.name} saved`);
        this.router.navigateByUrl('/menu');
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(apiError(e));
      },
    });
  }

  ngOnDestroy() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}
