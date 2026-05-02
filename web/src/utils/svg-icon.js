export function createSvgIcon(src, { className = "", colored = false, size = "1em" } = {}) {
  const icon = document.createElement(colored ? "img" : "span");
  icon.className = className;
  icon.setAttribute("aria-hidden", "true");
  icon.style.display = "inline-block";
  icon.style.width = size;
  icon.style.height = size;
  icon.style.flex = "0 0 auto";
  icon.style.verticalAlign = "-0.125em";

  if (colored) {
    icon.src = src;
    icon.alt = "";
    return icon;
  }

  icon.style.backgroundColor = "currentColor";
  icon.style.mask = `url("${src}") center / contain no-repeat`;
  icon.style.webkitMask = `url("${src}") center / contain no-repeat`;
  return icon;
}
