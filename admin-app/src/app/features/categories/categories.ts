import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../../core/admin-api.service';
import { apiError } from '../../core/http-error';
import { Category } from '../../core/models';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-categories',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, FormsModule],
  template: `
    <h1>Categories</h1>
    <p class="muted">Drag to set the order of tabs on the customer menu.</p>

    <form class="row add" (ngSubmit)="add()">
      <input name="newName" [(ngModel)]="newName" placeholder="New category, e.g. Desserts" maxlength="60" />
      <button class="btn" type="submit" [disabled]="!newName.trim()">Add</button>
    </form>

    <div class="list" cdkDropList (cdkDropListDropped)="drop($event)">
      @for (c of categories(); track c.id) {
        <div class="card cat" cdkDrag>
          <span class="handle" cdkDragHandle aria-label="Drag to reorder" title="Drag to reorder">⠿</span>
          @if (editing() === c.id) {
            <input class="rename" [(ngModel)]="editName" (keydown.enter)="rename(c)" (keydown.escape)="editing.set(null)" maxlength="60" />
            <button class="btn" (click)="rename(c)" [disabled]="!editName.trim()">Save</button>
            <button class="btn btn-link" (click)="editing.set(null)">Cancel</button>
          } @else {
            <strong class="name">{{ c.name }}</strong>
            <span class="muted small">{{ c.itemCount }} item{{ c.itemCount === 1 ? '' : 's' }}</span>
            <span class="spacer"></span>
            <button class="btn btn-link" (click)="startEdit(c)">Rename</button>
            <button class="btn btn-link danger" (click)="remove(c)"
              [title]="c.itemCount ? 'Move or delete its items first' : 'Delete category'">Delete</button>
          }
        </div>
      } @empty {
        <p class="empty">No categories yet.</p>
      }
    </div>
  `,
  styles: `
    .add { margin-bottom: 1rem; max-width: 520px; flex-wrap: nowrap; }
    .list { display: flex; flex-direction: column; gap: 0.5rem; max-width: 640px; }
    .cat { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.9rem; }
    .handle { cursor: grab; font-size: 1.2rem; color: var(--muted); user-select: none; padding: 0.25rem; }
    .rename { flex: 1; }
    .danger { color: var(--danger); }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgb(0 0 0 / 18%); }
    .cdk-drag-placeholder { opacity: 0.35; }
    .cdk-drag-animating, .list.cdk-drop-list-dragging .cat:not(.cdk-drag-placeholder) { transition: transform 200ms ease; }
  `,
})
export class Categories implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly editing = signal<string | null>(null);
  protected newName = '';
  protected editName = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.categories().subscribe((c) => this.categories.set(c));
  }

  add() {
    this.api.createCategory(this.newName.trim()).subscribe({
      next: () => {
        this.newName = '';
        this.load();
      },
      error: (e) => this.toast.show(apiError(e), 'error'),
    });
  }

  startEdit(c: Category) {
    this.editName = c.name;
    this.editing.set(c.id);
  }

  rename(c: Category) {
    this.api.renameCategory(c.id, this.editName.trim()).subscribe({
      next: () => {
        this.editing.set(null);
        this.load();
      },
      error: (e) => this.toast.show(apiError(e), 'error'),
    });
  }

  remove(c: Category) {
    // Server answers 409 with a clear message if items still reference it.
    this.api.deleteCategory(c.id).subscribe({
      next: () => {
        this.toast.show(`${c.name} deleted`);
        this.load();
      },
      error: (e) => this.toast.show(apiError(e), 'error'),
    });
  }

  drop(e: CdkDragDrop<Category[]>) {
    if (e.previousIndex === e.currentIndex) return;
    const list = [...this.categories()];
    moveItemInArray(list, e.previousIndex, e.currentIndex);
    this.categories.set(list);
    this.api.reorderCategories(list.map((c) => c.id)).subscribe({
      error: (err) => {
        this.toast.show(apiError(err), 'error');
        this.load();
      },
    });
  }
}
