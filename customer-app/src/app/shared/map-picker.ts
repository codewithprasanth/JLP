import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, model, viewChild } from '@angular/core';
import * as L from 'leaflet';

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Draggable-pin map (Leaflet + OpenStreetMap tiles, no API key).
 * Optionally draws the restaurant and its delivery radius.
 */
@Component({
  selector: 'app-map-picker',
  template: `<div #map class="map" role="application" aria-label="Map — drag the pin or tap to set the location"></div>`,
})
export class MapPicker implements OnDestroy {
  readonly position = model.required<LatLng>();
  readonly shop = input<LatLng | null>(null);
  readonly radiusKm = input<number | null>(null);
  /** Hide the shop marker when the draggable pin IS the shop (admin settings). */
  readonly showShopIcon = input(true);
  /** Zoom out to show the whole delivery area (admin settings) instead of street level. */
  readonly fitToRadius = input(false);

  private readonly el = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map?: L.Map;
  private marker?: L.Marker;
  private overlays?: L.LayerGroup;
  private fitted = false;

  constructor() {
    afterNextRender(() => this.init());

    // External position changes (e.g. "use current location") move the pin.
    effect(() => {
      const p = this.position();
      if (!this.marker) return;
      const current = this.marker.getLatLng();
      if (current.lat !== p.lat || current.lng !== p.lng) {
        this.marker.setLatLng(p);
        this.map?.panTo(p);
      }
    });

    effect(() => this.drawShop(this.shop(), this.radiusKm(), this.showShopIcon()));
  }

  private init() {
    const start = this.position();
    this.map = L.map(this.el().nativeElement, { zoomControl: true }).setView(start, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // divIcon avoids Leaflet's default marker image paths, which break under bundlers.
    const pin = L.divIcon({ className: '', html: '<div class="shop-pin">📍</div>', iconSize: [28, 28], iconAnchor: [14, 26] });
    this.marker = L.marker(start, { draggable: true, icon: pin, autoPan: true }).addTo(this.map);
    this.marker.on('dragend', () => {
      const { lat, lng } = this.marker!.getLatLng();
      this.position.set({ lat: round6(lat), lng: round6(lng) });
    });
    this.map.on('click', (e: L.LeafletMouseEvent) => this.position.set({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }));

    this.overlays = L.layerGroup().addTo(this.map);
    this.drawShop(this.shop(), this.radiusKm(), this.showShopIcon());
    // The container may still be settling its size on first paint.
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private drawShop(shop: LatLng | null, radiusKm: number | null, showIcon: boolean) {
    if (!this.overlays) return;
    this.overlays.clearLayers();
    if (!shop) return;
    const icon = L.divIcon({ className: '', html: '<div class="shop-pin">🏪</div>', iconSize: [28, 28], iconAnchor: [14, 14] });
    if (showIcon) L.marker(shop, { icon, interactive: false }).addTo(this.overlays);
    if (radiusKm) {
      const circle = L.circle(shop, { radius: radiusKm * 1000, color: '#2f5d50', weight: 2, fillOpacity: 0.08, interactive: false }).addTo(this.overlays);
      if (this.fitToRadius() && !this.fitted) {
        this.map?.fitBounds(circle.getBounds(), { padding: [16, 16] });
        this.fitted = true;
      }
    }
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
