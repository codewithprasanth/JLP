import { Component, computed, input, signal } from '@angular/core';

export interface BarDatum {
  key: string;
  label: string; // axis label
  value: number;
  detail: string; // tooltip text
}

/**
 * Single-series column chart (inline SVG, no library). Follows the dataviz specs:
 * one validated hue, columns ≤ 24px with a 4px rounded data-end and square base,
 * 1px recessive gridlines, clean y ticks, per-column hover/focus tooltip with a hit
 * target taller than the mark, and no legend (the card title names the series).
 */
@Component({
  selector: 'app-bar-chart',
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="ariaLabel()" preserveAspectRatio="none">
        @for (t of ticks(); track t) {
          <line class="grid" [attr.x1]="PAD_L" [attr.x2]="W - PAD_R" [attr.y1]="y(t)" [attr.y2]="y(t)" />
          <text class="tick" [attr.x]="PAD_L - 6" [attr.y]="y(t) + 4" text-anchor="end">{{ formatTick(t) }}</text>
        }
        @for (d of data(); track d.key; let i = $index) {
          <g>
            <path class="bar" [class.dim]="hover() !== null && hover() !== i" [attr.d]="barPath(i, d.value)" />
            <!-- full-height hit target: easier to hover than a short bar -->
            <rect class="hit" [attr.x]="slotX(i)" [attr.y]="PAD_T" [attr.width]="slotW()" [attr.height]="plotH"
              tabindex="0" [attr.aria-label]="d.label + ': ' + d.detail"
              (mouseenter)="hover.set(i)" (focus)="hover.set(i)" (blur)="hover.set(null)" />
            @if (showLabel(i)) {
              <text class="xlabel" [attr.x]="slotX(i) + slotW() / 2" [attr.y]="H - 6" text-anchor="middle">{{ d.label }}</text>
            }
          </g>
        }
        <line class="axis" [attr.x1]="PAD_L" [attr.x2]="W - PAD_R" [attr.y1]="PAD_T + plotH" [attr.y2]="PAD_T + plotH" />
      </svg>
      @if (hover() !== null) {
        @let d = data()[hover()!];
        @let pct = ((slotX(hover()!) + slotW() / 2) / W) * 100;
        <div class="tip" [style.left.%]="pct" [class.edge-right]="pct > 85" [class.edge-left]="pct < 15">
          <strong>{{ d.label }}</strong><br />{{ d.detail }}
        </div>
      }
    </div>
  `,
  styles: `
    .chart { position: relative; }
    svg { width: 100%; height: 220px; display: block; overflow: visible; }
    .grid { stroke: var(--grid); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .axis { stroke: #cfd3ce; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .tick, .xlabel { fill: var(--muted); font-size: 11px; }
    .bar { fill: var(--chart-bar); transition: opacity 0.12s; }
    .bar.dim { opacity: 0.45; }
    .hit { fill: transparent; cursor: default; outline: none; }
    /* Anchored inside the plot's top band so it never covers controls above the chart. */
    .tip { position: absolute; top: 4px; transform: translateX(-50%); background: #1f2937; color: #fff;
      padding: 0.4rem 0.6rem; border-radius: 8px; font-size: 0.82rem; white-space: nowrap; pointer-events: none; z-index: 1; }
    .tip.edge-right { transform: translateX(calc(-100% - 14px)); }
    .tip.edge-left { transform: translateX(14px); }
  `,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly ariaLabel = input('Bar chart');
  readonly formatValue = input<(v: number) => string>((v) => v.toLocaleString('en-IN'));

  protected readonly W = 640;
  protected readonly H = 220;
  protected readonly PAD_L = 52;
  protected readonly PAD_R = 8;
  protected readonly PAD_T = 12;
  protected readonly PAD_B = 24;
  protected readonly plotH = this.H - this.PAD_T - this.PAD_B;
  protected readonly hover = signal<number | null>(null);

  /** Clean 1-2-5 ticks covering the max. */
  protected readonly ticks = computed(() => {
    const max = Math.max(0, ...this.data().map((d) => d.value));
    if (max === 0) return [0];
    const raw = max / 4;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
    const out: number[] = [];
    for (let t = 0; t <= max + step * 0.001; t += step) out.push(t);
    if (out.at(-1)! < max) out.push(out.at(-1)! + step);
    return out;
  });
  private readonly top = computed(() => this.ticks().at(-1) || 1);

  protected slotW = () => (this.W - this.PAD_L - this.PAD_R) / Math.max(1, this.data().length);
  protected slotX = (i: number) => this.PAD_L + i * this.slotW();
  protected y = (v: number) => this.PAD_T + this.plotH * (1 - v / this.top());

  protected barPath(i: number, v: number): string {
    const w = Math.min(24, this.slotW() * 0.6);
    const x = this.slotX(i) + (this.slotW() - w) / 2;
    const base = this.PAD_T + this.plotH;
    const h = (this.plotH * v) / this.top();
    if (h <= 0) return '';
    const r = Math.min(4, h, w / 2);
    const top = base - h;
    // square at the baseline, 4px rounded at the data end
    return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
  }

  /** Thin out x labels so they never collide. */
  protected showLabel(i: number): boolean {
    const n = this.data().length;
    const every = Math.ceil(n / 10);
    return i % every === 0 || i === n - 1;
  }

  protected formatTick(v: number): string {
    return v >= 1000 ? `${(v / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k` : String(v);
  }
}
