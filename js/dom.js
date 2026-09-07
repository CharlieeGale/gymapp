/**
 * Minimal DOM construction helpers.
 *
 * The app builds nodes rather than assigning strings to `innerHTML`. Text set
 * through `textContent` can never be parsed as markup, so user-entered exercise
 * names and third-party product names from Open Food Facts cannot inject HTML.
 * This removes the need for manual escaping entirely.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Looks up an element by id.
 *
 * @param {string} id
 * @returns {HTMLElement} The element.
 * @throws {Error} If no element with that id exists, which means the markup and
 *   the script have drifted apart — a bug worth failing loudly on.
 */
export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element;
}

/**
 * Creates an element.
 *
 * @param {string} tag
 * @param {{class?: string, text?: string, attrs?: Record<string, string>,
 *   dataset?: Record<string, string>}} [options]
 * @param {Array<Node|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) node.setAttribute(name, value);
  }
  if (options.dataset) {
    for (const [name, value] of Object.entries(options.dataset)) node.dataset[name] = value;
  }
  for (const child of children) {
    node.append(child);
  }
  return node;
}

/**
 * Creates an SVG element. SVG needs its own namespace; `createElement` would
 * produce an inert HTML element that renders as nothing.
 *
 * @param {string} tag
 * @param {Record<string, string|number>} [attrs]
 * @returns {SVGElement}
 */
export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

/**
 * Removes every child of a node.
 *
 * @param {Element} node
 */
export function clear(node) {
  node.replaceChildren();
}

/**
 * Replaces a node's children, or shows a placeholder when there is nothing to
 * show.
 *
 * @param {Element} node
 * @param {Node[]} children
 * @param {string} emptyMessage
 */
export function renderList(node, children, emptyMessage) {
  if (children.length === 0) {
    node.replaceChildren(el('div', { class: 'empty-state', text: emptyMessage }));
    return;
  }
  node.replaceChildren(...children);
}
