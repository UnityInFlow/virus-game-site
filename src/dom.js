export const byId = (id) => document.getElementById(id);

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function textNode(value) {
  return document.createTextNode(String(value));
}

export function element(name, { className, text, attributes } = {}) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  }
  return node;
}
