/**
 * A single sparkline renderer shared by the strength-progress chart and the
 * weight-trend chart. Both previously carried near-identical copies of this
 * projection and path-building code.
 */

import { CHART } from './config.js';
import { clear, el, svgEl } from './dom.js';

/**
 * Projects values onto the chart viewBox.
 *
 * @param {number[]} values
 * @param {number} min
 * @param {number} max
 * @returns {Array<[number, number]>} `[x, y]` pairs in viewBox units.
 */
function project(values, min, max) {
  const range = max - min || 1;
  const usableHeight = CHART.height - CHART.paddingTop - CHART.paddingBottom;
  const stepX = values.length > 1 ? CHART.width / (values.length - 1) : 0;
  return values.map((value, index) => {
    const x = index * stepX;
    const y = CHART.height - CHART.paddingBottom - ((value - min) / range) * usableHeight;
    return [x, y];
  });
}

/**
 * Builds an SVG path `d` attribute from projected coordinates.
 *
 * @param {Array<[number, number]>} coords
 * @returns {string}
 */
function toPathData(coords) {
  return coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
}

/**
 * Renders a placeholder message inside the chart's container instead of the
 * chart itself.
 *
 * Previously this was a `<foreignObject>` holding inline-styled HTML, which
 * meant hard-coded colours and a font size that did not scale with the user's
 * text-size preference. A sibling element styled by the stylesheet is simpler
 * and accessible.
 *
 * @param {SVGElement} svg
 * @param {string} message
 */
function renderPlaceholder(svg, message) {
  clear(svg);
  svg.hidden = true;
  const existing = svg.parentElement.querySelector('.chart-placeholder');
  if (existing) {
    existing.textContent = message;
    return;
  }
  svg.parentElement.append(el('p', { class: 'chart-placeholder', text: message }));
}

/**
 * Removes any placeholder and makes the chart visible again.
 *
 * @param {SVGElement} svg
 */
function clearPlaceholder(svg) {
  svg.hidden = false;
  svg.parentElement.querySelector('.chart-placeholder')?.remove();
}

/**
 * Draws a sparkline.
 *
 * @param {SVGElement} svg Target `<svg>` with a `0 0 100 40` viewBox.
 * @param {object} options
 * @param {number[]} options.line Values for the primary trend line.
 * @param {number[]} [options.scatter] Optional raw values drawn as faint dots.
 * @param {string} options.emptyMessage Shown when there is no data at all.
 * @param {string} options.singlePointMessage Shown when there is only one point.
 * @param {string} options.label Accessible description of the chart.
 */
export function renderSparkline(svg, options) {
  const { line, scatter = [], emptyMessage, singlePointMessage, label } = options;

  if (line.length === 0) {
    renderPlaceholder(svg, emptyMessage);
    return;
  }
  if (line.length === 1) {
    renderPlaceholder(svg, singlePointMessage);
    return;
  }

  clearPlaceholder(svg);
  clear(svg);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);

  const allValues = scatter.length > 0 ? [...line, ...scatter] : line;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  if (scatter.length > 0) {
    const scatterCoords = project(scatter, min, max);
    for (const [x, y] of scatterCoords) {
      svg.append(
        svgEl('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: 1, class: 'chart-dot-raw' }),
      );
    }
  }

  const lineCoords = project(line, min, max);
  svg.append(svgEl('path', { d: toPathData(lineCoords), class: 'chart-line' }));
  for (const [x, y] of lineCoords) {
    svg.append(svgEl('circle', { cx: x.toFixed(2), cy: y.toFixed(2), r: 1.3, class: 'chart-dot' }));
  }
}
