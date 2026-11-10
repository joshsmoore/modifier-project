/**
 * <compare-slider src-a="..." src-b="..." alt-a="..." alt-b="...">
 * Drag, touch, or arrow-key the handle to reveal image B under image A.
 * Dimensions come from the underlying images (identical by validation).
 */
class CompareSlider extends HTMLElement {
  private pos = 50; // percent, 0 = fully A, 100 = fully B
  private dragging = false;
  private pointerId: number | null = null;

  connectedCallback() {
    const a = this.getAttribute('src-a');
    const b = this.getAttribute('src-b');
    const altA = this.getAttribute('alt-a') ?? '';
    const altB = this.getAttribute('alt-b') ?? '';
    if (!a || !b) return;

    this.innerHTML = `
      <div class="slider-inner">
        <div class="layer layer-bottom"><img src="${b}" alt="${altB}" draggable="false"></div>
        <div class="layer layer-top"><img src="${a}" alt="${altA}" draggable="false"></div>
        <div class="handle" aria-hidden="true"></div>
      </div>
    `;

    this.tabIndex = 0;
    this.setAttribute('role', 'slider');
    this.setAttribute('aria-label', 'Reveal comparison');
    this.setAttribute('aria-valuemin', '0');
    this.setAttribute('aria-valuemax', '100');
    this.update();

    this.addEventListener('pointerdown', this.onPointerDown);
    this.addEventListener('pointermove', this.onPointerMove);
    this.addEventListener('pointerup', this.onPointerUp);
    this.addEventListener('pointercancel', this.onPointerUp);
    this.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener('pointerdown', this.onPointerDown);
    this.removeEventListener('pointermove', this.onPointerMove);
    this.removeEventListener('pointerup', this.onPointerUp);
    this.removeEventListener('pointercancel', this.onPointerUp);
    this.removeEventListener('keydown', this.onKeyDown);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.setPointerCapture(e.pointerId);
    this.setFromEvent(e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.setFromEvent(e);
  };

  private onPointerUp = (e: PointerEvent) => {
    this.dragging = false;
    if (this.pointerId != null) {
      try {
        this.releasePointerCapture(this.pointerId);
      } catch {
        /* no-op */
      }
    }
    this.pointerId = null;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      this.pos = Math.max(0, this.pos - step);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      this.pos = Math.min(100, this.pos + step);
      e.preventDefault();
    } else if (e.key === 'Home') {
      this.pos = 0;
      e.preventDefault();
    } else if (e.key === 'End') {
      this.pos = 100;
      e.preventDefault();
    } else {
      return;
    }
    this.update();
  };

  private setFromEvent(e: PointerEvent) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left;
    this.pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    this.update();
  }

  private update() {
    this.style.setProperty('--left', `${this.pos}%`);
    this.style.setProperty('--right', `${100 - this.pos}%`);
    this.setAttribute('aria-valuenow', String(Math.round(this.pos)));
  }
}

if (!customElements.get('compare-slider')) {
  customElements.define('compare-slider', CompareSlider);
}
