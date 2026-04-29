function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("/sw.js").catch((error) => {
    console.warn("Service worker registration failed.", error);
  });
}

registerServiceWorker();
