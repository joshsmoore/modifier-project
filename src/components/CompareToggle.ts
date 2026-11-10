/**
 * <compare-toggle src-a="..." src-b="..." alt-a="..." alt-b="..." label-a="..." label-b="...">
 * Click or press space to flip between the two images in place.
 * Useful for spotting subtle differences — the brain is good at change
 * detection between identical framings.
 */
class CompareToggle extends HTMLElement {
  private showingB = false;
  private imgEl!: HTMLImageElement;
  private labelEl!: HTMLSpanElement;

  connectedCallback() {
    const a = this.getAttribute('src-a');
    const b = this.getAttribute('src-b');
    const altA = this.getAttribute('alt-a') ?? '';
    const altB = this.getAttribute('alt-b') ?? '';
    const labelA = this.getAttribute('label-a') ?? 'A';
    const labelB = this.getAttribute('label-b') ?? 'B';
    if (!a || !b) return;

    this.dataset.a = a;
    this.dataset.b = b;
    this.dataset.altA = altA;
    this.dataset.altB = altB;
    this.dataset.labelA = labelA;
    this.dataset.labelB = labelB;

    this.innerHTML = `
      <img src="${a}" alt="${altA}" draggable="false">
      <span class="label">${labelA}</span>
    `;
    this.imgEl = this.querySelector('img')!;
    this.labelEl = this.querySelector('.label')!;

    // Preload B
    const preload = new Image();
    preload.src = b;

    this.tabIndex = 0;
    this.setAttribute('role', 'button');
    this.setAttribute('aria-pressed', 'false');
    this.setAttribute('aria-label', `Toggle between ${labelA} and ${labelB}`);

    this.addEventListener('click', this.toggle);
    this.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.toggle);
    this.removeEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.toggle();
    }
  };

  private toggle = () => {
    this.showingB = !this.showingB;
    const next = this.showingB ? this.dataset.b! : this.dataset.a!;
    const alt = this.showingB ? this.dataset.altB! : this.dataset.altA!;
    const label = this.showingB ? this.dataset.labelB! : this.dataset.labelA!;
    this.imgEl.src = next;
    this.imgEl.alt = alt;
    this.labelEl.textContent = label;
    this.setAttribute('aria-pressed', this.showingB ? 'true' : 'false');
  };
}

if (!customElements.get('compare-toggle')) {
  customElements.define('compare-toggle', CompareToggle);
}
