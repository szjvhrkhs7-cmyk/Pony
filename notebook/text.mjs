export function escape(value = "") {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function plain(value = "") {
  return String(value)
    .split(/\n\s*\n|\n/)
    .filter((x) => x.trim())
    .map((x) => `<p>${escape(x)}</p>`)
    .join("");
}
export function sanitize(value = "") {
  const root = document.createElement("template");
  root.innerHTML = String(value);
  for (const el of [...root.content.querySelectorAll("*")]) {
    if (
      [
        "SCRIPT",
        "STYLE",
        "IFRAME",
        "OBJECT",
        "SVG",
        "MATH",
        "TEMPLATE",
        "FORM",
        "INPUT",
        "BUTTON",
      ].includes(el.tagName)
    ) {
      el.remove();
      continue;
    }
    if (
      ["DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"].includes(
        el.tagName,
      )
    ) {
      const p = document.createElement("p");
      p.append(...el.childNodes);
      el.replaceWith(p);
      continue;
    }
    if (el.tagName === "OL") {
      const ul = document.createElement("ul");
      ul.append(...el.childNodes);
      el.replaceWith(ul);
      continue;
    }
    if (!["P", "BR", "B", "STRONG", "UL", "LI"].includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
  }
  for (const el of [...root.content.querySelectorAll("p,li")])
    if (!el.textContent.trim()) el.remove();
  let output = "",
    inline = "";
  for (const node of root.content.childNodes) {
    if (node.nodeType === 1 && ["P", "UL"].includes(node.tagName)) {
      if (inline.trim()) output += `<p>${inline}</p>`;
      inline = "";
      output += node.outerHTML;
    } else if (node.nodeType === 3) inline += escape(node.textContent);
    else if (node.nodeType === 1) inline += node.outerHTML;
  }
  if (inline.trim()) output += `<p>${inline}</p>`;
  return output.replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*){3,}/gi, "<br><br>");
}
