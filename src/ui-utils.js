import { ICONS } from './icons.js';
export const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const money = n => Math.round(n).toLocaleString('ja-JP');
export const signed = n => `${n>=0?'+':'−'}${money(Math.abs(n))}`;
export function icon(name, className='') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(ICONS[name]??ICONS.museum).map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).map(([key,value])=>`${key}="${esc(value)}"`).join(' ')}/>`).join('')}</svg>`;
}
