const loadingElId = "custom-app-loading";

function showdsLoading() {
  const el = document.getElementById(loadingElId);
  if (el) return;

  const loading = document.createElement("div");
  loading.id = loadingElId;
  loading.className = loadingElId;
  loading.innerHTML = `<span class="loading loading-xl"></span>`;

  document.body.appendChild(loading);
}

function hiddendsLoading() {
  const el = document.getElementById(loadingElId);
  if (el) {
    el.remove();
  }
}

export function dsLoading(trigger: boolean) {
  if (trigger) showdsLoading();
  else hiddendsLoading();
}
